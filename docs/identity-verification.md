# Identity verification

> **Currently off.** ID checks aren't launching for a while, so the requirement is switched off:
>
> - **API:** `ID_CHECK = "off"` in `api/wrangler.toml`. Introductions don't need a verified traveller, and `POST /travellers/:id/verification` and the test page refuse to start a check, so nobody can mark themselves verified in the meantime.
> - **App:** the "Verify" prompts are hidden unless it's built with `EXPO_PUBLIC_ID_CHECK=required`.
>
> To launch, set `ID_CHECK = "required"`, build the app with `EXPO_PUBLIC_ID_CHECK=required`, and deploy both together. `node scripts/smoke.mjs` reads the API's setting and tests whichever mode is on. The rest of this page describes the feature as it works when switched on.

Before families are introduced, both travellers must pass an ID check.

- **Asking for an introduction** requires the asking family's traveller to be verified.
- **Accepting one** requires the accepting traveller to be verified, and the asker must still be verified.
- **Browsing matches** needs no check.

Saathi stores only the result (status, method, issuing country and date), never images or document numbers.

## How it fits together

| Piece | Where |
| --- | --- |
| Provider slot and result handling | `api/src/verify.ts` |
| Routes: start a check, read status, provider callback, test page | `api/src/routes/verification.ts` |
| Rule enforcement on introductions | `api/src/routes/family.ts` (`verificationRequired`) |
| Database (`verifications` table; `travellers.id_verified*`) | `api/migrations/0005_verification.sql` |
| App screen | `mobile/src/app/traveller/verify.tsx` |

The flow works like this:
1. The app calls `POST /travellers/:id/verification`.
2. The provider returns a page URL.
3. The app opens that page in an in-app browser, or a new tab on the web.
4. The provider calls `POST /webhooks/verification/<provider>`, which calls `applyResult()`.
5. The app polls `GET /travellers/:id/verification` every 3 seconds until the result arrives.

## Test mode (now)

`VERIFY_PROVIDER = "mock"` in `api/wrangler.toml`. The "check" is a page with **Pass** and **Fail** buttons, and the app shows a test-mode notice. The test page and its endpoint return 404 as soon as any other provider is set.

## Stripe Identity (built in)

`api/src/verify-stripe.ts` connects Stripe Identity: a government photo ID plus a matching selfie on Stripe's hosted page.

1. Store the API key as a Cloudflare secret: `STRIPE_SECRET_KEY` (`sk_test_…` for the sandbox, `sk_live_…` for real checks).
2. In Stripe, go to **Developers → Webhooks** and add the endpoint `https://<api>/webhooks/verification/stripe` with these events:
   - `identity.verification_session.verified`
   - `identity.verification_session.requires_input`
   - `identity.verification_session.canceled`
3. Store that endpoint's signing secret as the Cloudflare secret `STRIPE_WEBHOOK_SECRET`.
4. Set `VERIFY_PROVIDER = "stripe"` and deploy.

With an `sk_test_` key, the app still shows its test-mode notice. Stripe's sandbox page lets you choose the outcome, and no real ID is needed.

## Plugging in another provider

1. Sign up with the provider (for example Didit, Stripe Identity, or an Indian DigiLocker provider such as Setu) and get API keys. DigiLocker itself only accepts Indian-registered organisations, so a US company goes through a provider.
2. In `api/src/verify.ts`, write a `VerificationProvider`:
   - `start()` creates a session with the provider, passing our `verificationId` as their reference or metadata, and returns `{ providerRef, url }`.
   - `webhook()` **checks the provider's signature**, then maps their result to `{ status, method, country, reason }`. It returns `null` for anything unsigned.
3. Add the provider to `providerFor()`. Store its keys as secrets (`npx wrangler secret put …`).
4. In the provider's dashboard, set the callback URL to `https://<api>/webhooks/verification/<name>`.
5. Set `VERIFY_PROVIDER = "<name>"`, deploy, and run one real check end to end.

## Before real users

- Switch off `mock`. Any account can mark itself verified while it is on.
- Decide what happens to travellers verified during testing. To reset them, run `UPDATE travellers SET id_verified = 0, id_verified_at = NULL, id_verified_method = NULL WHERE id_verified_method = 'test';`.
- Update the privacy policy to name the verification provider.
