/**
 * Pulls flight details out of a pasted or forwarded booking confirmation.
 * Airline emails vary a lot, so this is deliberately forgiving: it returns
 * whatever it can find and the app asks the user to confirm before saving.
 */

export interface ParsedFlight {
  airline: string;
  flightNumber: string;
  date: string | null;
  origin: string | null;
  destination: string | null;
  departTime: string | null;
  arriveTime: string | null;
  seat: string | null;
}

export interface ParsedBooking {
  passengerName: string | null;
  flights: ParsedFlight[];
}

// Airlines commonly flown between India and North America / Europe / the Gulf.
const AIRLINES = new Set([
  'AI', 'IX', '6E', 'SG', 'QP', 'UA', 'AA', 'DL', 'AC', 'BA', 'VS', 'LH', 'LX', 'OS', 'AF', 'KL',
  'TK', 'EK', 'EY', 'QR', 'SV', 'GF', 'WY', 'SQ', 'CX', 'MH', 'TG', 'NH', 'JL', 'KU', 'UL', 'FZ', 'B6', 'AS', 'WN',
]);

const AIRPORTS: Record<string, string[]> = {
  DEL: ['delhi', 'new delhi'], BOM: ['mumbai', 'bombay'], BLR: ['bengaluru', 'bangalore'], MAA: ['chennai', 'madras'],
  HYD: ['hyderabad'], CCU: ['kolkata', 'calcutta'], AMD: ['ahmedabad'], COK: ['kochi', 'cochin'], GOI: ['goa'],
  PNQ: ['pune'], ATQ: ['amritsar'], JAI: ['jaipur'], LKO: ['lucknow'], TRV: ['thiruvananthapuram', 'trivandrum'],
  JFK: ['john f kennedy', 'jfk'], EWR: ['newark'], ORD: ['chicago', "o'hare"], SFO: ['san francisco'],
  IAD: ['washington dulles', 'dulles'], IAH: ['houston'], DFW: ['dallas'], ATL: ['atlanta'], BOS: ['boston'],
  SEA: ['seattle'], LAX: ['los angeles'], DTW: ['detroit'], CLT: ['charlotte'], PHL: ['philadelphia'],
  YYZ: ['toronto'], YVR: ['vancouver'], LHR: ['london heathrow', 'heathrow'], FRA: ['frankfurt'], MUC: ['munich'],
  ZRH: ['zurich'], VIE: ['vienna'], CDG: ['paris'], AMS: ['amsterdam'], IST: ['istanbul'], DXB: ['dubai'],
  DOH: ['doha'], AUH: ['abu dhabi'], SIN: ['singapore'], HKG: ['hong kong'],
};
const AIRPORT_CODES = new Set(Object.keys(AIRPORTS));
const CITY_TO_CODE: [RegExp, string][] = Object.entries(AIRPORTS).flatMap(([code, names]) =>
  names.map((n) => [new RegExp(`\\b${n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i'), code] as [RegExp, string]),
);

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';

const FLIGHT_RE = /\b([A-Z][A-Z0-9]|[0-9][A-Z])\s?-?\s?(\d{1,4})\b/g;
const TIME_RE = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\s*(am|pm|hrs|h)?\b/gi;
const SEAT_RE = /\bseats?\s*(?:no\.?|number|#)?\s*[:\-]?\s*(\d{1,2}[A-K])\b/i;

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toIsoDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

interface Found<T> {
  index: number;
  value: T;
}

export function findDates(text: string): Found<string>[] {
  const out: Found<string>[] = [];
  const push = (index: number, v: string | null) => {
    if (v) out.push({ index, value: v });
  };
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) push(m.index!, toIsoDate(+m[1], +m[2], +m[3]));
  // 14 Nov 2026, 14-Nov-26, 14NOV26, 14 November 2026
  for (const m of text.matchAll(new RegExp(`\\b(\\d{1,2})[\\s\\-]?${MON}[\\s\\-,]*(\\d{4}|\\d{2})\\b`, 'gi'))) {
    push(m.index!, toIsoDate(+m[3], MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]));
  }
  // Nov 14, 2026 / November 14 2026
  for (const m of text.matchAll(new RegExp(`\\b${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, 'gi'))) {
    push(m.index!, toIsoDate(+m[3], MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]));
  }
  return out.sort((a, b) => a.index - b.index);
}

export function findTimes(text: string): Found<string>[] {
  const out: Found<string>[] = [];
  for (const m of text.matchAll(TIME_RE)) {
    let h = +m[1];
    const suffix = (m[3] || '').toLowerCase();
    if (suffix === 'pm' && h < 12) h += 12;
    if (suffix === 'am' && h === 12) h = 0;
    out.push({ index: m.index!, value: `${pad(h)}:${m[2]}` });
  }
  return out;
}

export function findAirports(text: string): Found<string>[] {
  const out: Found<string>[] = [];
  for (const m of text.matchAll(/\b([A-Z]{3})\b/g)) {
    if (AIRPORT_CODES.has(m[1])) out.push({ index: m.index!, value: m[1] });
  }
  if (out.length < 2) {
    for (const [re, code] of CITY_TO_CODE) {
      const g = new RegExp(re.source, 'gi');
      for (const m of text.matchAll(g)) out.push({ index: m.index!, value: code });
    }
  }
  // Keep the first mention at each position, then drop repeats of the same airport in a row.
  out.sort((a, b) => a.index - b.index);
  return out.filter((f, i) => i === 0 || f.value !== out[i - 1].value);
}

function findPassenger(text: string): string | null {
  const m =
    /(?:passenger(?:\s+name)?|traveller|traveler|guest)s?\s*(?:\(s\))?\s*[:\-]\s*(?:\d+\.\s*)?(?:(?:MR|MRS|MS|MISS|DR)\.?\s+)?([A-Za-z]+(?:[ /][A-Za-z]+){1,3})/i.exec(text);
  if (!m) return null;
  let name = m[1].replace(/\s+(MR|MRS|MS|MISS|DR)$/i, '').trim();
  if (name.includes('/')) {
    const [last, first] = name.split('/');
    name = `${first} ${last}`;
  }
  return name
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function parseBooking(text: string): ParsedBooking {
  const flights: { index: number; airline: string; number: string }[] = [];
  for (const m of text.matchAll(FLIGHT_RE)) {
    const airline = m[1].toUpperCase();
    if (!AIRLINES.has(airline)) continue;
    // Skip things that look like flight numbers but are times or postcodes.
    const before = text.slice(Math.max(0, m.index! - 1), m.index!);
    if (/[\w:]/.test(before)) continue;
    const key = airline + m[2];
    if (flights.some((f) => f.airline + f.number === key)) continue;
    flights.push({ index: m.index!, airline, number: String(+m[2]) });
  }

  const dates = findDates(text);
  const result: ParsedFlight[] = flights.map((f, i) => {
    const end = i + 1 < flights.length ? flights[i + 1].index : Math.min(text.length, f.index + 600);
    // The first flight may be preceded by its route ("DEL → JFK  AI 101"); later legs start at their flight number.
    const start = i === 0 ? Math.max(0, f.index - 160) : f.index;
    const window = text.slice(start, end);
    const after = text.slice(f.index, end);

    const airports = findAirports(window);
    const times = findTimes(after);
    const date =
      findDates(window)[0]?.value ??
      [...dates].reverse().find((d) => d.index < f.index)?.value ??
      dates[0]?.value ??
      null;
    return {
      airline: f.airline,
      flightNumber: f.airline + f.number,
      date,
      origin: airports[0]?.value ?? null,
      destination: airports.find((a) => a.value !== airports[0]?.value)?.value ?? null,
      departTime: times[0]?.value ?? null,
      arriveTime: times[1]?.value ?? null,
      seat: SEAT_RE.exec(after)?.[1]?.toUpperCase() ?? null,
    };
  });

  return { passengerName: findPassenger(text), flights: result };
}

/** "ai 101", "AI-0101", "ai101" → { airline: "AI", flightNumber: "AI101" } */
export function normaliseFlightNumber(input: string): { airline: string; flightNumber: string } | null {
  const m = /^\s*([A-Za-z][A-Za-z0-9]|[0-9][A-Za-z])\s?-?\s?(\d{1,4})\s*$/.exec(input);
  if (!m) return null;
  const airline = m[1].toUpperCase();
  return { airline, flightNumber: airline + String(+m[2]) };
}
