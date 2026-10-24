# Saathi

**No parent flies alone.** Saathi finds trusted company for parents flying alone (starting with India ⇄ US), and keeps their family updated at every step of the journey.

| Folder | What it is | Runs on |
| --- | --- | --- |
| [`web/`](web/) | Website at saathi.travel: landing page, FAQ with comparison, validation survey, early-access list, stories, blog, privacy policy | Cloudflare Pages (free) |
| [`api/`](api/) | Backend API: sign-in, travellers, trips, matching, introductions, travel-day updates, help alerts, survey and waitlist | Cloudflare Workers + D1 database (free tier) |
| [`mobile/`](mobile/) | iPhone and Android app: family app and a separate, simple parent app (English/Hindi) | Expo / React Native |
| [`prototype/`](prototype/) | Clickable single-file design prototype | Any browser |
| [`docs/`](docs/) | Launch plan, costs and decisions | |

## How the app works

**Family app.** Sign in with an emailed 6-digit code, add a parent, then add their flight by pasting the airline's booking email (or typing it in). Saathi lists other travellers on the same flight, or arriving or leaving within 90 minutes. You can filter by shared home language, fellow seniors or young helpers. Requesting an introduction shows only a first name until the other family accepts. After that, both families see full names, seats and phone numbers.

**Parent app.** The parent's phone opens with a one-time code from the family app: no email or password. It has large text, an English/Hindi switch and read-aloud. It shows their flight, their companion and big call buttons, plus a six-step journey guide (check-in → security → gate → plane → immigration → bags). Each step completed updates the family, and **I need help** alerts the family and the companion's family.

**Privacy and records.** Every change to a trip is kept in an audit history. Users can delete their account and everything in it.

## Running it locally

Requires Node 20 or later.

```bash
# API (http://localhost:8787)
cd api
npm install
cp .dev.vars.example .dev.vars
npm run db:migrate:local
npm run db:seed:local        # optional sample travellers on AI 101, 14 Nov 2026
npm run dev

# Tests
npm test                     # unit tests (booking-email parser, matching)
node scripts/smoke.mjs       # 40 end-to-end checks against the running API

# Mobile app
cd ../mobile
npm install
EXPO_PUBLIC_API_URL=http://<your-computer-ip>:8787 npx expo start
# Scan the QR code with the Expo Go app on your phone.

# Website
cd ../web
npx serve .                  # then open http://localhost:3000/?api=http://localhost:8787
```

While `DEV_MODE = "true"` in `api/wrangler.toml`, sign-in codes are shown in the app instead of emailed, so you can test without an email provider. Turn it off before real users sign up.

## Deploying (all free tier)

The Cloudflare D1 database `saathi` already exists, with all tables created and sample data loaded.

1. **API:** `cd api && npx wrangler login && npx wrangler deploy`, then `npx wrangler secret put ADMIN_TOKEN`. Add a custom domain `api.saathi.travel` to the Worker in the Cloudflare dashboard.
2. **Website:** in Cloudflare Pages, create a project from this repository with build output directory `web` and no build command. Add the custom domain `saathi.travel`.
3. **Survey results:** `curl -H "Authorization: Bearer $ADMIN_TOKEN" https://api.saathi.travel/admin/survey/summary` for counts, or `/admin/survey/export.csv` for a spreadsheet.

The phone app can be tested for free with Expo Go. Store listings (Apple $99 a year, Google $25 once) are deliberately left until the survey shows demand. See [`docs/launch-plan.md`](docs/launch-plan.md).

## Turning on paid services later

Each one switches on when its secret is set (`npx wrangler secret put NAME`). Until then the app works without it.

| Secret | Turns on |
| --- | --- |
| `RESEND_API_KEY` | Emailing sign-in codes (then set `DEV_MODE = "false"`) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_FROM` | WhatsApp alerts to families |
| `FLIGHTAWARE_API_KEY` (and `FLIGHT_PROVIDER = "flightaware"`) | Live flight status instead of the simulated one |

## Before real launch

- Remove the sample travellers: `DELETE FROM users WHERE email LIKE 'sample+%@saathi.example';`
- Set `DEV_MODE = "false"` once email is connected.
- Decide and build the identity-verification step (the `id_verified` and `vouched_by` fields exist, but nothing sets them yet).
- Have the privacy policy reviewed.
