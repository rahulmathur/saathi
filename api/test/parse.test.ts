import { describe, expect, it } from 'vitest';
import { findDates, normaliseFlightNumber, parseBooking } from '../src/parse';

describe('normaliseFlightNumber', () => {
  it('accepts the usual ways people type flight numbers', () => {
    expect(normaliseFlightNumber('AI 101')).toEqual({ airline: 'AI', flightNumber: 'AI101' });
    expect(normaliseFlightNumber('ai101')).toEqual({ airline: 'AI', flightNumber: 'AI101' });
    expect(normaliseFlightNumber('6E-0023')).toEqual({ airline: '6E', flightNumber: '6E23' });
  });
  it('rejects things that are not flight numbers', () => {
    expect(normaliseFlightNumber('hello')).toBeNull();
    expect(normaliseFlightNumber('AI 12345')).toBeNull();
  });
});

describe('findDates', () => {
  it('reads the common airline date formats', () => {
    expect(findDates('Date: 2026-11-14').map((d) => d.value)).toEqual(['2026-11-14']);
    expect(findDates('Thu, 14 Nov 2026').map((d) => d.value)).toEqual(['2026-11-14']);
    expect(findDates('DEPARTS 14NOV26').map((d) => d.value)).toEqual(['2026-11-14']);
    expect(findDates('November 14, 2026').map((d) => d.value)).toEqual(['2026-11-14']);
  });
  it('ignores impossible dates', () => {
    expect(findDates('31 Feb 2026')).toEqual([]);
  });
});

describe('parseBooking', () => {
  it('reads an Air India style confirmation', () => {
    const text = `
      Booking Reference: X7K2LP
      Passenger: SHARMA/SUSHILA MRS
      Flight AI 101  Thu, 14 Nov 2026
      Delhi (DEL) Terminal 3  02:10  ->  New York (JFK) Terminal 4  07:45
      Seat: 32C   Economy
    `;
    const r = parseBooking(text);
    expect(r.passengerName).toBe('Sushila Sharma');
    expect(r.flights).toEqual([
      { airline: 'AI', flightNumber: 'AI101', date: '2026-11-14', origin: 'DEL', destination: 'JFK', departTime: '02:10', arriveTime: '07:45', seat: '32C' },
    ]);
  });

  it('reads a two-leg itinerary with 12-hour times and city names', () => {
    const text = `
      Traveler: Mahesh Sharma
      Flight 1: LH 761 on 6 Jan 2027, Delhi 3:05 AM to Frankfurt 8:00 AM
      Flight 2: LH 400 on 6 Jan 2027, Frankfurt 10:15 AM to New York JFK 1:05 PM
    `;
    const r = parseBooking(text);
    expect(r.passengerName).toBe('Mahesh Sharma');
    expect(r.flights.map((f) => [f.flightNumber, f.date, f.origin, f.destination, f.departTime, f.arriveTime])).toEqual([
      ['LH761', '2027-01-06', 'DEL', 'FRA', '03:05', '08:00'],
      ['LH400', '2027-01-06', 'FRA', 'JFK', '10:15', '13:05'],
    ]);
  });

  it('does not mistake times or reference codes for flights', () => {
    expect(parseBooking('Check-in closes at 10:45. Reference AB1234X.').flights).toEqual([]);
  });
});
