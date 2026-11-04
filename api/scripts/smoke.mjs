// End-to-end check against a running API (default: local `wrangler dev`).
// Usage: node scripts/smoke.mjs [baseUrl]
const BASE = process.argv[2] ?? 'http://localhost:8787';
let failures = 0;

async function call(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail)}`}`);
  if (!ok) failures++;
}
async function signIn(email) {
  const start = await call('POST', '/auth/start', { email });
  const verify = await call('POST', '/auth/verify', { email, code: start.data.devCode });
  return verify.data.token;
}

const email = `smoke+${Date.now()}@example.com`;
const start = await call('POST', '/auth/start', { email });
check('sign-in code issued (dev mode)', start.status === 200 && /^\d{6}$/.test(start.data.devCode), start);
const bad = await call('POST', '/auth/verify', { email, code: '000000' === start.data.devCode ? '111111' : '000000' });
check('wrong code rejected', bad.status === 400, bad);
const verify = await call('POST', '/auth/verify', { email, code: start.data.devCode });
check('code exchanged for session', verify.status === 200 && verify.data.token && verify.data.isNew === true, verify);
const token = verify.data.token;

check('unauthenticated request refused', (await call('GET', '/trips')).status === 401);
const me = await call('PATCH', '/me', { name: 'Anjali Sharma', phone: '+12035550101' }, token);
check('profile updated', me.data.user?.name === 'Anjali Sharma', me);

const trav = await call('POST', '/travellers', { name: 'Sushila Sharma', relation: 'Maa', age: 72, homeCity: 'Lucknow', languages: ['Hindi', 'English'], phone: '+919800000001' }, token);
check('traveller created', trav.status === 201, trav);
const travellerId = trav.data.traveller.id;

const parsed = await call('POST', '/trips/parse', { text: 'Passenger: SHARMA/SUSHILA MRS\nFlight AI 101 Thu, 14 Nov 2026\nDEL 02:10 -> JFK 07:45\nSeat: 32C' }, token);
check('booking text parsed', parsed.data.flights?.[0]?.flightNumber === 'AI101' && parsed.data.flights[0].seat === '32C', parsed);

const f = parsed.data.flights[0];
const trip = await call('POST', '/trips', {
  travellerId, flightNumber: f.flightNumber, flightDate: f.date, origin: f.origin, destination: f.destination,
  departTime: f.departTime, arriveTime: f.arriveTime, arriveDate: '2026-11-14', seat: f.seat, wheelchair: true, seeking: true,
}, token);
check('trip created', trip.status === 201, trip);
const tripId = trip.data.trip.id;

const upd = await call('PATCH', `/trips/${tripId}`, { seat: '33C' }, token);
check('trip updated', upd.data.trip?.seat === '33C', upd);
const hist = await call('GET', `/trips/${tripId}/history`, null, token);
check('audit trail recorded', hist.data.history?.length === 2 && hist.data.history[1].changes.seat?.[1] === '33C', hist);

const matches = await call('GET', `/trips/${tripId}/matches`, null, token);
const names = matches.data.matches?.map((m) => m.name) ?? [];
check('sample travellers matched', names.includes('Meera J.') && names.includes('Lakshmi R.'), matches.data);
check('same flight ranked first', matches.data.matches?.[0]?.relation === 'same_flight', matches.data.matches?.[0]);
check('no contact details before introduction', matches.data.matches?.every((m) => m.contact === null && m.seat === null), null);
const lak = matches.data.matches.find((m) => m.name === 'Lakshmi R.');
check('nearby arrival detected with gap', lak?.relation === 'same_arrival' && lak.gapMinutes === 40, lak);
const hindi = await call('GET', `/trips/${tripId}/matches?filter=language`, null, token);
check('language filter', hindi.data.matches.every((m) => m.sharedLanguages.length > 0) && !hindi.data.matches.some((m) => m.name === 'Lakshmi R.'), hindi.data);
const helpers = await call('GET', `/trips/${tripId}/matches?filter=helper`, null, token);
check('helper filter', helpers.data.matches.length === 1 && helpers.data.matches[0].kind === 'helper', helpers.data);

// Introduce to Meera; her family (sample user) accepts.
const meera = matches.data.matches.find((m) => m.name === 'Meera J.');
check('sample travellers carry no fake verified badge', matches.data.matches.filter((m) => m.travellerId.startsWith('sample-')).every((m) => m.idVerified === false && m.vouchedBy === null), matches.data.matches);
// ID_CHECK in wrangler.toml: "required" enforces checks; "off" (until launch) skips them.
const ID_CHECK = (await call('GET', `/travellers/${travellerId}/verification`, null, token)).data.required === true;
console.log(`      (ID checks ${ID_CHECK ? 'required' : 'off'})`);
async function verifyTraveller(id, tok, result = 'verified') {
  if (!ID_CHECK) return null;
  const start = await call('POST', `/travellers/${id}/verification`, null, tok);
  const done = await call('POST', `/verify/mock/${start.data.verificationId}`, { result });
  return { start, done, status: await call('GET', `/travellers/${id}/verification`, null, tok) };
}
if (!ID_CHECK) {
  const off = await call('POST', `/travellers/${travellerId}/verification`, null, token);
  check('ID check cannot be started while off', off.status === 403, off);
  check('test verification page hidden while off', (await fetch(`${BASE}/verify/mock/anything`)).status === 404);
} else {
const early = await call('POST', `/trips/${tripId}/intros`, { toTripId: meera.tripId }, token);
check('introduction needs a verified traveller', early.status === 403 && early.data.code === 'verification_required' && early.data.travellerId === travellerId, early);
const v1start = await call('POST', `/travellers/${travellerId}/verification`, null, token);
check('verification started in test mode', v1start.status === 201 && v1start.data.testMode === true && v1start.data.url.includes('/verify/mock/'), v1start);
const mockPage = await fetch(v1start.data.url);
check('test verification page shown', mockPage.status === 200 && (await mockPage.text()).includes('Pass the check'));
check('verification pending', (await call('GET', `/travellers/${travellerId}/verification`, null, token)).data.latest?.status === 'pending');
await call('POST', `/verify/mock/${v1start.data.verificationId}`, { result: 'verified' });
const v1 = await call('GET', `/travellers/${travellerId}/verification`, null, token);
check('traveller verified', v1.data.verified === true && v1.data.latest?.status === 'verified', v1.data);
check('cannot start a second check once verified', (await call('POST', `/travellers/${travellerId}/verification`, null, token)).status === 409);
check('other families cannot check my traveller', (await call('GET', `/travellers/${travellerId}/verification`, null, await signIn(`smoke3+${Date.now()}@example.com`))).status === 404);
}

const intro = await call('POST', `/trips/${tripId}/intros`, { toTripId: meera.tripId, message: 'Maa would love company on AI 101.' }, token);
check('introduction requested', intro.status === 201, intro);
const dup = await call('POST', `/trips/${tripId}/intros`, { toTripId: meera.tripId }, token);
check('duplicate request refused', dup.status === 409, dup);

// The sample user has no login, so create a second real family to test accepting.
const token2 = await signIn(`smoke2+${Date.now()}@example.com`);
await call('PATCH', '/me', { name: 'Ravi Iyer', phone: '+12035550102' }, token2);
const t2 = await call('POST', '/travellers', { name: 'Kamala Iyer', relation: 'Amma', age: 70, languages: ['Tamil', 'Hindi'] }, token2);
const trip2 = await call('POST', '/trips', { travellerId: t2.data.traveller.id, flightNumber: 'AI 101', flightDate: '2026-11-14', origin: 'DEL', destination: 'JFK', departTime: '02:10', arriveTime: '07:45', seat: '35B' }, token2);
const m2 = await call('GET', `/trips/${trip2.data.trip.id}/matches`, null, token2);
const sushila = m2.data.matches.find((m) => m.name === 'Sushila S.');
check('other family sees Sushila by first name only', !!sushila && sushila.contact === null, m2.data);
if (ID_CHECK) {
  check('unverified family cannot ask', (await call('POST', `/trips/${trip2.data.trip.id}/intros`, { toTripId: tripId }, token2)).status === 403);
  const failed = await verifyTraveller(t2.data.traveller.id, token2, 'failed');
  check('failed check leaves traveller unverified', failed.status.data.verified === false && failed.status.data.latest?.status === 'failed', failed.status.data);
}
await verifyTraveller(t2.data.traveller.id, token2);
const req2 = await call('POST', `/trips/${trip2.data.trip.id}/intros`, { toTripId: tripId }, token2);
check(ID_CHECK ? 'verified family can ask' : 'family can ask without an ID check', req2.status === 201, req2);
const intros = await call('GET', '/intros', null, token);
check('incoming request listed', intros.data.incoming?.some((i) => i.id === req2.data.intro.id), intros.data);
const notMine = await call('POST', `/intros/${req2.data.intro.id}/respond`, { accept: true }, token2);
check('sender cannot accept own request', notMine.status === 404, notMine);
// A third family, not yet verified, cannot accept a request.
const token4 = await signIn(`smoke4+${Date.now()}@example.com`);
const t4 = await call('POST', '/travellers', { name: 'Lata Rao', relation: 'Amma', languages: ['Hindi'] }, token4);
const trip4 = await call('POST', '/trips', { travellerId: t4.data.traveller.id, flightNumber: 'AI 101', flightDate: '2026-11-14', origin: 'DEL', destination: 'JFK', departTime: '02:10', arriveTime: '07:45' }, token4);
const req4 = await call('POST', `/trips/${trip2.data.trip.id}/intros`, { toTripId: trip4.data.trip.id }, token2);
const acc4 = await call('POST', `/intros/${req4.data.intro.id}/respond`, { accept: true }, token4);
if (ID_CHECK) check('unverified family cannot accept', acc4.status === 403 && acc4.data.code === 'verification_required', acc4);
else check('family can accept without an ID check', acc4.status === 200 && acc4.data.intro?.status === 'accepted', acc4);
await call('DELETE', '/me', null, token4);

const acc = await call('POST', `/intros/${req2.data.intro.id}/respond`, { accept: true }, token);
check('request accepted', acc.data.intro?.status === 'accepted', acc);
const full = await call('GET', `/trips/${tripId}`, null, token);
const comp = full.data.companions?.[0];
check('contact revealed after acceptance', comp?.name === 'Kamala Iyer' && comp.contact?.familyPhone === '+12035550102' && comp.seat === '35B', full.data);

// Other users cannot read this trip.
check('trip hidden from other families', (await call('GET', `/trips/${tripId}`, null, token2)).status === 404);

// Pair the parent's phone and walk the journey.
const pc = await call('POST', `/travellers/${travellerId}/pair-code`, null, token);
check('pair code issued', /^\d{6}$/.test(pc.data.code), pc);
const parent = await call('POST', '/auth/parent', { code: pc.data.code });
check('parent phone paired', parent.status === 200 && parent.data.token, parent);
const reuse = await call('POST', '/auth/parent', { code: pc.data.code });
check('pair code single use', reuse.status === 400, reuse);
const ptoken = parent.data.token;
check('parent cannot use family endpoints', (await call('GET', '/trips', null, ptoken)).status === 403);
const home = await call('GET', '/parent/home', null, ptoken);
check('parent home shows trip and companion', home.data.trip?.id === tripId && home.data.companions?.[0]?.name === 'Kamala Iyer' && home.data.family?.phone === '+12035550101', home.data);
const step = await call('POST', `/parent/trips/${tripId}/step`, { step: 3 }, ptoken);
check('journey progress saved', step.data.trip?.journeyStep === 3, step);
const help = await call('POST', `/parent/trips/${tripId}/help`, {}, ptoken);
check('help alert raised', help.status === 201, help);
const events = await call('GET', `/trips/${tripId}/events`, null, token);
const texts = events.data.events?.map((e) => e.text) ?? [];
check('family timeline has steps and help', texts.includes('Boarded the plane') && texts.some((t) => t.includes('I need help')), texts);
const status = await call('GET', `/trips/${tripId}/status`, null, token);
check('simulated flight status follows journey', status.data.status?.state === 'in_air', status.data);
const open = await call('GET', `/trips/${tripId}`, null, token);
const alertId = open.data.openHelpAlerts?.[0]?.id;
check('help alert resolved', (await call('POST', `/help/${alertId}/resolve`, null, token)).status === 200);

const grid = await call('GET', '/public/grid?from=2026-11-01&to=2026-11-30');
const ai101 = grid.data.flights?.find((g) => g.flightNumber === 'AI101' && g.date === '2026-11-14');
check('public grid counts travellers without names', ai101?.travellers >= 5 && !JSON.stringify(grid.data).includes('Meera'), grid.data);

const del = await call('DELETE', '/me', null, token2);
check('account deletion', del.status === 200 && (await call('GET', '/me', null, token2)).status === 401, del);

// Website survey and waitlist
const ADMIN = process.env.ADMIN_TOKEN ?? 'local-admin-token';
const survey = await call('POST', '/public/survey', {
  role: 'family', email: 'survey@example.com', mayContact: true, mayQuote: false,
  answers: { lives_in: 'USA', worries: ['layovers', 'immigration'], would_use: 'yes', pay: '5_10' },
});
check('survey saved', survey.status === 201, survey);
check('survey bot honeypot ignored', (await call('POST', '/public/survey', { role: 'family', website: 'spam', answers: {} })).status === 200);
check('survey bad role rejected', (await call('POST', '/public/survey', { role: 'robot', answers: {} })).status === 400);
const wl = await call('POST', '/public/waitlist', { email: 'wait@example.com', platform: 'ios', source: 'hero' });
check('waitlist joined', wl.status === 201, wl);
check('admin needs token', (await call('GET', '/admin/survey/summary')).status === 401);
const summary = await call('GET', '/admin/survey/summary', null, ADMIN);
check('survey summary counts answers', summary.data.responses >= 1 && summary.data.questions?.worries?.layovers >= 1 && summary.data.waitlist >= 2, summary.data);
const story = await call('POST', '/public/stories', { name: 'Anjali', location: 'Stamford, CT', story: 'Maa met a lovely aunty on AI 101.' });
check('story submitted', story.status === 201, story);
check('unapproved story hidden', !(await call('GET', '/public/stories')).data.stories.some((s) => s.name === 'Anjali'));

// Contact form
const msg = await call('POST', '/public/messages', { name: 'Anjali', email: 'anjali@example.com', topic: 'privacy', message: 'Please delete my survey answers.' });
check('contact message saved', msg.status === 201, msg);
check('contact needs a reply address', (await call('POST', '/public/messages', { name: 'A', message: 'hi' })).status === 400);
check('contact rejects unknown topic', (await call('POST', '/public/messages', { name: 'A', email: 'a@example.com', topic: 'spam', message: 'hi' })).status === 400);
check('messages need admin token', (await call('GET', '/admin/messages')).status === 401);
const inbox = await call('GET', '/admin/messages', null, ADMIN);
const mine = inbox.data.messages?.find((m) => m.message === 'Please delete my survey answers.');
check('message in admin inbox', mine?.topic === 'privacy', inbox.data);
await call('POST', `/admin/messages/${mine.id}/handled`, null, ADMIN);
check('handled message leaves inbox', !(await call('GET', '/admin/messages', null, ADMIN)).data.messages.some((m) => m.id === mine.id));

console.log(failures ? `\n${failures} check(s) failed` : '\nAll checks passed');
process.exit(failures ? 1 : 0);
