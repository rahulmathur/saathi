import { Hono } from 'hono';
import { newPairCode, requireFamily, type UserRow } from '../auth';
import { acceptedCompanions, companionCard, contactFor, forMatch, ownedTraveller, ownedTrip, travellerOut, tripOut, type TravellerRow, type TripRow } from '../data';
import type { AppEnv } from '../env';
import { flightStatus } from '../flights';
import { passesFilter, relation, score, sharedLanguages, type MatchFilter } from '../matching';
import { addEvent, tellFamily } from '../notify';
import { normaliseFlightNumber, parseBooking } from '../parse';
import { AIRPORT_RE, TIME_RE, bool, fail, int, isValidDate, newId, nowIso, parseLanguages, readBody, str, strList } from '../util';

export const family = new Hono<AppEnv>();
family.use('*', requireFamily);

// ---- Account ----------------------------------------------------------------

family.get('/me', async (c) => {
  const { userId } = c.get('session');
  const user = await c.env.DB.prepare('SELECT id, email, name, phone FROM users WHERE id = ?').bind(userId).first<UserRow>();
  if (!user) fail(401, 'Please sign in');
  return c.json({ user });
});

family.patch('/me', async (c) => {
  const { userId } = c.get('session');
  const body = await readBody(c.req);
  const name = str(body, 'name', { max: 80 });
  const phone = str(body, 'phone', { max: 20 });
  if (phone && !/^\+\d{7,15}$/.test(phone)) fail(400, 'Phone must be in international format, like +12035551234');
  await c.env.DB.prepare('UPDATE users SET name = COALESCE(?, name), phone = COALESCE(?, phone) WHERE id = ?').bind(name, phone, userId).run();
  const user = await c.env.DB.prepare('SELECT id, email, name, phone FROM users WHERE id = ?').bind(userId).first<UserRow>();
  return c.json({ user });
});

/** Deletes the account and everything it manages (travellers, trips, introductions). */
family.delete('/me', async (c) => {
  const { userId } = c.get('session');
  await c.env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId).run();
  return c.json({ ok: true });
});

// ---- Travellers -------------------------------------------------------------

function travellerFields(body: Record<string, unknown>, creating: boolean) {
  const kind = str(body, 'kind', { max: 10 });
  if (kind && kind !== 'senior' && kind !== 'helper') fail(400, 'kind must be senior or helper');
  const phone = str(body, 'phone', { max: 20 });
  if (phone && !/^\+\d{7,15}$/.test(phone)) fail(400, 'Phone must be in international format, like +919812345678');
  const languages = strList(body, 'languages');
  return {
    name: str(body, 'name', { required: creating, max: 80 }),
    relation: str(body, 'relation', { max: 30 }),
    age: int(body, 'age', 1, 120),
    kind,
    home_city: str(body, 'homeCity', { max: 80 }),
    visiting_city: str(body, 'visitingCity', { max: 80 }),
    languages: languages ? JSON.stringify(languages) : null,
    diet: str(body, 'diet', { max: 60 }),
    mobility: str(body, 'mobility', { max: 120 }),
    phone,
    about: str(body, 'about', { max: 400 }),
  };
}

family.get('/travellers', async (c) => {
  const { userId } = c.get('session');
  const rows = await c.env.DB.prepare('SELECT * FROM travellers WHERE owner_user_id = ? ORDER BY created_at').bind(userId).all<TravellerRow>();
  return c.json({ travellers: rows.results.map(travellerOut) });
});

family.post('/travellers', async (c) => {
  const { userId } = c.get('session');
  const f = travellerFields(await readBody(c.req), true);
  const id = newId();
  await c.env.DB.prepare(
    `INSERT INTO travellers (id, owner_user_id, name, relation, age, kind, home_city, visiting_city, languages, diet, mobility, phone, about)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, userId, f.name, f.relation, f.age, f.kind ?? 'senior', f.home_city, f.visiting_city, f.languages ?? '[]', f.diet, f.mobility, f.phone, f.about)
    .run();
  return c.json({ traveller: travellerOut(await ownedTraveller(c.env.DB, userId, id)) }, 201);
});

family.patch('/travellers/:id', async (c) => {
  const { userId } = c.get('session');
  const id = c.req.param('id');
  await ownedTraveller(c.env.DB, userId, id);
  const f = travellerFields(await readBody(c.req), false);
  const sets = Object.entries(f).filter(([, v]) => v !== null);
  if (sets.length) {
    await c.env.DB.prepare(`UPDATE travellers SET ${sets.map(([k]) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...sets.map(([, v]) => v), id)
      .run();
  }
  return c.json({ traveller: travellerOut(await ownedTraveller(c.env.DB, userId, id)) });
});

family.delete('/travellers/:id', async (c) => {
  const { userId } = c.get('session');
  const id = c.req.param('id');
  await ownedTraveller(c.env.DB, userId, id);
  await c.env.DB.prepare('DELETE FROM travellers WHERE id = ?').bind(id).run();
  return c.json({ ok: true });
});

/** A short-lived code the parent types into their own phone to open the parent app. */
family.post('/travellers/:id/pair-code', async (c) => {
  const { userId } = c.get('session');
  const id = c.req.param('id');
  await ownedTraveller(c.env.DB, userId, id);
  return c.json(await newPairCode(c.env.DB, id, userId));
});

// ---- Trips ------------------------------------------------------------------

const TRIP_FIELDS = ['airline', 'flight_number', 'flight_date', 'origin', 'destination', 'depart_time', 'arrive_time', 'arrive_date', 'seat', 'wheelchair', 'seeking'] as const;
type TripField = (typeof TRIP_FIELDS)[number];

function tripFields(body: Record<string, unknown>, creating: boolean): Partial<Record<TripField, string | number | null>> {
  const out: Partial<Record<TripField, string | number | null>> = {};
  const fn = str(body, 'flightNumber', { required: creating, max: 10 });
  if (fn) {
    const n = normaliseFlightNumber(fn);
    if (!n) fail(400, 'Flight number should look like AI 101');
    out.airline = n.airline;
    out.flight_number = n.flightNumber;
  }
  const date = str(body, 'flightDate', { required: creating, max: 10 });
  if (date) {
    if (!isValidDate(date)) fail(400, 'flightDate must be YYYY-MM-DD');
    out.flight_date = date;
  }
  const arriveDate = str(body, 'arriveDate', { max: 10 });
  if (arriveDate) {
    if (!isValidDate(arriveDate)) fail(400, 'arriveDate must be YYYY-MM-DD');
    out.arrive_date = arriveDate;
  }
  for (const [key, col] of [['origin', 'origin'], ['destination', 'destination']] as const) {
    const v = str(body, key, { required: creating, max: 3 })?.toUpperCase();
    if (v) {
      if (!AIRPORT_RE.test(v)) fail(400, `${key} must be a 3-letter airport code`);
      out[col] = v;
    }
  }
  for (const [key, col] of [['departTime', 'depart_time'], ['arriveTime', 'arrive_time']] as const) {
    const v = str(body, key, { max: 5 });
    if (v) {
      if (!TIME_RE.test(v)) fail(400, `${key} must be HH:MM`);
      out[col] = v;
    }
  }
  const seat = str(body, 'seat', { max: 4 });
  if (seat) out.seat = seat.toUpperCase();
  const wheelchair = bool(body, 'wheelchair');
  if (wheelchair !== null) out.wheelchair = wheelchair ? 1 : 0;
  const seeking = bool(body, 'seeking');
  if (seeking !== null) out.seeking = seeking ? 1 : 0;
  return out;
}

async function audit(db: D1Database, tripId: string, userId: string, action: 'create' | 'update' | 'delete', changes: object) {
  await db.prepare('INSERT INTO trip_audit (trip_id, user_id, action, changes) VALUES (?, ?, ?, ?)').bind(tripId, userId, action, JSON.stringify(changes)).run();
}

/** Flight details pulled from pasted booking-email text, for the user to confirm. */
family.post('/trips/parse', async (c) => {
  const body = await readBody(c.req);
  const text = str(body, 'text', { required: true, max: 50_000 })!;
  return c.json(parseBooking(text));
});

family.get('/trips', async (c) => {
  const { userId } = c.get('session');
  const db = c.env.DB;
  const rows = await db
    .prepare(
      `SELECT t.* FROM trips t JOIN travellers tr ON tr.id = t.traveller_id
       WHERE tr.owner_user_id = ? ORDER BY t.flight_date, t.depart_time`,
    )
    .bind(userId)
    .all<TripRow>();
  const travellers = await db.prepare('SELECT * FROM travellers WHERE owner_user_id = ?').bind(userId).all<TravellerRow>();
  const byId = new Map(travellers.results.map((t) => [t.id, t]));
  const trips = [];
  for (const t of rows.results) {
    const pending = await db
      .prepare(`SELECT COUNT(*) AS n FROM intro_requests WHERE to_trip_id = ? AND status = 'pending'`)
      .bind(t.id)
      .first<{ n: number }>();
    trips.push({
      ...tripOut(t),
      traveller: travellerOut(byId.get(t.traveller_id)!),
      companions: await acceptedCompanions(db, t),
      pendingRequests: pending?.n ?? 0,
    });
  }
  return c.json({ trips });
});

family.post('/trips', async (c) => {
  const { userId } = c.get('session');
  const body = await readBody(c.req);
  const travellerId = str(body, 'travellerId', { required: true, max: 64 })!;
  await ownedTraveller(c.env.DB, userId, travellerId);
  const f = tripFields(body, true);
  const id = newId();
  const cols = Object.keys(f) as TripField[];
  await c.env.DB.prepare(`INSERT INTO trips (id, traveller_id, ${cols.join(', ')}) VALUES (?, ?, ${cols.map(() => '?').join(', ')})`)
    .bind(id, travellerId, ...cols.map((k) => f[k]))
    .run();
  await audit(c.env.DB, id, userId, 'create', Object.fromEntries(cols.map((k) => [k, [null, f[k]]])));
  const { trip } = await ownedTrip(c.env.DB, userId, id);
  return c.json({ trip: tripOut(trip) }, 201);
});

family.get('/trips/:id', async (c) => {
  const { userId } = c.get('session');
  const db = c.env.DB;
  const { trip, traveller } = await ownedTrip(db, userId, c.req.param('id'));
  const help = await db
    .prepare('SELECT id, step, created_at FROM help_alerts WHERE trip_id = ? AND resolved_at IS NULL ORDER BY created_at DESC')
    .bind(trip.id)
    .all();
  return c.json({
    trip: tripOut(trip),
    traveller: travellerOut(traveller),
    companions: await acceptedCompanions(db, trip),
    openHelpAlerts: help.results,
  });
});

family.patch('/trips/:id', async (c) => {
  const { userId } = c.get('session');
  const db = c.env.DB;
  const { trip } = await ownedTrip(db, userId, c.req.param('id'));
  const f = tripFields(await readBody(c.req), false);
  const changes: Record<string, [unknown, unknown]> = {};
  for (const k of Object.keys(f) as TripField[]) {
    if (trip[k] !== f[k]) changes[k] = [trip[k], f[k]];
  }
  const cols = Object.keys(changes) as TripField[];
  if (cols.length) {
    await db.prepare(`UPDATE trips SET ${cols.map((k) => `${k} = ?`).join(', ')}, updated_at = ? WHERE id = ?`)
      .bind(...cols.map((k) => f[k]), nowIso(), trip.id)
      .run();
    await audit(db, trip.id, userId, 'update', changes);
  }
  const { trip: updated } = await ownedTrip(db, userId, trip.id);
  return c.json({ trip: tripOut(updated) });
});

family.delete('/trips/:id', async (c) => {
  const { userId } = c.get('session');
  const { trip } = await ownedTrip(c.env.DB, userId, c.req.param('id'));
  await audit(c.env.DB, trip.id, userId, 'delete', tripOut(trip));
  await c.env.DB.prepare('DELETE FROM trips WHERE id = ?').bind(trip.id).run();
  return c.json({ ok: true });
});

family.get('/trips/:id/history', async (c) => {
  const { userId } = c.get('session');
  const { trip } = await ownedTrip(c.env.DB, userId, c.req.param('id'));
  const rows = await c.env.DB.prepare('SELECT action, changes, at FROM trip_audit WHERE trip_id = ? ORDER BY id').bind(trip.id).all<{ action: string; changes: string; at: string }>();
  return c.json({ history: rows.results.map((r) => ({ ...r, changes: JSON.parse(r.changes) })) });
});

family.get('/trips/:id/events', async (c) => {
  const { userId } = c.get('session');
  const { trip } = await ownedTrip(c.env.DB, userId, c.req.param('id'));
  const rows = await c.env.DB.prepare('SELECT id, kind, text, at FROM trip_events WHERE trip_id = ? ORDER BY id DESC LIMIT 100').bind(trip.id).all();
  return c.json({ events: rows.results });
});

family.get('/trips/:id/status', async (c) => {
  const { userId } = c.get('session');
  const { trip } = await ownedTrip(c.env.DB, userId, c.req.param('id'));
  return c.json({ status: await flightStatus(c.env, trip) });
});

// ---- Matching and introductions ------------------------------------------------

family.get('/trips/:id/matches', async (c) => {
  const { userId } = c.get('session');
  const db = c.env.DB;
  const { trip, traveller } = await ownedTrip(db, userId, c.req.param('id'));
  const filter = (c.req.query('filter') ?? 'all') as MatchFilter;
  if (!['all', 'language', 'senior', 'helper'].includes(filter)) fail(400, 'Unknown filter');

  // Arrival dates can differ from the departure date on long-haul flights, so look a day either side.
  const from = new Date(Date.parse(trip.flight_date + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
  const to = new Date(Date.parse(trip.flight_date + 'T00:00:00Z') + 2 * 86400000).toISOString().slice(0, 10);
  const candidates = await db
    .prepare(
      `SELECT t.* FROM trips t JOIN travellers tr ON tr.id = t.traveller_id
       WHERE t.seeking = 1 AND t.id != ?1 AND tr.owner_user_id != ?2 AND (
         (t.flight_number = ?3 AND t.flight_date = ?4)
         OR (t.destination = ?5 AND COALESCE(t.arrive_date, t.flight_date) BETWEEN ?6 AND ?7)
         OR (t.origin = ?8 AND t.flight_date BETWEEN ?6 AND ?7))
       LIMIT 200`,
    )
    .bind(trip.id, userId, trip.flight_number, trip.flight_date, trip.destination, from, to, trip.origin)
    .all<TripRow>();

  const me = { kind: traveller.kind, languages: parseLanguages(traveller.languages) };
  const results = [];
  for (const other of candidates.results) {
    const rel = relation(forMatch(trip), forMatch(other));
    if (!rel) continue;
    const tr = await db.prepare('SELECT * FROM travellers WHERE id = ?').bind(other.traveller_id).first<TravellerRow>();
    if (!tr) continue;
    const them = { kind: tr.kind, languages: parseLanguages(tr.languages) };
    if (!passesFilter(filter, me, them)) continue;
    const intro = await db
      .prepare(
        `SELECT id, status, from_trip_id FROM intro_requests
         WHERE (from_trip_id = ?1 AND to_trip_id = ?2) OR (from_trip_id = ?2 AND to_trip_id = ?1)`,
      )
      .bind(trip.id, other.id)
      .first<{ id: string; status: string; from_trip_id: string }>();
    const accepted = intro?.status === 'accepted';
    results.push({
      score: score(rel, sharedLanguages(me.languages, them.languages).length, !!tr.id_verified),
      sharedLanguages: sharedLanguages(me.languages, them.languages),
      intro: intro ? { id: intro.id, status: intro.status, direction: intro.from_trip_id === trip.id ? 'outgoing' : 'incoming' } : null,
      ...companionCard(tr, other, rel, trip, accepted ? await contactFor(db, tr) : null),
    });
  }
  results.sort((a, b) => b.score - a.score);
  return c.json({ trip: tripOut(trip), matches: results });
});

family.post('/trips/:id/intros', async (c) => {
  const { userId } = c.get('session');
  const db = c.env.DB;
  const { trip, traveller } = await ownedTrip(db, userId, c.req.param('id'));
  const body = await readBody(c.req);
  const toTripId = str(body, 'toTripId', { required: true, max: 64 })!;
  const message = str(body, 'message', { max: 500 });

  const target = await db
    .prepare('SELECT t.*, tr.owner_user_id FROM trips t JOIN travellers tr ON tr.id = t.traveller_id WHERE t.id = ?')
    .bind(toTripId)
    .first<TripRow & { owner_user_id: string }>();
  if (!target || !target.seeking) fail(404, 'That traveller is no longer looking for company');
  if (target.owner_user_id === userId) fail(400, 'That is one of your own trips');
  if (!relation(forMatch(trip), forMatch(target))) fail(400, 'These trips are not close enough to travel together');

  // If they already asked us, saying yes is the same as accepting their request.
  const reverse = await db
    .prepare(`SELECT id, status FROM intro_requests WHERE from_trip_id = ? AND to_trip_id = ?`)
    .bind(target.id, trip.id)
    .first<{ id: string; status: string }>();
  if (reverse?.status === 'pending') {
    await db.prepare(`UPDATE intro_requests SET status = 'accepted', responded_at = ? WHERE id = ?`).bind(nowIso(), reverse.id).run();
    await announceAccepted(c.env, reverse.id);
    return c.json({ intro: { id: reverse.id, status: 'accepted' } });
  }

  const existing = await db
    .prepare('SELECT id, status FROM intro_requests WHERE from_trip_id = ? AND to_trip_id = ?')
    .bind(trip.id, target.id)
    .first<{ id: string; status: string }>();
  if (existing && existing.status !== 'cancelled') fail(409, `You have already asked (${existing.status})`);
  const id = existing?.id ?? newId();
  await db
    .prepare(
      `INSERT INTO intro_requests (id, from_trip_id, to_trip_id, message, status) VALUES (?, ?, ?, ?, 'pending')
       ON CONFLICT(from_trip_id, to_trip_id) DO UPDATE SET status = 'pending', message = excluded.message, created_at = excluded.created_at, responded_at = NULL`,
    )
    .bind(id, trip.id, target.id, message)
    .run();

  const fromUser = await db.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first<{ name: string | null }>();
  await tellFamily(
    c.env,
    target.id,
    'intro',
    `${fromUser?.name ?? 'A family'} would like ${traveller.relation ? `their ${traveller.relation}` : traveller.name.split(' ')[0]} to travel with yours on ${target.flight_number}. Open Saathi to reply.`,
  );
  return c.json({ intro: { id, status: 'pending' } }, 201);
});

async function announceAccepted(env: AppEnv['Bindings'], introId: string) {
  const db = env.DB;
  const r = await db.prepare('SELECT from_trip_id, to_trip_id FROM intro_requests WHERE id = ?').bind(introId).first<{ from_trip_id: string; to_trip_id: string }>();
  if (!r) return;
  for (const [mine, other] of [[r.from_trip_id, r.to_trip_id], [r.to_trip_id, r.from_trip_id]]) {
    const tr = await db
      .prepare('SELECT tr.name FROM trips t JOIN travellers tr ON tr.id = t.traveller_id WHERE t.id = ?')
      .bind(other)
      .first<{ name: string }>();
    await tellFamily(env, mine, 'intro', `Introduction accepted: ${tr?.name ?? 'your companion'} will travel with you. Contact details are now in the app.`);
  }
}

family.get('/intros', async (c) => {
  const { userId } = c.get('session');
  const db = c.env.DB;
  const rows = await db
    .prepare(
      `SELECT i.*, ft.traveller_id AS from_traveller, tt.traveller_id AS to_traveller,
              ftr.owner_user_id AS from_owner, ttr.owner_user_id AS to_owner
       FROM intro_requests i
       JOIN trips ft ON ft.id = i.from_trip_id JOIN travellers ftr ON ftr.id = ft.traveller_id
       JOIN trips tt ON tt.id = i.to_trip_id JOIN travellers ttr ON ttr.id = tt.traveller_id
       WHERE (ftr.owner_user_id = ?1 OR ttr.owner_user_id = ?1) AND i.status != 'cancelled'
       ORDER BY i.created_at DESC LIMIT 100`,
    )
    .bind(userId)
    .all<{ id: string; from_trip_id: string; to_trip_id: string; message: string | null; status: string; created_at: string; from_owner: string; to_owner: string }>();
  type IntroItem = {
    id: string;
    status: string;
    message: string | null;
    createdAt: string;
    myTripId: string;
    myTraveller: { name: string; relation: string | null } | null;
    companion: ReturnType<typeof companionCard>;
  };
  const incoming: IntroItem[] = [];
  const outgoing: IntroItem[] = [];
  for (const r of rows.results) {
    const isIncoming = r.to_owner === userId;
    const myTripId = isIncoming ? r.to_trip_id : r.from_trip_id;
    const otherTripId = isIncoming ? r.from_trip_id : r.to_trip_id;
    const myTrip = await db.prepare('SELECT * FROM trips WHERE id = ?').bind(myTripId).first<TripRow>();
    const other = await db.prepare('SELECT * FROM trips WHERE id = ?').bind(otherTripId).first<TripRow>();
    if (!myTrip || !other) continue;
    const tr = await db.prepare('SELECT * FROM travellers WHERE id = ?').bind(other.traveller_id).first<TravellerRow>();
    const mineTr = await db.prepare('SELECT name, relation FROM travellers WHERE id = ?').bind(myTrip.traveller_id).first<{ name: string; relation: string | null }>();
    if (!tr) continue;
    const accepted = r.status === 'accepted';
    const item: IntroItem = {
      id: r.id,
      status: r.status,
      message: r.message,
      createdAt: r.created_at,
      myTripId,
      myTraveller: mineTr,
      companion: companionCard(tr, other, relation(forMatch(myTrip), forMatch(other)), myTrip, accepted ? await contactFor(db, tr) : null),
    };
    (isIncoming ? incoming : outgoing).push(item);
  }
  return c.json({ incoming, outgoing });
});

family.post('/intros/:id/respond', async (c) => {
  const { userId } = c.get('session');
  const db = c.env.DB;
  const body = await readBody(c.req);
  const accept = bool(body, 'accept');
  if (accept === null) fail(400, 'accept is required');
  const r = await db
    .prepare(
      `SELECT i.id, i.status, i.from_trip_id FROM intro_requests i JOIN trips t ON t.id = i.to_trip_id JOIN travellers tr ON tr.id = t.traveller_id
       WHERE i.id = ? AND tr.owner_user_id = ?`,
    )
    .bind(c.req.param('id'), userId)
    .first<{ id: string; status: string; from_trip_id: string }>();
  if (!r) fail(404, 'Request not found');
  if (r.status !== 'pending') fail(409, `This request is already ${r.status}`);
  const status = accept ? 'accepted' : 'declined';
  await db.prepare('UPDATE intro_requests SET status = ?, responded_at = ? WHERE id = ?').bind(status, nowIso(), r.id).run();
  if (accept) await announceAccepted(c.env, r.id);
  else await addEvent(db, r.from_trip_id, 'intro', 'An introduction request was declined. Other travellers may still be a good match.');
  return c.json({ intro: { id: r.id, status } });
});

family.post('/intros/:id/cancel', async (c) => {
  const { userId } = c.get('session');
  const r = await c.env.DB.prepare(
    `SELECT i.id FROM intro_requests i JOIN trips t ON t.id = i.from_trip_id JOIN travellers tr ON tr.id = t.traveller_id
     WHERE i.id = ? AND tr.owner_user_id = ? AND i.status = 'pending'`,
  )
    .bind(c.req.param('id'), userId)
    .first<{ id: string }>();
  if (!r) fail(404, 'Pending request not found');
  await c.env.DB.prepare(`UPDATE intro_requests SET status = 'cancelled', responded_at = ? WHERE id = ?`).bind(nowIso(), r.id).run();
  return c.json({ ok: true });
});

// ---- Help alerts ---------------------------------------------------------------

family.post('/help/:id/resolve', async (c) => {
  const { userId } = c.get('session');
  const db = c.env.DB;
  const h = await db
    .prepare(
      `SELECT h.id, h.trip_id FROM help_alerts h JOIN trips t ON t.id = h.trip_id JOIN travellers tr ON tr.id = t.traveller_id
       WHERE h.id = ? AND tr.owner_user_id = ? AND h.resolved_at IS NULL`,
    )
    .bind(c.req.param('id'), userId)
    .first<{ id: string; trip_id: string }>();
  if (!h) fail(404, 'Open help alert not found');
  await db.prepare('UPDATE help_alerts SET resolved_at = ? WHERE id = ?').bind(nowIso(), h.id).run();
  await addEvent(db, h.trip_id, 'help_resolved', 'Help request marked as sorted');
  return c.json({ ok: true });
});

