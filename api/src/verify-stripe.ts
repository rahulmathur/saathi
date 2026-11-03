import type { Env } from './env';
import type { VerificationProvider, VerificationResult } from './verify';

/**
 * Stripe Identity: Stripe's hosted page asks for a photo ID and a selfie.
 * Needs the secrets STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, and a webhook
 * in the Stripe dashboard pointing at /webhooks/verification/stripe for the
 * identity.verification_session.* events.
 */

const STRIPE_API = 'https://api.stripe.com/v1';
const SIGNATURE_TOLERANCE_SECONDS = 300;

export const stripe: VerificationProvider = {
  name: 'stripe',
  async start(env, { verificationId, apiBase }) {
    if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
    const body = new URLSearchParams({
      type: 'document',
      'options[document][require_matching_selfie]': 'true',
      'metadata[verification_id]': verificationId,
      return_url: `${apiBase}/verify/done`,
    });
    const res = await fetch(`${STRIPE_API}/identity/verification_sessions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const data = (await res.json()) as { id?: string; url?: string; error?: { message?: string } };
    if (!res.ok || !data.id || !data.url) throw new Error(`Stripe Identity: ${data.error?.message ?? res.status}`);
    return { providerRef: data.id, url: data.url };
  },
  async webhook(env, req) {
    if (!env.STRIPE_WEBHOOK_SECRET) return null;
    const payload = await req.text();
    const ok = await verifyStripeSignature(payload, req.headers.get('Stripe-Signature'), env.STRIPE_WEBHOOK_SECRET);
    if (!ok) return null;
    return stripeEventResult(JSON.parse(payload)) ?? 'ignore';
  },
};

export function isStripeSandbox(env: Env): boolean {
  return !!env.STRIPE_SECRET_KEY?.startsWith('sk_test_');
}

interface StripeEvent {
  type?: string;
  data?: { object?: { id?: string; last_error?: { code?: string | null; reason?: string | null } | null } };
}

/** Maps a Stripe Identity event to our result; null for events we don't act on. */
export function stripeEventResult(event: StripeEvent): { providerRef: string; result: VerificationResult } | null {
  const session = event.data?.object;
  if (!session?.id) return null;
  switch (event.type) {
    case 'identity.verification_session.verified':
      return { providerRef: session.id, result: { status: 'verified', method: 'document' } };
    case 'identity.verification_session.requires_input':
      return {
        providerRef: session.id,
        result: { status: 'failed', reason: session.last_error?.reason ?? 'The ID or selfie could not be confirmed' },
      };
    case 'identity.verification_session.canceled':
      return { providerRef: session.id, result: { status: 'cancelled' } };
    default:
      return null;
  }
}

/** Checks Stripe's "t=…,v1=…" signature: an HMAC-SHA256 of "<t>.<payload>" with the webhook secret. */
export async function verifyStripeSignature(payload: string, header: string | null, secret: string, now = Date.now()): Promise<boolean> {
  if (!header) return false;
  const parts = header.split(',').map((p) => p.split('=', 2) as [string, string]);
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > SIGNATURE_TOLERANCE_SECONDS) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return sigs.some((s) => timingSafeEqual(s, expected));
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
