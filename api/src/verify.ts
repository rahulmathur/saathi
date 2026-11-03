import type { Env } from './env';

/**
 * Identity verification, independent of any one provider. A provider sends
 * the person to its own page to check their ID, then tells us the result.
 * To add one (Didit, Stripe Identity, an Indian DigiLocker provider...),
 * implement VerificationProvider and add it to providerFor().
 */

export interface VerificationResult {
  status: 'verified' | 'failed' | 'pending' | 'cancelled';
  method?: string | null; // digilocker, passport, drivers_licence, ...
  country?: string | null; // issuing country, ISO 3166 alpha-2
  reason?: string | null; // why a check failed, in plain words
}

export interface VerificationProvider {
  name: string;
  /** Starts a check and returns the page to send the person to. */
  start(env: Env, args: { verificationId: string; travellerName: string; apiBase: string }): Promise<{ providerRef: string; url: string }>;
  /** Reads a provider's callback. Returns null unless it is authentic. */
  webhook(env: Env, req: Request): Promise<{ providerRef: string; result: VerificationResult } | null>;
}

/** Built-in stand-in for testing: a page with "pass" and "fail" buttons. Never use with real users. */
const mock: VerificationProvider = {
  name: 'mock',
  async start(_env, { verificationId, apiBase }) {
    return { providerRef: verificationId, url: `${apiBase}/verify/mock/${verificationId}` };
  },
  async webhook() {
    return null; // the mock page reports results directly, see routes/verification.ts
  },
};

export function providerFor(env: Env): VerificationProvider {
  const name = env.VERIFY_PROVIDER ?? 'mock';
  switch (name) {
    case 'mock':
      return mock;
    default:
      throw new Error(`Unknown VERIFY_PROVIDER "${name}"`);
  }
}

/** Records a result; a passed check marks the traveller verified. */
export async function applyResult(db: D1Database, verificationId: string, result: VerificationResult): Promise<void> {
  const v = await db
    .prepare('SELECT id, traveller_id, status FROM verifications WHERE id = ?')
    .bind(verificationId)
    .first<{ id: string; traveller_id: string; status: string }>();
  if (!v || v.status === 'verified') return; // unknown, or already final
  const now = new Date().toISOString();
  await db
    .prepare('UPDATE verifications SET status = ?, method = ?, country = ?, failure_reason = ?, updated_at = ? WHERE id = ?')
    .bind(result.status, result.method ?? null, result.country ?? null, result.reason ?? null, now, v.id)
    .run();
  if (result.status === 'verified') {
    await db
      .prepare('UPDATE travellers SET id_verified = 1, id_verified_at = ?, id_verified_method = ? WHERE id = ?')
      .bind(now, result.method ?? null, v.traveller_id)
      .run();
  }
}
