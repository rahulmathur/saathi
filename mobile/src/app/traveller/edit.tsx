import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Button, Card, ErrorBox, Field, Header, Pill, Row, Screen, Txt } from '@/components/ui';
import { useSession } from '@/lib/session';
import type { Traveller } from '@/lib/types';

const LANGUAGES = ['Hindi', 'English', 'Gujarati', 'Punjabi', 'Marathi', 'Bengali', 'Tamil', 'Telugu', 'Kannada', 'Malayalam', 'Urdu', 'Odia'];
const RELATIONS = ['Maa', 'Papa', 'Mummy', 'Dad', 'Amma', 'Appa', 'Nani', 'Nana', 'Dadi', 'Dada', 'Me'];

export default function EditTraveller() {
  const { api } = useSession();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [f, setF] = useState({ name: '', relation: '', age: '', homeCity: '', visitingCity: '', diet: '', mobility: '', phone: '', about: '' });
  const [languages, setLanguages] = useState<string[]>(['Hindi', 'English']);
  const [kind, setKind] = useState<'senior' | 'helper'>('senior');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api<{ travellers: Traveller[] }>('GET', '/travellers').then(({ travellers }) => {
      const t = travellers.find((x) => x.id === id);
      if (!t) return;
      setF({
        name: t.name,
        relation: t.relation ?? '',
        age: t.age ? String(t.age) : '',
        homeCity: t.homeCity ?? '',
        visitingCity: t.visitingCity ?? '',
        diet: t.diet ?? '',
        mobility: t.mobility ?? '',
        phone: t.phone ?? '',
        about: t.about ?? '',
      });
      setLanguages(t.languages);
      setKind(t.kind);
    });
  }, [id, api]);

  const set = (k: keyof typeof f) => (v: string) => setF((x) => ({ ...x, [k]: v }));
  const toggleLang = (l: string) => setLanguages((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]));

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        name: f.name.trim(),
        relation: f.relation.trim() || null,
        age: f.age ? Number(f.age) : null,
        kind,
        homeCity: f.homeCity.trim() || null,
        visitingCity: f.visitingCity.trim() || null,
        languages,
        diet: f.diet.trim() || null,
        mobility: f.mobility.trim() || null,
        phone: f.phone.replace(/[\s()-]/g, '') || null,
        about: f.about.trim() || null,
      };
      if (id) await api('PATCH', `/travellers/${id}`, body);
      else await api('POST', '/travellers', body);
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function remove() {
    const run = async () => {
      await api('DELETE', `/travellers/${id}`);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(`Remove ${f.name} and their trips?`)) run();
      return;
    }
    Alert.alert(`Remove ${f.name}?`, 'Their trips and introductions will be removed too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: run },
    ]);
  }

  return (
    <Screen>
      <Header title={id ? 'Edit details' : 'Add a family member'} onBack={() => router.back()} />
      <Card>
        <Field label="Full name" value={f.name} onChangeText={set('name')} placeholder="Sushila Sharma" autoComplete="name" />
        <View style={{ gap: 8 }}>
          <Txt variant="label">What do you call them?</Txt>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {RELATIONS.map((r) => (
              <Pill key={r} label={r} on={f.relation === r} onPress={() => (set('relation')(r), setKind(r === 'Me' ? 'helper' : 'senior'))} />
            ))}
          </Row>
        </View>
        <Row gap={10}>
          <View style={{ flex: 1 }}>
            <Field label="Age" value={f.age} onChangeText={(v) => set('age')(v.replace(/\D/g, '').slice(0, 3))} keyboardType="number-pad" />
          </View>
          <View style={{ flex: 2 }}>
            <Field label="Home city" value={f.homeCity} onChangeText={set('homeCity')} placeholder="Lucknow" />
          </View>
        </Row>
        <Field label="Visiting" value={f.visitingCity} onChangeText={set('visitingCity')} placeholder="Edison, NJ" />
        <View style={{ gap: 8 }}>
          <Txt variant="label">Languages they speak</Txt>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            {LANGUAGES.map((l) => (
              <Pill key={l} label={l} on={languages.includes(l)} onPress={() => toggleLang(l)} />
            ))}
          </Row>
        </View>
      </Card>

      <Card>
        <View style={{ gap: 8 }}>
          <Txt variant="label">On the flight, they are</Txt>
          <Row gap={8}>
            <Pill label="Looking for company" on={kind === 'senior'} onPress={() => setKind('senior')} />
            <Pill label="Happy to help others" on={kind === 'helper'} onPress={() => setKind('helper')} />
          </Row>
        </View>
        <Field label="Food" value={f.diet} onChangeText={set('diet')} placeholder="Vegetarian" />
        <Field label="Getting around" value={f.mobility} onChangeText={set('mobility')} placeholder="Walks slowly, needs a wheelchair at airports" />
        <Field
          label="Their mobile (with country code)"
          hint="Shared only with families you accept, and used if they press 'I need help'."
          value={f.phone}
          onChangeText={set('phone')}
          keyboardType="phone-pad"
          placeholder="+91 98 1234 5678"
        />
        <Field label="A little about them" value={f.about} onChangeText={set('about')} multiline placeholder="Loves to chat, first trip abroad alone..." />
      </Card>

      {error ? <ErrorBox message={error} /> : null}
      <Button label="Save" onPress={save} loading={busy} disabled={!f.name.trim()} />
      {id ? <Button label="Remove this person" tone="ghost" onPress={remove} /> : null}
    </Screen>
  );
}
