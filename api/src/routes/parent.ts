import { Hono } from 'hono';
import { requireParent } from '../auth';
import { acceptedCompanions, travellerOut, tripOut, type TravellerRow, type TripRow } from '../data';
import type { AppEnv } from '../env';
import { STEP_COUNT, STEP_DONE_TEXT } from '../flights';
import { sendWhatsApp, tellFamily } from '../notify';
import { fail, int, newId, readBody, str } from '../util';

/** Endpoints used by the parent's own phone, which only ever sees that parent's trips. */
export const parent = new Hono<AppEnv>();
parent.use('*', requireParent);

async function parentTrip(db: D1Database, travellerId: string, tripId: string): Promise<TripRow> {
  const trip = await db.prepare('SELECT * FROM trips WHERE id = ? AND traveller_id = ?').bind(tripId, travellerId).first<TripRow>();
  if (!trip) fail(404, 'Trip not found');
  return trip;
}

parent.get('/home', async (c) => {
  const { userId, travellerId } = c.get('session');
  const db = c.env.DB;
  const traveller = await db.prepare('SELECT * FROM travellers WHERE id = ?').bind(travellerId).first<TravellerRow>();
  if (!traveller) fail(404, 'Traveller not found');
  const familyUser = await db.prepare('SELECT name, phone FROM users WHERE id = ?').bind(userId).first<{ name: string | null; phone: string | null }>();
  // The next trip that has not finished: from yesterday onwards, in case of overnight flights.
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const trip = await db
    .prepare('SELECT * FROM trips WHERE traveller_id = ? AND flight_date >= ? AND journey_step < ? ORDER BY flight_date, depart_time LIMIT 1')
    .bind(travellerId, yesterday, STEP_COUNT)
    .first<TripRow>();
  return c.json({
    traveller: travellerOut(traveller),
    family: { name: familyUser?.name ?? null, phone: familyUser?.phone ?? null, relation: traveller.relation },
    trip: trip ? tripOut(trip) : null,
    companions: trip ? await acceptedCompanions(db, trip) : [],
  });
});

/** The parent taps "Done, next step": record progress and tell the family. */
parent.post('/trips/:id/step', async (c) => {
  const { travellerId } = c.get('session');
  const db = c.env.DB;
  const trip = await parentTrip(db, travellerId!, c.req.param('id'));
  const body = await readBody(c.req);
  const step = int(body, 'step', 0, STEP_COUNT);
  if (step === null) fail(400, 'step is required');
  if (step === trip.journey_step) return c.json({ trip: tripOut(trip) });
  await db.prepare('UPDATE trips SET journey_step = ? WHERE id = ?').bind(step, trip.id).run();
  // Announce each step completed going forwards; going back is a silent correction.
  for (let s = trip.journey_step; s < step; s++) {
    await tellFamily(c.env, trip.id, 'step', STEP_DONE_TEXT[s]);
  }
  const updated = await parentTrip(db, travellerId!, trip.id);
  return c.json({ trip: tripOut(updated) });
});

/** The big red button. Alerts the family and every accepted companion's family. */
parent.post('/trips/:id/help', async (c) => {
  const { travellerId } = c.get('session');
  const db = c.env.DB;
  const trip = await parentTrip(db, travellerId!, c.req.param('id'));
  const body = await readBody(c.req).catch(() => ({}));
  const note = str(body as Record<string, unknown>, 'note', { max: 300 });
  const traveller = await db.prepare('SELECT name, phone FROM travellers WHERE id = ?').bind(travellerId).first<{ name: string; phone: string | null }>();
  const id = newId();
  await db.prepare('INSERT INTO help_alerts (id, trip_id, step) VALUES (?, ?, ?)').bind(id, trip.id, trip.journey_step).run();
  const where = ['at check-in', 'at security', 'at the gate', 'on the plane', 'at immigration', 'at baggage claim'][trip.journey_step] ?? '';
  const text = `${traveller?.name ?? 'Your traveller'} pressed "I need help" ${where} (${trip.flight_number}).${note ? ` Note: ${note}` : ''}${traveller?.phone ? ` Call ${traveller.phone}.` : ''}`;
  await tellFamily(c.env, trip.id, 'help', text);

  for (const comp of await acceptedCompanions(db, trip)) {
    await sendWhatsApp(c.env, comp.contact?.travellerPhone ?? null, `Saathi: ${text}`);
    await sendWhatsApp(c.env, comp.contact?.familyPhone ?? null, `Saathi: ${text}`);
  }
  return c.json({ alert: { id } }, 201);
});
