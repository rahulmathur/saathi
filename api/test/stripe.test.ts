import { describe, expect, it } from 'vitest';
import { stripeEventResult, verifyStripeSignature } from '../src/verify-stripe';

async function sign(secret: string, t: number, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${payload}`));
  return [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

describe('verifyStripeSignature', () => {
  const secret = 'whsec_test';
  const payload = '{"type":"identity.verification_session.verified"}';
  const now = 1_800_000_000_000;
  const t = now / 1000;

  it('accepts a valid signature', async () => {
    const sig = await sign(secret, t, payload);
    expect(await verifyStripeSignature(payload, `t=${t},v1=${sig}`, secret, now)).toBe(true);
  });
  it('accepts when one of several v1 signatures matches', async () => {
    const sig = await sign(secret, t, payload);
    expect(await verifyStripeSignature(payload, `t=${t},v1=${'0'.repeat(64)},v1=${sig}`, secret, now)).toBe(true);
  });
  it('rejects a tampered payload', async () => {
    const sig = await sign(secret, t, payload);
    expect(await verifyStripeSignature(payload + ' ', `t=${t},v1=${sig}`, secret, now)).toBe(false);
  });
  it('rejects the wrong secret', async () => {
    const sig = await sign('whsec_other', t, payload);
    expect(await verifyStripeSignature(payload, `t=${t},v1=${sig}`, secret, now)).toBe(false);
  });
  it('rejects an old timestamp', async () => {
    const old = t - 301;
    const sig = await sign(secret, old, payload);
    expect(await verifyStripeSignature(payload, `t=${old},v1=${sig}`, secret, now)).toBe(false);
  });
  it('rejects a missing or malformed header', async () => {
    expect(await verifyStripeSignature(payload, null, secret, now)).toBe(false);
    expect(await verifyStripeSignature(payload, 'garbage', secret, now)).toBe(false);
    expect(await verifyStripeSignature(payload, `t=${t}`, secret, now)).toBe(false);
  });
});

describe('stripeEventResult', () => {
  const ev = (type: string, extra = {}) => ({ type, data: { object: { id: 'vs_1', ...extra } } });
  it('maps verified', () => {
    expect(stripeEventResult(ev('identity.verification_session.verified'))).toEqual({ providerRef: 'vs_1', result: { status: 'verified', method: 'document' } });
  });
  it('maps requires_input to failed with the reason', () => {
    expect(stripeEventResult(ev('identity.verification_session.requires_input', { last_error: { reason: 'Document expired' } }))?.result).toEqual({ status: 'failed', reason: 'Document expired' });
  });
  it('maps canceled', () => {
    expect(stripeEventResult(ev('identity.verification_session.canceled'))?.result.status).toBe('cancelled');
  });
  it('ignores other events', () => {
    expect(stripeEventResult(ev('identity.verification_session.processing'))).toBeNull();
    expect(stripeEventResult({ type: 'identity.verification_session.verified' })).toBeNull();
  });
});
