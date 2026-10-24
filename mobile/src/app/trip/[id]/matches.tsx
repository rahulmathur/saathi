import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Avatar, Button, Card, Chip, ErrorBox, Header, Icon, Loading, Pill, Row, Screen, Txt } from '@/components/ui';
import { matchCache } from '@/lib/contact';
import { city, flightLabel, relationLabel, shortDate } from '@/lib/format';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';
import type { Match, Trip } from '@/lib/types';
import { useLoad } from '@/lib/useLoad';

const FILTERS = [
  ['all', 'Everyone'],
  ['language', 'Same language'],
  ['senior', 'Fellow seniors'],
  ['helper', 'Young helpers'],
] as const;

export default function Matches() {
  const { api } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>('all');
  const { data, error, loading, reload } = useLoad(async () => {
    const r = await api<{ trip: Trip; matches: Match[] }>('GET', `/trips/${id}/matches?filter=${filter}`);
    r.matches.forEach((m) => matchCache.set(m.tripId, m));
    return r;
  }, [api, id, filter]);

  return (
    <Screen>
      <Header title="Find a companion" onBack={() => router.back()} />
      {data ? (
        <Row gap={12} style={{ backgroundColor: colors.navy, borderRadius: 18, padding: 16 }}>
          <Icon name="airplane" color={colors.marigold} size={24} />
          <View style={{ flex: 1 }}>
            <Txt variant="title" style={{ color: '#FFFFFF' }}>
              {flightLabel(data.trip.flightNumber)} · {city(data.trip.origin)} → {city(data.trip.destination)}
            </Txt>
            <Txt style={{ color: colors.onNavyMuted, fontSize: 14 }}>
              {shortDate(data.trip.flightDate)} · {data.matches.length} traveller{data.matches.length === 1 ? '' : 's'} around this flight
            </Txt>
          </View>
        </Row>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map(([k, label]) => (
          <Pill key={k} label={label} on={filter === k} onPress={() => setFilter(k)} />
        ))}
      </ScrollView>

      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {!data && loading ? <Loading /> : null}

      {data && data.matches.length === 0 ? (
        <Card>
          <Txt variant="title">No one yet</Txt>
          <Txt>
            {filter === 'all'
              ? "Nobody on Saathi is on or near this flight yet. Most companions join 2–3 weeks before. We'll let you know."
              : 'No one matches this filter. Try "Everyone".'}
          </Txt>
        </Card>
      ) : null}

      {data?.matches.map((m) => (
        <MatchCard key={m.tripId} match={m} tripId={id} onChange={reload} />
      ))}

      <Txt variant="small" style={{ textAlign: 'center' }}>
        Families are introduced first. Phone numbers are shared only when both sides say yes.
      </Txt>
    </Screen>
  );
}

function MatchCard({ match: m, tripId, onChange }: { match: Match; tripId: string; onChange: () => void }) {
  const { api } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask() {
    setBusy(true);
    setError(null);
    try {
      await api('POST', `/trips/${tripId}/intros`, { toTripId: m.tripId });
      onChange();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const st = m.intro?.status;
  return (
    <Card style={{ gap: 12, padding: 18 }}>
      <Pressable onPress={() => router.push(`/trip/${tripId}/companion?other=${m.tripId}`)} accessibilityRole="button" accessibilityLabel={`View ${m.name}`}>
        <Row gap={12} style={{ alignItems: 'flex-start' }}>
          <Avatar initials={m.initials} seed={m.name} size={56} />
          <View style={{ flex: 1, gap: 3 }}>
            <Txt variant="title">
              {m.name}
              {m.age ? `, ${m.age}` : ''}
            </Txt>
            <Txt variant="small" style={{ fontSize: 14 }}>
              {[m.homeCity, m.visitingCity ? `visiting ${m.visitingCity}` : null].filter(Boolean).join(' → ')}
            </Txt>
            <Txt style={{ fontSize: 14 }}>{m.languages.join(' · ')}</Txt>
          </View>
          <Icon name="chevron-forward" color={colors.muted} />
        </Row>
      </Pressable>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <Chip label={relationLabel(m.relation, m.gapMinutes, m.seat)} tone={m.relation === 'same_flight' ? 'gold' : 'grey'} />
        {m.kind === 'helper' ? <Chip label="Offers help" tone="teal" icon="hand-left" /> : null}
        {m.idVerified ? <Chip label="ID verified" tone="teal" icon="shield-checkmark" /> : null}
        {m.vouchedBy ? <Chip label="Community vouched" tone="teal" icon="people" /> : null}
      </Row>
      {m.about ? <Txt style={{ fontSize: 15 }}>{m.about}</Txt> : null}
      {error ? <ErrorBox message={error} /> : null}
      {st === 'accepted' ? (
        <Button label="Travelling together" icon="checkmark-circle" tone="success" onPress={() => router.push(`/trip/${tripId}`)} />
      ) : st === 'pending' && m.intro?.direction === 'outgoing' ? (
        <Button label="Request sent to their family" icon="checkmark" tone="success" />
      ) : st === 'pending' ? (
        <Button label="They asked you. Accept?" icon="mail-unread" tone="gold" onPress={ask} loading={busy} />
      ) : st === 'declined' ? (
        <Txt variant="small">Not available this time.</Txt>
      ) : (
        <Button label="Request an introduction" tone="gold" onPress={ask} loading={busy} />
      )}
    </Card>
  );
}
