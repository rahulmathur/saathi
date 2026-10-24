import { gapMinutes, initials, privateName, relation, type Relation, type TripForMatch } from './matching';
import { fail, parseLanguages } from './util';

export interface TravellerRow {
  id: string;
  owner_user_id: string;
  name: string;
  relation: string | null;
  age: number | null;
  kind: 'senior' | 'helper';
  home_city: string | null;
  visiting_city: string | null;
  languages: string;
  diet: string | null;
  mobility: string | null;
  phone: string | null;
  about: string | null;
  id_verified: number;
  vouched_by: string | null;
  created_at: string;
}

export interface TripRow {
  id: string;
  traveller_id: string;
  airline: string;
  flight_number: string;
  flight_date: string;
  origin: string;
  destination: string;
  depart_time: string | null;
  arrive_time: string | null;
  arrive_date: string | null;
  seat: string | null;
  wheelchair: number;
  seeking: number;
  journey_step: number;
  created_at: string;
  updated_at: string;
}

export function travellerOut(t: TravellerRow) {
  return {
    id: t.id,
    name: t.name,
    relation: t.relation,
    initials: initials(t.name),
    age: t.age,
    kind: t.kind,
    homeCity: t.home_city,
    visitingCity: t.visiting_city,
    languages: parseLanguages(t.languages),
    diet: t.diet,
    mobility: t.mobility,
    phone: t.phone,
    about: t.about,
    idVerified: !!t.id_verified,
    vouchedBy: t.vouched_by,
  };
}

export function tripOut(t: TripRow) {
  return {
    id: t.id,
    travellerId: t.traveller_id,
    airline: t.airline,
    flightNumber: t.flight_number,
    flightDate: t.flight_date,
    origin: t.origin,
    destination: t.destination,
    departTime: t.depart_time,
    arriveTime: t.arrive_time,
    arriveDate: t.arrive_date,
    seat: t.seat,
    wheelchair: !!t.wheelchair,
    seeking: !!t.seeking,
    journeyStep: t.journey_step,
    updatedAt: t.updated_at,
  };
}

export function forMatch(t: TripRow): TripForMatch {
  return {
    flightNumber: t.flight_number,
    flightDate: t.flight_date,
    origin: t.origin,
    destination: t.destination,
    departTime: t.depart_time,
    arriveTime: t.arrive_time,
    arriveDate: t.arrive_date,
  };
}

export interface Contact {
  familyName: string | null;
  familyPhone: string | null;
  travellerPhone: string | null;
}

/**
 * How one traveller appears to another family. Before an introduction is
 * accepted it carries no surname, seat or phone numbers.
 */
export function companionCard(
  tr: TravellerRow,
  trip: TripRow,
  rel: Relation | null,
  mine: TripRow | null,
  contact: Contact | null,
) {
  const revealed = contact !== null;
  return {
    tripId: trip.id,
    travellerId: tr.id,
    name: revealed ? tr.name : privateName(tr.name),
    initials: initials(tr.name),
    age: tr.age,
    kind: tr.kind,
    homeCity: tr.home_city,
    visitingCity: tr.visiting_city,
    languages: parseLanguages(tr.languages),
    diet: tr.diet,
    mobility: tr.mobility,
    about: tr.about,
    idVerified: !!tr.id_verified,
    vouchedBy: tr.vouched_by,
    relation: rel,
    gapMinutes: rel && mine ? gapMinutes(rel, forMatch(mine), forMatch(trip)) : null,
    flightNumber: trip.flight_number,
    flightDate: trip.flight_date,
    origin: trip.origin,
    destination: trip.destination,
    departTime: trip.depart_time,
    arriveTime: trip.arrive_time,
    seat: revealed ? trip.seat : null,
    contact,
  };
}

export async function ownedTraveller(db: D1Database, userId: string, id: string): Promise<TravellerRow> {
  const t = await db.prepare('SELECT * FROM travellers WHERE id = ? AND owner_user_id = ?').bind(id, userId).first<TravellerRow>();
  if (!t) fail(404, 'Traveller not found');
  return t;
}

export async function ownedTrip(db: D1Database, userId: string, id: string): Promise<{ trip: TripRow; traveller: TravellerRow }> {
  const trip = await db
    .prepare('SELECT t.* FROM trips t JOIN travellers tr ON tr.id = t.traveller_id WHERE t.id = ? AND tr.owner_user_id = ?')
    .bind(id, userId)
    .first<TripRow>();
  if (!trip) fail(404, 'Trip not found');
  const traveller = await db.prepare('SELECT * FROM travellers WHERE id = ?').bind(trip.traveller_id).first<TravellerRow>();
  return { trip, traveller: traveller! };
}

export async function contactFor(db: D1Database, tr: TravellerRow): Promise<Contact> {
  const owner = await db.prepare('SELECT name, phone FROM users WHERE id = ?').bind(tr.owner_user_id).first<{ name: string | null; phone: string | null }>();
  return { familyName: owner?.name ?? null, familyPhone: owner?.phone ?? null, travellerPhone: tr.phone };
}

/** Companions whose introduction with this trip has been accepted, with contact details. */
export async function acceptedCompanions(db: D1Database, trip: TripRow) {
  const rows = await db
    .prepare(
      `SELECT CASE WHEN from_trip_id = ?1 THEN to_trip_id ELSE from_trip_id END AS other_id
       FROM intro_requests WHERE status = 'accepted' AND (from_trip_id = ?1 OR to_trip_id = ?1)`,
    )
    .bind(trip.id)
    .all<{ other_id: string }>();
  const out = [];
  for (const r of rows.results) {
    const other = await db.prepare('SELECT * FROM trips WHERE id = ?').bind(r.other_id).first<TripRow>();
    if (!other) continue;
    const tr = await db.prepare('SELECT * FROM travellers WHERE id = ?').bind(other.traveller_id).first<TravellerRow>();
    if (!tr) continue;
    out.push(companionCard(tr, other, relation(forMatch(trip), forMatch(other)), trip, await contactFor(db, tr)));
  }
  return out;
}
