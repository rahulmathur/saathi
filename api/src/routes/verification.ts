import { Hono } from 'hono';
import { requireFamily } from '../auth';
import { ownedTraveller } from '../data';
import type { AppEnv } from '../env';
import { applyResult, isTestMode, providerFor } from '../verify';
import { fail, newId, readBody, str } from '../util';

/** Starting a check and reading its status, from the family app. */
export const verificationFamily = new Hono<AppEnv>();
verificationFamily.use('*', requireFamily);

interface VerificationRow {
  id: string;
  provider: string;
  status: string;
  method: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

function verificationOut(v: VerificationRow | null, verified: boolean, testMode: boolean) {
  return {
    verified,
    testMode,
    latest: v ? { id: v.id, status: v.status, method: v.method, reason: v.failure_reason, startedAt: v.created_at, updatedAt: v.updated_at } : null,
  };
}

verificationFamily.get('/travellers/:id/verification', async (c) => {
  const { userId } = c.get('session');
  const t = await ownedTraveller(c.env.DB, userId, c.req.param('id'));
  const v = await c.env.DB.prepare('SELECT * FROM verifications WHERE traveller_id = ? ORDER BY created_at DESC LIMIT 1').bind(t.id).first<VerificationRow>();
  return c.json(verificationOut(v, !!t.id_verified, isTestMode(c.env)));
});

verificationFamily.post('/travellers/:id/verification', async (c) => {
  const { userId } = c.get('session');
  const db = c.env.DB;
  const t = await ownedTraveller(db, userId, c.req.param('id'));
  if (t.id_verified) fail(409, `${t.name.split(' ')[0]} is already verified`);
  const provider = providerFor(c.env);
  const id = newId();
  const apiBase = new URL(c.req.url).origin;
  const { providerRef, url } = await provider.start(c.env, { verificationId: id, travellerName: t.name, apiBase });
  await db
    .prepare('INSERT INTO verifications (id, traveller_id, user_id, provider, provider_ref) VALUES (?, ?, ?, ?, ?)')
    .bind(id, t.id, userId, provider.name, providerRef)
    .run();
  return c.json({ verificationId: id, url, testMode: isTestMode(c.env) }, 201);
});

/** Provider callbacks and the built-in test page: no sign-in, each checked on its own terms. */
export const verificationPublic = new Hono<AppEnv>();

verificationPublic.post('/webhooks/verification/:provider', async (c) => {
  const provider = providerFor(c.env);
  if (c.req.param('provider') !== provider.name) fail(404, 'Not found');
  const parsed = await provider.webhook(c.env, c.req.raw);
  if (!parsed) fail(401, 'Not a valid callback');
  if (parsed === 'ignore') return c.json({ ok: true });
  const v = await c.env.DB.prepare('SELECT id FROM verifications WHERE provider = ? AND provider_ref = ?')
    .bind(provider.name, parsed.providerRef)
    .first<{ id: string }>();
  if (v) await applyResult(c.env.DB, v.id, parsed.result);
  return c.json({ ok: true });
});

const page = (title: string, body: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{margin:0;background:#F5F6F8;font:18px/1.5 system-ui,sans-serif;color:#1A1D24;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
main{background:#fff;border:1px solid #E3E5EA;border-radius:22px;padding:28px;max-width:420px;display:grid;gap:16px}h1{margin:0;font-size:26px;color:#1C2B4F}
.note{background:#FDF0D9;color:#4A2E00;border-radius:14px;padding:12px 14px;font-size:16px}button{font:inherit;font-weight:700;min-height:54px;border-radius:16px;border:0;width:100%;cursor:pointer}
.pass{background:#1C2B4F;color:#fff}.fail{background:#fff;color:#1C2B4F;border:2px solid #1C2B4F}form{display:grid;gap:10px}</style></head><body><main>${body}</main></body></html>`;

/** Where a provider's hosted page sends people when they finish. */
verificationPublic.get('/verify/done', (c) =>
  c.html(page('Saathi ID check', '<h1>Thank you</h1><p>Your check has been submitted. You can close this page and go back to Saathi, where the result will appear in a moment.</p>')),
);

function mockOnly(c: { env: AppEnv['Bindings'] }) {
  if (providerFor(c.env).name !== 'mock') fail(404, 'Not found');
}

verificationPublic.get('/verify/mock/:id', async (c) => {
  mockOnly(c);
  const v = await c.env.DB.prepare(
    `SELECT v.id, v.status, tr.name FROM verifications v JOIN travellers tr ON tr.id = v.traveller_id WHERE v.id = ? AND v.provider = 'mock'`,
  )
    .bind(c.req.param('id'))
    .first<{ id: string; status: string; name: string }>();
  if (!v) fail(404, 'Not found');
  if (v.status !== 'pending') return c.html(page('Saathi ID check', `<h1>Already done</h1><p>This check is ${v.status}. You can go back to Saathi.</p>`));
  const first = v.name.split(' ')[0].replace(/[<>&"]/g, '');
  return c.html(
    page(
      'Saathi ID check',
      `<h1>Verify ${first}'s identity</h1>
       <p class="note">Test mode: no real ID check happens yet. When Saathi launches, this page will ask for a government ID and a selfie through a verification partner.</p>
       <form method="post"><button class="pass" name="result" value="verified">Pass the check</button><button class="fail" name="result" value="failed">Fail the check</button></form>`,
    ),
  );
});

verificationPublic.post('/verify/mock/:id', async (c) => {
  mockOnly(c);
  const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
  const json = c.req.header('Content-Type')?.includes('application/json') ? await readBody(c.req) : null;
  const result = str((json ?? form) as Record<string, unknown>, 'result', { required: true, max: 10 });
  if (result !== 'verified' && result !== 'failed') fail(400, 'result must be verified or failed');
  const v = await c.env.DB.prepare(`SELECT id FROM verifications WHERE id = ? AND provider = 'mock'`).bind(c.req.param('id')).first<{ id: string }>();
  if (!v) fail(404, 'Not found');
  await applyResult(c.env.DB, v.id, {
    status: result,
    method: result === 'verified' ? 'test' : null,
    reason: result === 'failed' ? 'Test check failed' : null,
  });
  if (json) return c.json({ ok: true });
  return c.html(page('Saathi ID check', `<h1>${result === 'verified' ? 'Verified' : 'Check failed'}</h1><p>You can close this page and go back to Saathi.</p>`));
});
