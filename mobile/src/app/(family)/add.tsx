import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Button, Card, ErrorBox, Field, Icon, Pill, Row, Screen, Toggle, Txt } from '@/components/ui';
import { flightLabel } from '@/lib/format';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';
import type { ParsedFlight, Traveller, Trip } from '@/lib/types';
import { useLoad } from '@/lib/useLoad';

const EMPTY = { flightNumber: '', flightDate: '', origin: '', destination: '', departTime: '', arriveTime: '', arriveDate: '', seat: '' };
type Form = typeof EMPTY;

export default function AddTrip() {
  const { api } = useSession();
  const { data: travellers } = useLoad(async () => (await api<{ travellers: Traveller[] }>('GET', '/travellers')).travellers, [api]);
  const [who, setWho] = useState<string | null>(null);
  const [mode, setMode] = useState<'paste' | 'type'>('paste');
  const [text, setText] = useState('');
  const [found, setFound] = useState<ParsedFlight[] | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [wheelchair, setWheelchair] = useState(false);
  const [seeking, setSeeking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!who && travellers?.length) setWho(travellers[0].id);
  }, [travellers, who]);

  const set = (k: keyof Form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function readEmail() {
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ flights: ParsedFlight[] }>('POST', '/trips/parse', { text });
      setFound(r.flights);
      if (r.flights.length === 1) use(r.flights[0]);
      if (!r.flights.length) setError("We couldn't find a flight in that text. You can type the details instead.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function use(f: ParsedFlight) {
    setForm({
      flightNumber: flightLabel(f.flightNumber),
      flightDate: f.date ?? '',
      origin: f.origin ?? '',
      destination: f.destination ?? '',
      departTime: f.departTime ?? '',
      arriveTime: f.arriveTime ?? '',
      arriveDate: '',
      seat: f.seat ?? '',
    });
    setMode('type');
  }

  async function save() {
    if (!who) return;
    setBusy(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { travellerId: who, wheelchair, seeking };
      for (const [k, v] of Object.entries(form)) if (v.trim()) body[k] = v.trim();
      const r = await api<{ trip: Trip }>('POST', '/trips', body);
      setForm(EMPTY);
      setText('');
      setFound(null);
      router.push(seeking ? `/trip/${r.trip.id}/matches` : `/trip/${r.trip.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const ready = form.flightNumber && form.flightDate && form.origin && form.destination;

  return (
    <Screen>
      <Txt variant="h2">Add a trip</Txt>

      <View style={{ gap: 10 }}>
        <Txt variant="label">Who is travelling?</Txt>
        <Row style={{ flexWrap: 'wrap' }} gap={8}>
          {travellers?.map((t) => (
            <Pill key={t.id} label={t.relation ? `${t.relation} (${t.name.split(' ')[0]})` : t.name} on={who === t.id} onPress={() => setWho(t.id)} />
          ))}
          <Pill label="+ Add" on={false} onPress={() => router.push('/traveller/edit')} />
        </Row>
      </View>

      <Row gap={8}>
        <ModeTile icon="mail-open" label="Paste booking email" on={mode === 'paste'} onPress={() => setMode('paste')} />
        <ModeTile icon="create" label="Type it in" on={mode === 'type'} onPress={() => setMode('type')} />
      </Row>

      {mode === 'paste' ? (
        <Card>
          <Field
            label="Booking confirmation"
            hint="Copy the airline's confirmation email or e-ticket text and paste it here. We only read the flight details."
            value={text}
            onChangeText={setText}
            multiline
            placeholder="Paste the email here"
          />
          <Button label="Read flight details" icon="sparkles" onPress={readEmail} loading={busy} disabled={text.trim().length < 10} />
          {found && found.length > 1 ? (
            <View style={{ gap: 8 }}>
              <Txt variant="label">We found {found.length} flights. Which one?</Txt>
              {found.map((f) => (
                <Pressable key={f.flightNumber} onPress={() => use(f)} style={{ padding: 14, borderRadius: 14, borderWidth: 1.5, borderColor: colors.line }}>
                  <Txt variant="title">
                    {flightLabel(f.flightNumber)} · {f.origin ?? '?'} → {f.destination ?? '?'}
                  </Txt>
                  <Txt variant="small">{[f.date, f.departTime].filter(Boolean).join(' · ')}</Txt>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Card>
      ) : (
        <Card>
          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <Field label="Flight number" value={form.flightNumber} onChangeText={set('flightNumber')} placeholder="AI 101" autoCapitalize="characters" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Date" value={form.flightDate} onChangeText={set('flightDate')} placeholder="2026-11-14" keyboardType="numbers-and-punctuation" />
            </View>
          </Row>
          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <Field label="From" value={form.origin} onChangeText={(v) => set('origin')(v.toUpperCase())} placeholder="DEL" autoCapitalize="characters" maxLength={3} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="To" value={form.destination} onChangeText={(v) => set('destination')(v.toUpperCase())} placeholder="JFK" autoCapitalize="characters" maxLength={3} />
            </View>
          </Row>
          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <Field label="Departs" value={form.departTime} onChangeText={set('departTime')} placeholder="02:10" keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Arrives" value={form.arriveTime} onChangeText={set('arriveTime')} placeholder="07:45" keyboardType="numbers-and-punctuation" />
            </View>
          </Row>
          <Row gap={10}>
            <View style={{ flex: 1 }}>
              <Field label="Arrival date" value={form.arriveDate} onChangeText={set('arriveDate')} placeholder="If different" keyboardType="numbers-and-punctuation" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Seat" value={form.seat} onChangeText={set('seat')} placeholder="32C" autoCapitalize="characters" maxLength={4} />
            </View>
          </Row>
          <Toggle label="Wheelchair booked with the airline" hint="We'll remind you to confirm it before the flight." value={wheelchair} onChange={setWheelchair} />
          <Toggle label="Look for companions" hint="Others see only the flight and date. Names stay private until both families agree." value={seeking} onChange={setSeeking} />
        </Card>
      )}

      {error ? <ErrorBox message={error} /> : null}
      {mode === 'type' ? <Button label={seeking ? 'Save and find companions' : 'Save trip'} onPress={save} loading={busy} disabled={!ready || !who} /> : null}
      {!travellers?.length ? <Txt variant="small">Add the person who is travelling first.</Txt> : null}
    </Screen>
  );
}

function ModeTile({ icon, label, on, onPress }: { icon: 'mail-open' | 'create'; label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={{
        flex: 1,
        minHeight: 92,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: on ? colors.marigold : colors.line,
        backgroundColor: on ? colors.marigoldSoft : colors.card,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 10,
      }}
    >
      <Icon name={icon} size={26} />
      <Txt variant="title" style={{ fontSize: 15, color: colors.navy, textAlign: 'center' }}>
        {label}
      </Txt>
    </Pressable>
  );
}
