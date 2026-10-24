import type { Env } from './env';

/**
 * Outbound messages. Each channel works when its secrets are set and falls
 * back to logging otherwise, so the app runs end to end without accounts.
 */

export async function sendLoginCode(env: Env, email: string, code: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log(`[email disabled] sign-in code for ${email}: ${code}`);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.EMAIL_FROM ?? 'Saathi <hello@saathi.travel>',
      to: [email],
      subject: `Your Saathi code: ${code}`,
      text: `Your Saathi sign-in code is ${code}. It expires in 10 minutes.\n\nIf you did not ask for this, you can ignore this email.`,
    }),
  });
  if (!res.ok) console.error('Resend error', res.status, await res.text());
  return res.ok;
}

export async function sendWhatsApp(env: Env, to: string | null, text: string): Promise<void> {
  if (!to) return;
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    console.log(`[whatsapp disabled] to ${to}: ${text}`);
    return;
  }
  const body = new URLSearchParams({
    From: `whatsapp:${env.TWILIO_WHATSAPP_FROM}`,
    To: `whatsapp:${to}`,
    Body: text,
  });
  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + btoa(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) console.error('Twilio error', res.status, await res.text());
}

export async function addEvent(db: D1Database, tripId: string, kind: string, text: string): Promise<void> {
  await db.prepare('INSERT INTO trip_events (trip_id, kind, text) VALUES (?, ?, ?)').bind(tripId, kind, text).run();
}

/** Adds a timeline event to the trip and messages the family that manages it. */
export async function tellFamily(env: Env, tripId: string, kind: string, text: string): Promise<void> {
  await addEvent(env.DB, tripId, kind, text);
  const owner = await env.DB.prepare(
    `SELECT u.phone FROM trips t JOIN travellers tr ON tr.id = t.traveller_id JOIN users u ON u.id = tr.owner_user_id WHERE t.id = ?`,
  )
    .bind(tripId)
    .first<{ phone: string | null }>();
  await sendWhatsApp(env, owner?.phone ?? null, `Saathi: ${text}`);
}
