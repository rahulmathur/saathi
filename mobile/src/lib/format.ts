import type { Relation } from './types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const MONTHS_HI = ['जनवरी', 'फ़रवरी', 'मार्च', 'अप्रैल', 'मई', 'जून', 'जुलाई', 'अगस्त', 'सितंबर', 'अक्टूबर', 'नवंबर', 'दिसंबर'];
const DAYS_HI = ['रविवार', 'सोमवार', 'मंगलवार', 'बुधवार', 'गुरुवार', 'शुक्रवार', 'शनिवार'];

function parts(iso: string) {
  const d = new Date(iso + 'T00:00:00Z');
  return { day: d.getUTCDay(), date: d.getUTCDate(), month: d.getUTCMonth(), year: d.getUTCFullYear() };
}

/** "Thu, 14 Nov" */
export function shortDate(iso: string): string {
  const p = parts(iso);
  return `${DAYS[p.day]}, ${p.date} ${MONTHS[p.month]}`;
}

/** "Thursday, 14 November" (or Hindi) */
export function longDate(iso: string, lang: 'en' | 'hi' = 'en'): string {
  const p = parts(iso);
  return lang === 'hi' ? `${DAYS_HI[p.day]}, ${p.date} ${MONTHS_HI[p.month]}` : `${DAYS_LONG[p.day]}, ${p.date} ${MONTHS_LONG[p.month]}`;
}

export function todayLong(): string {
  const d = new Date();
  return `${DAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS_LONG[d.getMonth()]}`;
}

export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "AI101" → "AI 101" */
export function flightLabel(fn: string): string {
  return fn.replace(/^([A-Z0-9]{2})(\d+)$/, '$1 $2');
}

export function relationLabel(rel: Relation | null, gap: number | null, seat: string | null): string {
  if (rel === 'same_flight') return seat ? `Same flight · Seat ${seat}` : 'Same flight';
  if (rel === 'same_arrival') return gap !== null ? `Lands ${gap} min apart` : 'Lands around the same time';
  if (rel === 'same_departure') return gap !== null ? `Leaves ${gap} min apart` : 'Leaves around the same time';
  return '';
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function clock(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Airport code to city name for the common routes; falls back to the code. */
const CITY: Record<string, string> = {
  DEL: 'Delhi', BOM: 'Mumbai', BLR: 'Bengaluru', MAA: 'Chennai', HYD: 'Hyderabad', CCU: 'Kolkata', AMD: 'Ahmedabad',
  COK: 'Kochi', GOI: 'Goa', PNQ: 'Pune', ATQ: 'Amritsar', JAI: 'Jaipur', LKO: 'Lucknow', TRV: 'Thiruvananthapuram',
  JFK: 'New York', EWR: 'Newark', ORD: 'Chicago', SFO: 'San Francisco', IAD: 'Washington', IAH: 'Houston',
  DFW: 'Dallas', ATL: 'Atlanta', BOS: 'Boston', SEA: 'Seattle', LAX: 'Los Angeles', DTW: 'Detroit', CLT: 'Charlotte',
  PHL: 'Philadelphia', YYZ: 'Toronto', YVR: 'Vancouver', LHR: 'London', FRA: 'Frankfurt', MUC: 'Munich', ZRH: 'Zurich',
  VIE: 'Vienna', CDG: 'Paris', AMS: 'Amsterdam', IST: 'Istanbul', DXB: 'Dubai', DOH: 'Doha', AUH: 'Abu Dhabi',
  SIN: 'Singapore', HKG: 'Hong Kong',
};
const CITY_HI: Record<string, string> = {
  DEL: 'दिल्ली', BOM: 'मुंबई', BLR: 'बेंगलुरु', MAA: 'चेन्नई', HYD: 'हैदराबाद', CCU: 'कोलकाता', AMD: 'अहमदाबाद',
  JFK: 'न्यूयॉर्क', EWR: 'नेवार्क', ORD: 'शिकागो', SFO: 'सैन फ़्रांसिस्को', IAD: 'वॉशिंगटन', IAH: 'ह्यूस्टन', DFW: 'डैलस',
  ATL: 'अटलांटा', BOS: 'बोस्टन', SEA: 'सिएटल', LAX: 'लॉस एंजेलिस', YYZ: 'टोरंटो', LHR: 'लंदन', FRA: 'फ़्रैंकफ़र्ट',
  DXB: 'दुबई', DOH: 'दोहा', AUH: 'अबू धाबी',
};
export function city(code: string, lang: 'en' | 'hi' = 'en'): string {
  return (lang === 'hi' ? CITY_HI[code] : undefined) ?? CITY[code] ?? code;
}
