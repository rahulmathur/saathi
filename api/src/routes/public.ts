import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { fail, isValidDate } from '../util';

/**
 * The public flight grid from the original brief: which flights on which
 * dates have Saathi travellers looking for company. No personal details.
 */
export const publicRoutes = new Hono<AppEnv>();

publicRoutes.get('/grid', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const from = c.req.query('from') ?? today;
  const to = c.req.query('to') ?? new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  if (!isValidDate(from) || !isValidDate(to)) fail(400, 'from and to must be YYYY-MM-DD');
  if (Date.parse(to) - Date.parse(from) > 92 * 86400000) fail(400, 'Please ask for 3 months or less');
  const airline = c.req.query('airline')?.toUpperCase() ?? null;
  const flight = c.req.query('flight')?.toUpperCase().replace(/\s+/g, '') ?? null;
  const rows = await c.env.DB.prepare(
    `SELECT flight_date AS date, flight_number AS flightNumber, airline, origin, destination, COUNT(*) AS travellers
     FROM trips
     WHERE seeking = 1 AND flight_date BETWEEN ?1 AND ?2
       AND (?3 IS NULL OR airline = ?3) AND (?4 IS NULL OR flight_number = ?4)
     GROUP BY flight_date, flight_number, airline, origin, destination
     ORDER BY flight_date, flight_number`,
  )
    .bind(from, to, airline, flight)
    .all();
  return c.json({ from, to, flights: rows.results });
});
