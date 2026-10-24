import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { AppEnv, Session } from './env';
import { sendLoginCode } from './notify';
import { DAY_MS, EMAIL_RE, fail, newCode, newId, newToken, readBody, sha256, str } from './util';

const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const FAMILY_SESSION_MS = 90 * DAY_MS;
const PARENT_SESSION_MS = 365 * DAY_MS;

async function loadSession(c: { req: { header(name: string): string | undefined }; env: AppEnv['Bindings'] }): Promise<Session | null> {
  const header = c.req.header('Authorization') ?? '';
  const m = /^Bearer\s+(\S+)$/.exec(header);
  if (!m) return null;
  const row = await c.env.DB.prepare('SELECT user_id, kind, traveller_id, expires_at FROM sessions WHERE token_hash = ?')
    .bind(await sha256(m[1]))
    .first<{ user_id: string; kind: 'family' | 'parent'; traveller_id: string | null; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) return null;
  return { userId: row.user_id, kind: row.kind, travellerId: row.traveller_id };
}

export const requireFamily = createMiddleware<AppEnv>(async (c, next) => {
  const s = await loadSession(c);
  if (!s) fail(401, 'Please sign in');
  if (s.kind !== 'family') fail(403, 'This needs the family app');
  c.set('session', s);
  await next();
});

export const requireParent = createMiddleware<AppEnv>(async (c, next) => {
  const s = await loadSession(c);
  if (!s) fail(401, 'Please sign in');
  if (s.kind !== 'parent' || !s.travellerId) fail(403, 'This needs a paired parent phone');
  c.set('session', s);
  await next();
});

async function createSession(db: D1Database, userId: string, kind: 'family' | 'parent', travellerId: string | null) {
  const token = newToken();
  const ttl = kind === 'family' ? FAMILY_SESSION_MS : PARENT_SESSION_MS;
  await db
    .prepare('INSERT INTO sessions (token_hash, user_id, traveller_id, kind, expires_at) VALUES (?, ?, ?, ?, ?)')
    .bind(await sha256(token), userId, travellerId, kind, Date.now() + ttl)
    .run();
  return token;
}

export const auth = new Hono<AppEnv>();

/** Step 1: send a 6-digit code to the email address. */
auth.post('/start', async (c) => {
  const body = await readBody(c.req);
  const email = str(body, 'email', { required: true, max: 254 })!.toLowerCase();
  if (!EMAIL_RE.test(email)) fail(400, 'Please enter a valid email address');
  const code = newCode();
  await c.env.DB.prepare(
    `INSERT INTO login_codes (email, code_hash, expires_at, attempts) VALUES (?, ?, ?, 0)
     ON CONFLICT(email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0`,
  )
    .bind(email, await sha256(`${email}:${code}`), Date.now() + CODE_TTL_MS)
    .run();
  const sent = await sendLoginCode(c.env, email, code);
  const dev = c.env.DEV_MODE === 'true';
  return c.json({ sent, ...(dev ? { devCode: code } : {}) });
});

/** Step 2: exchange the code for a session; creates the account on first sign-in. */
auth.post('/verify', async (c) => {
  const body = await readBody(c.req);
  const email = str(body, 'email', { required: true, max: 254 })!.toLowerCase();
  const code = str(body, 'code', { required: true, max: 6 })!;
  const db = c.env.DB;
  const row = await db
    .prepare('SELECT code_hash, expires_at, attempts FROM login_codes WHERE email = ?')
    .bind(email)
    .first<{ code_hash: string; expires_at: number; attempts: number }>();
  if (!row || row.expires_at < Date.now()) fail(400, 'That code has expired. Please ask for a new one.');
  if (row.attempts >= MAX_ATTEMPTS) fail(429, 'Too many tries. Please ask for a new code.');
  if (row.code_hash !== (await sha256(`${email}:${code}`))) {
    await db.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?').bind(email).run();
    fail(400, 'That code is not right. Please check and try again.');
  }
  await db.prepare('DELETE FROM login_codes WHERE email = ?').bind(email).run();

  let user = await db.prepare('SELECT id, email, name, phone FROM users WHERE email = ?').bind(email).first<UserRow>();
  const isNew = !user;
  if (!user) {
    user = { id: newId(), email, name: null, phone: null };
    await db.prepare('INSERT INTO users (id, email) VALUES (?, ?)').bind(user.id, email).run();
  }
  const token = await createSession(db, user.id, 'family', null);
  return c.json({ token, isNew, user });
});

/** A parent's phone signs in with the 6-digit code shown in the family app. */
auth.post('/parent', async (c) => {
  const body = await readBody(c.req);
  const code = str(body, 'code', { required: true, max: 6 })!;
  const db = c.env.DB;
  const hash = await sha256(`pair:${code}`);
  const row = await db
    .prepare('SELECT traveller_id, user_id, expires_at FROM pair_codes WHERE code_hash = ?')
    .bind(hash)
    .first<{ traveller_id: string; user_id: string; expires_at: number }>();
  if (!row || row.expires_at < Date.now()) fail(400, 'That code is not right or has expired. Ask your family for a new one.');
  await db.prepare('DELETE FROM pair_codes WHERE code_hash = ?').bind(hash).run();
  const token = await createSession(db, row.user_id, 'parent', row.traveller_id);
  const traveller = await db.prepare('SELECT id, name FROM travellers WHERE id = ?').bind(row.traveller_id).first();
  return c.json({ token, traveller });
});

auth.post('/logout', async (c) => {
  const m = /^Bearer\s+(\S+)$/.exec(c.req.header('Authorization') ?? '');
  if (m) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(m[1])).run();
  return c.json({ ok: true });
});

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
}

export async function newPairCode(db: D1Database, travellerId: string, userId: string) {
  // Codes are short, so make sure the one we hand out is not already live.
  for (let i = 0; i < 5; i++) {
    const code = newCode();
    const hash = await sha256(`pair:${code}`);
    const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
    const res = await db
      .prepare('INSERT OR IGNORE INTO pair_codes (code_hash, traveller_id, user_id, expires_at) VALUES (?, ?, ?, ?)')
      .bind(hash, travellerId, userId, expiresAt)
      .run();
    if (res.meta.changes) return { code, expiresAt };
  }
  fail(409, 'Could not create a code. Please try again.');
}
