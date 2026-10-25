import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { EMAIL_RE, fail, newId, readBody, sha256, str } from '../util';

/**
 * Website survey, waitlist, stories and contact form. Public and unauthenticated, so each
 * endpoint has a honeypot field and a per-visitor rate limit.
 */
export const feedback = new Hono<AppEnv>();

const ROLES = ['family', 'traveller', 'helper', 'other'];
const PER_HOUR = 5;
/** Free-text answers are read in the CSV export, not counted. */
const FREE_TEXT = new Set(['comments', 'competitor_name']);

async function visitorHash(c: { req: { header(n: string): string | undefined } }): Promise<string> {
  const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
  // Salted by day so the stored value cannot be used to track anyone over time.
  return sha256(`${ip}:${new Date().toISOString().slice(0, 10)}`);
}

async function limitSurvey(db: D1Database, ipHash: string) {
  const since = new Date(Date.now() - 3600_000).toISOString();
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM survey_responses WHERE ip_hash = ? AND created_at > ?')
    .bind(ipHash, since)
    .first<{ n: number }>();
  if ((row?.n ?? 0) >= PER_HOUR) fail(429, 'Thank you! We already have your answers.');
}

function cleanAnswers(raw: unknown): Record<string, string | string[] | number> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail(400, 'answers must be an object');
  const out: Record<string, string | string[] | number> = {};
  const entries = Object.entries(raw as Record<string, unknown>);
  if (entries.length > 40) fail(400, 'Too many answers');
  for (const [k, v] of entries) {
    if (!/^[a-z_]{1,40}$/.test(k)) continue;
    if (typeof v === 'string') out[k] = v.slice(0, 2000);
    else if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (Array.isArray(v)) out[k] = v.filter((x) => typeof x === 'string').slice(0, 20).map((x) => (x as string).slice(0, 200));
  }
  return out;
}

feedback.post('/survey', async (c) => {
  const body = await readBody(c.req);
  if (body.website) return c.json({ ok: true }); // honeypot: bots fill every field
  const role = str(body, 'role', { required: true, max: 20 })!;
  if (!ROLES.includes(role)) fail(400, 'Please choose who you are');
  const email = str(body, 'email', { max: 254 })?.toLowerCase() ?? null;
  if (email && !EMAIL_RE.test(email)) fail(400, 'Please check your email address');
  const answers = cleanAnswers(body.answers);
  const ipHash = await visitorHash(c);
  await limitSurvey(c.env.DB, ipHash);
  const db = c.env.DB;
  await db
    .prepare('INSERT INTO survey_responses (id, role, answers, email, may_contact, may_quote, ip_hash) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .bind(newId(), role, JSON.stringify(answers), email, body.mayContact === true ? 1 : 0, body.mayQuote === true ? 1 : 0, ipHash)
    .run();
  if (email && body.mayContact === true) {
    await db.prepare('INSERT OR IGNORE INTO waitlist (email, role, source) VALUES (?, ?, ?)').bind(email, role, 'survey').run();
  }
  return c.json({ ok: true }, 201);
});

feedback.post('/waitlist', async (c) => {
  const body = await readBody(c.req);
  if (body.website) return c.json({ ok: true });
  const email = str(body, 'email', { required: true, max: 254 })!.toLowerCase();
  if (!EMAIL_RE.test(email)) fail(400, 'Please check your email address');
  const platform = str(body, 'platform', { max: 10 });
  if (platform && !['ios', 'android', 'either'].includes(platform)) fail(400, 'Unknown platform');
  await c.env.DB.prepare(
    `INSERT INTO waitlist (email, role, platform, source) VALUES (?, ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET platform = COALESCE(excluded.platform, waitlist.platform)`,
  )
    .bind(email, str(body, 'role', { max: 20 }), platform, str(body, 'source', { max: 40 }))
    .run();
  return c.json({ ok: true }, 201);
});

feedback.post('/stories', async (c) => {
  const body = await readBody(c.req);
  if (body.website) return c.json({ ok: true });
  const email = str(body, 'email', { max: 254 })?.toLowerCase() ?? null;
  if (email && !EMAIL_RE.test(email)) fail(400, 'Please check your email address');
  await c.env.DB.prepare('INSERT INTO stories (id, name, location, story, email) VALUES (?, ?, ?, ?, ?)')
    .bind(newId(), str(body, 'name', { required: true, max: 80 }), str(body, 'location', { max: 80 }), str(body, 'story', { required: true, max: 2000 }), email)
    .run();
  return c.json({ ok: true }, 201);
});

feedback.get('/stories', async (c) => {
  const rows = await c.env.DB.prepare('SELECT name, location, story, created_at FROM stories WHERE approved = 1 ORDER BY created_at DESC LIMIT 12').all();
  return c.json({ stories: rows.results });
});

const TOPICS = ['question', 'privacy', 'partnership', 'other'];

/** The website's contact form; there is no public email address yet. */
feedback.post('/messages', async (c) => {
  const body = await readBody(c.req);
  if (body.website) return c.json({ ok: true });
  const email = str(body, 'email', { required: true, max: 254 })!.toLowerCase();
  if (!EMAIL_RE.test(email)) fail(400, 'Please check your email address so we can reply');
  const topic = str(body, 'topic', { max: 20 }) ?? 'question';
  if (!TOPICS.includes(topic)) fail(400, 'Please choose what your message is about');
  const ipHash = await visitorHash(c);
  const since = new Date(Date.now() - 3600_000).toISOString();
  const recent = await c.env.DB.prepare('SELECT COUNT(*) AS n FROM messages WHERE ip_hash = ? AND created_at > ?').bind(ipHash, since).first<{ n: number }>();
  if ((recent?.n ?? 0) >= PER_HOUR) fail(429, 'Thank you, we have your messages. We will reply soon.');
  await c.env.DB.prepare('INSERT INTO messages (id, name, email, topic, message, ip_hash) VALUES (?, ?, ?, ?, ?, ?)')
    .bind(newId(), str(body, 'name', { required: true, max: 80 }), email, topic, str(body, 'message', { required: true, max: 4000 }), ipHash)
    .run();
  return c.json({ ok: true }, 201);
});

// ---- Results, for the team -----------------------------------------------------

export const admin = new Hono<AppEnv>();

admin.use('*', async (c, next) => {
  const token = c.env.ADMIN_TOKEN;
  if (!token || c.req.header('Authorization') !== `Bearer ${token}`) fail(401, 'Admin token required');
  await next();
});

/** Counts for every multiple-choice question, plus totals. */
admin.get('/survey/summary', async (c) => {
  const db = c.env.DB;
  const rows = await db.prepare('SELECT role, answers FROM survey_responses').all<{ role: string; answers: string }>();
  const totals = { responses: rows.results.length, byRole: {} as Record<string, number> };
  const questions: Record<string, Record<string, number>> = {};
  for (const r of rows.results) {
    totals.byRole[r.role] = (totals.byRole[r.role] ?? 0) + 1;
    const a = JSON.parse(r.answers) as Record<string, unknown>;
    for (const [q, v] of Object.entries(a)) {
      if (FREE_TEXT.has(q)) continue;
      const vals = Array.isArray(v) ? v : typeof v === 'string' && v.length <= 60 ? [v] : typeof v === 'number' ? [String(v)] : [];
      for (const x of vals) {
        questions[q] ??= {};
        questions[q][x as string] = (questions[q][x as string] ?? 0) + 1;
      }
    }
  }
  const waitlist = await db.prepare('SELECT COUNT(*) AS n FROM waitlist').first<{ n: number }>();
  return c.json({ ...totals, waitlist: waitlist?.n ?? 0, questions });
});

admin.get('/survey/export.csv', async (c) => {
  const rows = await c.env.DB.prepare('SELECT created_at, role, email, may_contact, may_quote, answers FROM survey_responses ORDER BY created_at').all<{
    created_at: string;
    role: string;
    email: string | null;
    may_contact: number;
    may_quote: number;
    answers: string;
  }>();
  const keys = new Set<string>();
  const parsed = rows.results.map((r) => {
    const a = JSON.parse(r.answers) as Record<string, unknown>;
    Object.keys(a).forEach((k) => keys.add(k));
    return { ...r, a };
  });
  const cols = [...keys].sort();
  const esc = (v: unknown) => {
    const s = Array.isArray(v) ? v.join('; ') : v === null || v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [['created_at', 'role', 'email', 'may_contact', 'may_quote', ...cols].join(',')];
  for (const r of parsed) lines.push([r.created_at, r.role, r.email, r.may_contact, r.may_quote, ...cols.map((k) => r.a[k])].map(esc).join(','));
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="saathi-survey.csv"' } });
});

admin.get('/stories', async (c) => {
  const rows = await c.env.DB.prepare('SELECT * FROM stories ORDER BY created_at DESC').all();
  return c.json({ stories: rows.results });
});

admin.post('/stories/:id/approve', async (c) => {
  await c.env.DB.prepare('UPDATE stories SET approved = 1 WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});

/** Contact-form messages, newest first; ?all=1 includes ones already handled. */
admin.get('/messages', async (c) => {
  const all = c.req.query('all') === '1';
  const rows = await c.env.DB.prepare(
    `SELECT id, name, email, topic, message, handled, created_at FROM messages ${all ? '' : 'WHERE handled = 0'} ORDER BY created_at DESC LIMIT 200`,
  ).all();
  return c.json({ messages: rows.results });
});

admin.post('/messages/:id/handled', async (c) => {
  await c.env.DB.prepare('UPDATE messages SET handled = 1 WHERE id = ?').bind(c.req.param('id')).run();
  return c.json({ ok: true });
});
