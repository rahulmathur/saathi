import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Button, Card, Chip, ErrorBox, Header, Icon, Row, Screen, Txt } from '@/components/ui';
import { matchCache } from '@/lib/contact';
import { flightLabel, relationLabel } from '@/lib/format';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

export default function CompanionProfile() {
  const { api } = useSession();
  const { id, other } = useLocalSearchParams<{ id: string; other: string }>();
  const m = matchCache.get(other);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(m?.intro?.status === 'pending' && m.intro.direction === 'outgoing');
  const [error, setError] = useState<string | null>(null);

  if (!m) {
    return (
      <Screen>
        <Header title="Traveller" onBack={() => router.back()} />
        <ErrorBox message="This traveller is no longer listed." />
      </Screen>
    );
  }

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/trips/${id}/intros`, { toTripId: m!.tripId });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const trust = [
    m.idVerified ? 'Government ID checked' : null,
    m.vouchedBy ? `Vouched for by ${m.vouchedBy}` : null,
    m.sharedLanguages.length ? `Speaks ${m.sharedLanguages.join(' and ')}, like yours` : null,
  ].filter(Boolean) as string[];

  return (
    <Screen>
      <Header title="" onBack={() => router.back()} />
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Avatar initials={m.initials} ring size={104} />
        <Txt variant="h2">{m.name}</Txt>
        <Txt variant="small" style={{ fontSize: 16, textAlign: 'center' }}>
          {[m.age, m.homeCity, m.visitingCity ? `visiting ${m.visitingCity}` : null].filter(Boolean).join(' · ')}
        </Txt>
        <Chip label={`${flightLabel(m.flightNumber)} · ${relationLabel(m.relation, m.gapMinutes, m.seat)}`} tone="gold" icon="airplane" />
      </View>

      {trust.length ? (
        <Card style={{ gap: 12 }}>
          <Txt variant="label">Why you can trust this match</Txt>
          {trust.map((t) => (
            <Row key={t} gap={10}>
              <Icon name="shield-checkmark" color={colors.teal} />
              <Txt style={{ flex: 1 }}>{t}</Txt>
            </Row>
          ))}
        </Card>
      ) : null}

      <Row gap={10} style={{ flexWrap: 'wrap' }}>
        <Fact label="Speaks" value={m.languages.join(', ') || '—'} />
        <Fact label="Food" value={m.diet ?? '—'} />
        <Fact label="Getting around" value={m.mobility ?? '—'} />
        <Fact label="Role" value={m.kind === 'helper' ? 'Happy to help' : 'Fellow traveller'} />
      </Row>

      {m.about ? (
        <Card>
          <Txt>{m.about}</Txt>
        </Card>
      ) : null}

      {error ? <ErrorBox message={error} /> : null}
      {m.intro?.status === 'accepted' ? (
        <Button label="Travelling together" icon="checkmark-circle" tone="success" onPress={() => router.push(`/trip/${id}`)} />
      ) : sent ? (
        <Button label="Request sent to their family" icon="checkmark" tone="success" />
      ) : (
        <Button label="Request an introduction" tone="gold" onPress={ask} loading={busy} big />
      )}
      <Txt variant="small">
        Saathi companions offer company, not medical care. Book wheelchair or meet-and-assist services with the airline.
      </Txt>
    </Screen>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: colors.card, borderRadius: 18, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 4 }}>
      <Txt variant="caption">{label}</Txt>
      <Txt variant="title" style={{ fontSize: 16 }}>
        {value}
      </Txt>
    </View>
  );
}
