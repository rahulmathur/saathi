import { HTTPException } from 'hono/http-exception';

export const DAY_MS = 24 * 60 * 60 * 1000;

export function newId(): string {
  return crypto.randomUUID();
}

export function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A 6-digit numeric code, uniformly distributed. */
export function newCode(): string {
  const limit = 4_294_000_000; // largest multiple of 1e6 below 2^32, avoids modulo bias
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limit);
  return String(buf[0] % 1_000_000).padStart(6, '0');
}

export async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function fail(status: 400 | 401 | 403 | 404 | 409 | 429, message: string): never {
  throw new HTTPException(status, { message });
}

// ---- Input validation -----------------------------------------------------

type Body = Record<string, unknown>;

export async function readBody(req: { json(): Promise<unknown> }): Promise<Body> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    fail(400, 'Request body must be JSON');
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'Request body must be a JSON object');
  return body as Body;
}

export function str(body: Body, key: string, opts: { required?: boolean; max?: number } = {}): string | null {
  const v = body[key];
  if (v === undefined || v === null || v === '') {
    if (opts.required) fail(400, `${key} is required`);
    return null;
  }
  if (typeof v !== 'string') fail(400, `${key} must be text`);
  const t = v.trim();
  if (opts.required && !t) fail(400, `${key} is required`);
  if (t.length > (opts.max ?? 200)) fail(400, `${key} is too long`);
  return t || null;
}

export function int(body: Body, key: string, min: number, max: number): number | null {
  const v = body[key];
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) fail(400, `${key} must be a whole number from ${min} to ${max}`);
  return v;
}

export function bool(body: Body, key: string): boolean | null {
  const v = body[key];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'boolean') fail(400, `${key} must be true or false`);
  return v;
}

export function strList(body: Body, key: string): string[] | null {
  const v = body[key];
  if (v === undefined || v === null) return null;
  if (!Array.isArray(v) || v.length > 12 || !v.every((x) => typeof x === 'string' && x.trim() && x.length <= 40)) {
    fail(400, `${key} must be a list of short text values`);
  }
  return [...new Set((v as string[]).map((x) => x.trim()))];
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export const AIRPORT_RE = /^[A-Z]{3}$/;

export function isValidDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function parseLanguages(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}
