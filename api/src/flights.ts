import type { Env } from './env';

export type FlightState = 'scheduled' | 'boarding' | 'in_air' | 'landed' | 'cancelled' | 'unknown';

export interface FlightStatus {
  provider: 'mock' | 'flightaware';
  state: FlightState;
  label: string;
  progressPercent: number;
  departedAt: string | null;
  estimatedArrival: string | null;
}

interface TripRow {
  flight_number: string;
  flight_date: string;
  journey_step: number;
}

/** The six journey steps the parent app walks through, and what the family sees when each is done. */
export const STEP_DONE_TEXT = [
  'Checked in',
  'Cleared security',
  'Boarded the plane',
  'Landed',
  'Cleared immigration',
  'Collected bags and met the family',
];
export const STEP_COUNT = STEP_DONE_TEXT.length;

/** Simulated status that follows the parent's progress through the journey. */
function mockStatus(trip: TripRow): FlightStatus {
  const s = trip.journey_step;
  const state: FlightState = s <= 1 ? 'scheduled' : s === 2 ? 'boarding' : s === 3 ? 'in_air' : 'landed';
  const progress = s <= 2 ? 0 : s === 3 ? 50 : 100;
  const label = { scheduled: 'On time', boarding: 'Boarding', in_air: 'In the air', landed: 'Landed' }[state as 'scheduled'];
  return { provider: 'mock', state, label, progressPercent: progress, departedAt: null, estimatedArrival: null };
}

interface AeroFlight {
  status?: string;
  progress_percent?: number;
  cancelled?: boolean;
  actual_off?: string | null;
  actual_on?: string | null;
  estimated_on?: string | null;
  scheduled_out?: string | null;
}

async function flightAwareStatus(env: Env, trip: TripRow): Promise<FlightStatus> {
  const start = trip.flight_date;
  const end = new Date(Date.parse(trip.flight_date + 'T00:00:00Z') + 2 * 86400000).toISOString().slice(0, 10);
  const url = `https://aeroapi.flightaware.com/aeroapi/flights/${encodeURIComponent(trip.flight_number)}?start=${start}&end=${end}`;
  const res = await fetch(url, { headers: { 'x-apikey': env.FLIGHTAWARE_API_KEY! } });
  if (!res.ok) throw new Error(`AeroAPI ${res.status}`);
  const data = (await res.json()) as { flights?: AeroFlight[] };
  const f = data.flights?.[0];
  if (!f) return { provider: 'flightaware', state: 'unknown', label: 'No data yet', progressPercent: 0, departedAt: null, estimatedArrival: null };
  const state: FlightState = f.cancelled
    ? 'cancelled'
    : f.actual_on
      ? 'landed'
      : f.actual_off
        ? 'in_air'
        : 'scheduled';
  return {
    provider: 'flightaware',
    state,
    label: f.status ?? state,
    progressPercent: f.progress_percent ?? (state === 'landed' ? 100 : 0),
    departedAt: f.actual_off ?? null,
    estimatedArrival: f.estimated_on ?? null,
  };
}

export async function flightStatus(env: Env, trip: TripRow): Promise<FlightStatus> {
  if (env.FLIGHT_PROVIDER === 'flightaware' && env.FLIGHTAWARE_API_KEY) {
    try {
      return await flightAwareStatus(env, trip);
    } catch (e) {
      console.error('Flight status lookup failed, using simulated status', e);
    }
  }
  return mockStatus(trip);
}
