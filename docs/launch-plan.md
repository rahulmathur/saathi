# Launch plan: validate first, spend later

## Phase 1: test demand (cost: the domain only)

Goal: find out whether families want Saathi, and what they want first, before paying for anything.

| What | Cost |
| --- | --- |
| Website, survey, waitlist and stories on Cloudflare Pages + Workers + D1 | Free tier |
| Domain saathi.travel | Registrar fee only |
| Email to hello@ and privacy@saathi.travel | Free with Cloudflare Email Routing (forwards to an existing inbox) |
| App testing with friends and family | Free through Expo Go |

**How to get responses**

- Post the survey link in the Facebook and WhatsApp groups families already use to find travel companions. These are the people with the problem.
- Ask Indian community associations, temples and gurdwaras to share it in their newsletters and groups.
- The survey's thank-you page asks people to share it on WhatsApp.

**What counts as "worth building"**

Suggested thresholds; adjust them before you look at the results:

- At least 200 responses from families.
- At least 40% answer "definitely" or "probably" to "Would you use Saathi?"
- At least 25% of families leave their email for early access.
- A clear favourite among the features rated 4–5. That's what launches first.
- Trust answers tell you which verification to build (ID check, community vouching or a video call).

## Phase 2: launch, if the numbers hold

| What | Approximate cost |
| --- | --- |
| Apple Developer Program | $99 a year |
| Google Play developer account | $25 once |
| Email sign-in codes (e.g. Resend) | Free tier covers early volume |
| WhatsApp alerts (e.g. Twilio) | Pay per message |
| Live flight status (e.g. FlightAware AeroAPI) | Pay per lookup |
| ID verification | Per check; choose a provider after the survey |

Check current prices before signing up; they change.

## Forum, helpdesk, CRM and chatbot

| Need | Recommendation now | Later, if it grows |
| --- | --- | --- |
| **Forum / community** | Don't build one. The community already lives in WhatsApp and Facebook groups. Start a Saathi WhatsApp Community for early-access users. | A hosted forum (e.g. Discourse) once there are a few thousand active users. |
| **Helpdesk** | hello@saathi.travel forwarded to one inbox, plus the FAQ. Early users want a person, not a ticket number. | A shared inbox or helpdesk once more than one person answers. |
| **CRM** | The waitlist and survey tables plus the CSV export are enough to start. | Sync the waitlist to a free CRM (e.g. HubSpot) for launch emails and partner tracking. |
| **Chatbot** | Not yet. With few users, the FAQ answers most questions and a chatbot adds cost and risk on a safety-sensitive topic. | An AI assistant grounded in the FAQ and blog, with handover to a person, once support volume justifies it. |

## Our USPs, and how to keep them

Competitors are free, small and mostly stop at the introduction. Saathi's advantages:

1. **It covers the whole journey.** A parent journey guide, step-by-step family updates and a help button that reaches everyone.
2. **The parent has their own app.** Hindi/English, large text, read-aloud and sign-in with a code instead of a password.
3. **Smarter matching.** Nearby arrivals and departures as well as the same flight, filtered by home language, fellow seniors or helpers.
4. **Private by default.** First name only until both families agree.
5. **Adding a trip takes seconds.** Paste the booking email.

These features can be copied. The lasting advantages are **trust** (real verification and community vouching) and **network size** (more families on more flights). Partnerships with community associations build both.
