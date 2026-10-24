import { describe, expect, it } from 'vitest';
import { gapMinutes, initials, passesFilter, privateName, relation, score, type TripForMatch } from '../src/matching';

const base: TripForMatch = {
  flightNumber: 'AI101',
  flightDate: '2026-11-14',
  origin: 'DEL',
  destination: 'JFK',
  departTime: '02:10',
  arriveTime: '07:45',
  arriveDate: '2026-11-14',
};

describe('relation', () => {
  it('matches the same flight on the same day', () => {
    expect(relation(base, { ...base })).toBe('same_flight');
  });
  it('does not match the same flight on another day', () => {
    expect(relation(base, { ...base, flightDate: '2026-11-15', arriveDate: '2026-11-15' })).toBeNull();
  });
  it('matches different flights landing at the same airport within 90 minutes', () => {
    const other = { ...base, flightNumber: 'UA83', origin: 'BOM', departTime: '01:00', arriveTime: '08:25' };
    expect(relation(base, other)).toBe('same_arrival');
    expect(gapMinutes('same_arrival', base, other)).toBe(40);
  });
  it('handles arrivals either side of midnight', () => {
    const a = { ...base, arriveTime: '23:30', arriveDate: '2026-11-14' };
    const b = { ...base, flightNumber: 'EK201', origin: 'DXB', arriveTime: '00:20', arriveDate: '2026-11-15' };
    expect(relation(a, b)).toBe('same_arrival');
  });
  it('matches departures from the same airport within 90 minutes', () => {
    const other = { ...base, flightNumber: 'LH761', destination: 'FRA', departTime: '03:05', arriveTime: '08:00' };
    expect(relation(base, other)).toBe('same_departure');
  });
  it('ignores trips too far apart', () => {
    const other = { ...base, flightNumber: 'UA83', origin: 'BOM', departTime: '01:00', arriveTime: '11:00' };
    expect(relation(base, other)).toBeNull();
  });
});

describe('ranking and filters', () => {
  it('ranks the same flight above a nearby arrival, and shared languages higher', () => {
    expect(score('same_flight', 0, false)).toBeGreaterThan(score('same_arrival', 3, true));
    expect(score('same_flight', 2, false)).toBeGreaterThan(score('same_flight', 1, false));
  });
  it('filters by shared language and traveller kind', () => {
    const me = { kind: 'senior' as const, languages: ['Hindi', 'English'] };
    expect(passesFilter('language', me, { kind: 'senior', languages: ['hindi'] })).toBe(true);
    expect(passesFilter('language', me, { kind: 'senior', languages: ['Tamil'] })).toBe(false);
    expect(passesFilter('language', me, { kind: 'senior', languages: ['Tamil', 'English'] })).toBe(false);
    expect(passesFilter('language', { kind: 'senior', languages: ['English'] }, { kind: 'senior', languages: ['English'] })).toBe(true);
    expect(passesFilter('helper', me, { kind: 'helper', languages: [] })).toBe(true);
    expect(passesFilter('senior', me, { kind: 'helper', languages: [] })).toBe(false);
  });
});

describe('names', () => {
  it('hides surnames until an introduction is accepted', () => {
    expect(privateName('Meera Joshi')).toBe('Meera J.');
    expect(privateName('Meera')).toBe('Meera');
    expect(initials('Ramesh Kumar Gupta')).toBe('RG');
  });
});
