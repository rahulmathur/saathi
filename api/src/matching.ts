/**
 * Decides whether two trips are close enough for their travellers to keep
 * each other company, and ranks the candidates.
 */

export type Relation = 'same_flight' | 'same_arrival' | 'same_departure';
export type MatchFilter = 'all' | 'language' | 'senior' | 'helper';

export interface TripForMatch {
  flightNumber: string;
  flightDate: string;
  origin: string;
  destination: string;
  departTime: string | null;
  arriveTime: string | null;
  arriveDate: string | null;
}

export interface TravellerForMatch {
  kind: 'senior' | 'helper';
  languages: string[];
}

/** Two arrivals or departures this close together count as "together". */
export const WINDOW_MINUTES = 90;

function minutes(date: string, time: string): number {
  const [h, m] = time.split(':').map(Number);
  return Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / 60000 + h * 60 + m;
}

export function relation(a: TripForMatch, b: TripForMatch): Relation | null {
  if (a.flightNumber === b.flightNumber && a.flightDate === b.flightDate) return 'same_flight';
  if (a.destination === b.destination && a.arriveTime && b.arriveTime) {
    const da = a.arriveDate ?? a.flightDate;
    const db = b.arriveDate ?? b.flightDate;
    if (Math.abs(minutes(da, a.arriveTime) - minutes(db, b.arriveTime)) <= WINDOW_MINUTES) return 'same_arrival';
  }
  if (a.origin === b.origin && a.departTime && b.departTime) {
    if (Math.abs(minutes(a.flightDate, a.departTime) - minutes(b.flightDate, b.departTime)) <= WINDOW_MINUTES) {
      return 'same_departure';
    }
  }
  return null;
}

/** Minutes between the two trips' arrivals (or departures), for display. */
export function gapMinutes(rel: Relation, a: TripForMatch, b: TripForMatch): number | null {
  if (rel === 'same_arrival' && a.arriveTime && b.arriveTime) {
    return Math.abs(minutes(a.arriveDate ?? a.flightDate, a.arriveTime) - minutes(b.arriveDate ?? b.flightDate, b.arriveTime));
  }
  if (rel === 'same_departure' && a.departTime && b.departTime) {
    return Math.abs(minutes(a.flightDate, a.departTime) - minutes(b.flightDate, b.departTime));
  }
  return null;
}

export function sharedLanguages(a: string[], b: string[]): string[] {
  const lower = new Set(a.map((x) => x.toLowerCase()));
  return b.filter((x) => lower.has(x.toLowerCase()));
}

/**
 * Nearly everyone lists English, so for this filter a match means sharing
 * another language (Hindi, Tamil, ...). Only an English-only traveller
 * matches on English.
 */
export function homeLanguageMatch(mine: string[], theirs: string[]): boolean {
  const shared = sharedLanguages(mine, theirs);
  const nonEnglish = (l: string[]) => l.filter((x) => x.toLowerCase() !== 'english');
  if (nonEnglish(mine).length === 0) return shared.length > 0;
  return nonEnglish(shared).length > 0;
}

const BASE: Record<Relation, number> = { same_flight: 100, same_arrival: 60, same_departure: 50 };

export function score(rel: Relation, shared: number, verified: boolean): number {
  return BASE[rel] + Math.min(shared, 3) * 10 + (verified ? 5 : 0);
}

export function passesFilter(filter: MatchFilter, me: TravellerForMatch, them: TravellerForMatch): boolean {
  switch (filter) {
    case 'language':
      return homeLanguageMatch(me.languages, them.languages);
    case 'senior':
      return them.kind === 'senior';
    case 'helper':
      return them.kind === 'helper';
    default:
      return true;
  }
}

/** "Meera Joshi" → "Meera J." — full names are shared only after an introduction is accepted. */
export function privateName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return parts[0] ?? '';
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.charAt(0) ?? '') + (parts.length > 1 ? parts[parts.length - 1].charAt(0) : '')).toUpperCase();
}
