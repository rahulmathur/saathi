import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Avatar, Banner, Button, Card, Chip, ErrorBox, Field, Row, Screen, Txt } from '@/components/ui';
import { useSession } from '@/lib/session';
import type { Traveller, User } from '@/lib/types';
import { useLoad } from '@/lib/useLoad';

export default function Account() {
  const { api, signOut } = useSession();
  const { welcome } = useLocalSearchParams<{ welcome?: string }>();
  const { data, error, reload } = useLoad(async () => {
    const [me, t] = await Promise.all([api<{ user: User }>('GET', '/me'), api<{ travellers: Traveller[] }>('GET', '/travellers')]);
    return { user: me.user, travellers: t.travellers };
  }, [api]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (data) {
      setName(data.user.name ?? '');
      setPhone(data.user.phone ?? '');
    }
  }, [data]);

  async function save() {
    setBusy(true);
    setSaveError(null);
    try {
      await api('PATCH', '/me', { name: name.trim() || null, phone: phone.replace(/[\s()-]/g, '') || null });
      setSaved(true);
      if (welcome && !data?.travellers.length) router.push('/traveller/edit');
    } catch (e) {
      setSaveError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    const run = async () => {
      await api('DELETE', '/me');
      await signOut();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Delete your account and all trips? This cannot be undone.')) run();
      return;
    }
    Alert.alert('Delete account?', 'This removes your family members, trips and introductions. It cannot be undone.', [
      { text: 'Keep my account', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  }

  return (
    <Screen>
      <Txt variant="h2">Your family</Txt>
      {welcome ? (
        <Banner icon="sparkles">
          <Txt style={{ color: '#4A2E00' }}>Welcome to Saathi. Add your name and phone so other families can reach you once you agree to travel together.</Txt>
        </Banner>
      ) : null}
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <Card>
        <Txt variant="label">You</Txt>
        <Field label="Your name" value={name} onChangeText={(v) => (setName(v), setSaved(false))} placeholder="Anjali Sharma" autoComplete="name" />
        <Field
          label="Mobile number (with country code)"
          hint="Used for WhatsApp updates on travel day. Shared only with families you accept."
          value={phone}
          onChangeText={(v) => (setPhone(v), setSaved(false))}
          placeholder="+1 203 555 0101"
          keyboardType="phone-pad"
          autoComplete="tel"
        />
        {saveError ? <ErrorBox message={saveError} /> : null}
        <Button label={saved ? 'Saved' : 'Save'} icon={saved ? 'checkmark' : undefined} tone={saved ? 'success' : 'primary'} onPress={save} loading={busy} />
        {data ? <Txt variant="caption">Signed in as {data.user.email}</Txt> : null}
      </Card>

      <Txt variant="label">Family members</Txt>
      {data?.travellers.map((t) => (
        <Card key={t.id} style={{ gap: 12 }}>
          <Row gap={12}>
            <Avatar initials={t.initials} seed={t.name} />
            <View style={{ flex: 1 }}>
              <Txt variant="title">{t.relation ? `${t.relation} · ${t.name}` : t.name}</Txt>
              <Txt variant="small" style={{ fontSize: 14 }}>
                {[t.age ? `${t.age}` : null, t.homeCity, t.languages.join(', ')].filter(Boolean).join(' · ')}
              </Txt>
            </View>
            {t.kind === 'helper' ? <Chip label="Helper" tone="teal" /> : null}
          </Row>
          <Row gap={10}>
            <Button label="Edit" tone="outline" onPress={() => router.push(`/traveller/edit?id=${t.id}`)} style={{ flex: 1 }} />
            <Button label="Set up their phone" icon="phone-portrait" onPress={() => router.push(`/traveller/pair?id=${t.id}`)} style={{ flex: 1.4 }} fontSize={15} />
          </Row>
        </Card>
      ))}
      <Button label="Add a family member" icon="person-add" tone="gold" onPress={() => router.push('/traveller/edit')} />

      <View style={{ gap: 10, marginTop: 12 }}>
        <Button label="Sign out" tone="outline" onPress={signOut} />
        <Button label="Delete my account" tone="ghost" onPress={confirmDelete} />
      </View>
    </Screen>
  );
}
