import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Avatar, Button, Card, Chip, ErrorBox, Loading, Row, Screen, Txt } from '@/components/ui';
import { flightLabel, relationLabel, shortDate, timeAgo } from '@/lib/format';
import { useSession } from '@/lib/session';
import type { Intro } from '@/lib/types';
import { useLoad } from '@/lib/useLoad';

export default function Requests() {
  const { api } = useSession();
  const { data, error, loading, reload } = useLoad(() => api<{ incoming: Intro[]; outgoing: Intro[] }>('GET', '/intros'), [api]);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function respond(id: string, accept: boolean) {
    setBusy(id);
    setActionError(null);
    try {
      await api('POST', `/intros/${id}/respond`, { accept });
      await reload();
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function cancel(id: string) {
    setBusy(id);
    try {
      await api('POST', `/intros/${id}/cancel`);
      await reload();
    } finally {
      setBusy(null);
    }
  }

  const pending = data?.incoming.filter((i) => i.status === 'pending') ?? [];
  const connected = [...(data?.incoming ?? []), ...(data?.outgoing ?? [])].filter((i) => i.status === 'accepted');
  const waiting = data?.outgoing.filter((i) => i.status === 'pending') ?? [];

  return (
    <Screen>
      <Txt variant="h2">Requests</Txt>
      {error ? <ErrorBox message={error} onRetry={reload} /> : null}
      {actionError ? <ErrorBox message={actionError} /> : null}
      {!data && loading ? <Loading /> : null}

      {data && !pending.length && !connected.length && !waiting.length ? (
        <Card>
          <Txt variant="title">No requests yet</Txt>
          <Txt>When another family asks to travel with yours, it will show here. You can also look for companions from any trip.</Txt>
        </Card>
      ) : null}

      {pending.length ? <Txt variant="label">Asking to travel with you</Txt> : null}
      {pending.map((i) => (
        <IntroCard key={i.id} intro={i}>
          {i.message ? <Txt style={{ fontStyle: 'italic' }}>"{i.message}"</Txt> : null}
          <Row gap={10}>
            <Button label="Accept" icon="checkmark" onPress={() => respond(i.id, true)} loading={busy === i.id} style={{ flex: 1 }} />
            <Button label="Decline" tone="outline" onPress={() => respond(i.id, false)} disabled={busy === i.id} style={{ flex: 1 }} />
          </Row>
          <Txt variant="caption">Accepting shares your names and phone numbers with each other.</Txt>
        </IntroCard>
      ))}

      {connected.length ? <Txt variant="label">Travelling together</Txt> : null}
      {connected.map((i) => (
        <IntroCard key={i.id} intro={i}>
          <Button label="Open trip" tone="outline" onPress={() => router.push(`/trip/${i.myTripId}`)} />
        </IntroCard>
      ))}

      {waiting.length ? <Txt variant="label">Waiting for a reply</Txt> : null}
      {waiting.map((i) => (
        <IntroCard key={i.id} intro={i}>
          <Button label="Withdraw request" tone="ghost" onPress={() => cancel(i.id)} loading={busy === i.id} />
        </IntroCard>
      ))}
    </Screen>
  );
}

function IntroCard({ intro, children }: { intro: Intro; children: React.ReactNode }) {
  const c = intro.companion;
  const forWhom = intro.myTraveller?.relation ?? intro.myTraveller?.name.split(' ')[0];
  return (
    <Card style={{ gap: 12 }}>
      <Row gap={12} style={{ alignItems: 'flex-start' }}>
        <Avatar initials={c.initials} seed={c.name} size={52} />
        <View style={{ flex: 1, gap: 2 }}>
          <Txt variant="title">
            {c.name}
            {c.age ? `, ${c.age}` : ''}
          </Txt>
          <Txt variant="small" style={{ fontSize: 14 }}>
            {[c.homeCity, c.languages.join(' · ')].filter(Boolean).join(' · ')}
          </Txt>
          <Txt variant="caption">
            For {forWhom} · {flightLabel(c.flightNumber)} · {shortDate(c.flightDate)} · {timeAgo(intro.createdAt)}
          </Txt>
        </View>
      </Row>
      <Row gap={6} style={{ flexWrap: 'wrap' }}>
        <Chip label={relationLabel(c.relation, c.gapMinutes, c.seat)} tone="gold" />
        {c.idVerified ? <Chip label="ID verified" tone="teal" icon="shield-checkmark" /> : null}
      </Row>
      {c.contact ? (
        <Txt variant="small">
          {c.contact.familyName ? `Family: ${c.contact.familyName}` : ''}
          {c.contact.familyPhone ? ` · ${c.contact.familyPhone}` : ''}
        </Txt>
      ) : null}
      {children}
    </Card>
  );
}
