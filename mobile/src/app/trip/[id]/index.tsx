import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Route } from '@/components/TripCard';
import { Avatar, Banner, Button, Card, Chip, ErrorBox, Header, Loading, Row, Screen, Toggle, Txt } from '@/components/ui';
import { call, whatsapp } from '@/lib/contact';
import { clock, flightLabel, shortDate, timeAgo } from '@/lib/format';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';
import type { Companion, FlightStatus, Traveller, Trip, TripEvent } from '@/lib/types';
import { useLoad } from '@/lib/useLoad';

interface Detail {
  trip: Trip;
  traveller: Traveller;
  companions: Companion[];
  openHelpAlerts: { id: string; step: number; created_at: string }[];
}

export default function TripDetail() {
  const { api } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad(async () => {
    const [d, e, s] = await Promise.all([
      api<Detail>('GET', `/trips/${id}`),
      api<{ events: TripEvent[] }>('GET', `/trips/${id}/events`),
      api<{ status: FlightStatus }>('GET', `/trips/${id}/status`),
    ]);
    return { ...d, events: e.events, status: s.status };
  }, [api, id]);
  const [busy, setBusy] = useState(false);

  // Keep the travel-day view fresh while it is open.
  useEffect(() => {
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
  }, [reload]);

  if (!data) {
    return (
      <Screen>
        <Header title="Trip" onBack={() => router.back()} />
        {error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />}
      </Screen>
    );
  }

  const { trip, traveller, companions, events, status, openHelpAlerts } = data;
  const who = traveller.relation ?? traveller.name.split(' ')[0];
  const live = trip.journeyStep > 0 || status.state !== 'scheduled';

  async function setSeeking(v: boolean) {
    setBusy(true);
    try {
      await api('PATCH', `/trips/${trip.id}`, { seeking: v });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  async function resolve(alertId: string) {
    await api('POST', `/help/${alertId}/resolve`);
    reload();
  }

  function remove() {
    const run = async () => {
      await api('DELETE', `/trips/${trip.id}`);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.('Delete this trip?')) run();
      return;
    }
    Alert.alert('Delete this trip?', 'Any introductions for it will be removed too.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: run },
    ]);
  }

  return (
    <Screen>
      <Header
        title={live ? 'Travel day' : `${who}'s trip`}
        onBack={() => router.back()}
        right={live ? <Chip label="Live" tone="red" icon="radio-button-on" /> : null}
      />

      {openHelpAlerts.map((h) => (
        <View key={h.id} accessibilityRole="alert" style={{ backgroundColor: colors.redSoft, borderColor: colors.red, borderWidth: 2, borderRadius: 20, padding: 16, gap: 10 }}>
          <Txt variant="title" style={{ color: colors.red }}>
            {who} asked for help · {timeAgo(h.created_at)}
          </Txt>
          <Row gap={10}>
            {traveller.phone ? <Button label={`Call ${who}`} icon="call" tone="danger" onPress={() => call(traveller.phone!)} style={{ flex: 1 }} /> : null}
            <Button label="Sorted" tone="outline" onPress={() => resolve(h.id)} style={{ flex: 1 }} />
          </Row>
        </View>
      ))}

      <View style={{ backgroundColor: colors.navy, borderRadius: 24, padding: 20, gap: 14 }}>
        <Txt style={{ color: colors.onNavyMuted, fontSize: 15 }}>
          {flightLabel(trip.flightNumber)} · {shortDate(trip.flightDate)}
        </Txt>
        <Txt style={{ color: '#FFFFFF', fontSize: 26, lineHeight: 32, fontFamily: fonts.bold }}>{headline(who, status, companions)}</Txt>
        <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.navySoft }}>
          <View style={{ width: `${Math.max(4, status.progressPercent)}%`, height: 10, borderRadius: 5, backgroundColor: colors.marigold }} />
        </View>
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt style={{ color: '#FFFFFF', fontSize: 15 }}>
            {trip.origin} {trip.departTime ?? ''}
          </Txt>
          <Txt style={{ color: '#FFFFFF', fontSize: 15 }}>
            {trip.destination} {trip.arriveTime ?? ''}
          </Txt>
        </Row>
        <Txt style={{ color: colors.onNavyMuted, fontSize: 15 }}>
          {status.label}
          {status.provider === 'mock' ? ' · live flight data not connected yet' : ''}
        </Txt>
      </View>

      <Card>
        <Route trip={trip} />
        {trip.wheelchair ? <Chip label="Wheelchair booked" tone="teal" icon="accessibility" /> : null}
      </Card>

      {companions.length ? <Txt variant="label">Travelling with</Txt> : null}
      {companions.map((c) => (
        <Card key={c.tripId} style={{ gap: 12 }}>
          <Row gap={12}>
            <Avatar initials={c.initials} seed={c.name} size={52} />
            <View style={{ flex: 1 }}>
              <Txt variant="title">
                {c.name}
                {c.age ? `, ${c.age}` : ''}
              </Txt>
              <Txt variant="small" style={{ fontSize: 14 }}>
                {[c.homeCity, c.seat ? `Seat ${c.seat}` : null, c.languages.join(', ')].filter(Boolean).join(' · ')}
              </Txt>
            </View>
          </Row>
          {c.contact?.familyName ? (
            <Txt variant="small">
              Family: {c.contact.familyName}
              {c.contact.familyPhone ? ` · ${c.contact.familyPhone}` : ''}
            </Txt>
          ) : null}
          <Row gap={10}>
            {c.contact?.travellerPhone ? (
              <Button label={`Call ${c.name.split(' ')[0]}`} icon="call" onPress={() => call(c.contact!.travellerPhone!)} style={{ flex: 1 }} fontSize={15} />
            ) : null}
            {c.contact?.familyPhone ? (
              <Button label="WhatsApp family" icon="logo-whatsapp" tone="outline" onPress={() => whatsapp(c.contact!.familyPhone!)} style={{ flex: 1 }} fontSize={15} />
            ) : null}
          </Row>
        </Card>
      ))}

      {trip.seeking ? (
        <Button label={companions.length ? 'See other travellers' : 'Find a companion'} tone="gold" icon="people" onPress={() => router.push(`/trip/${trip.id}/matches`)} />
      ) : null}

      {trip.arriveTime && !companions.length && !live ? (
        <Banner icon="time">
          <Txt style={{ color: colors.brownDeep }}>Families usually find a companion 2–3 weeks before the flight. We'll tell you when someone on {flightLabel(trip.flightNumber)} joins.</Txt>
        </Banner>
      ) : null}

      <Card style={{ gap: 4 }}>
        <Txt variant="label" style={{ paddingBottom: 8 }}>
          Updates
        </Txt>
        {events.length === 0 ? <Txt variant="small">Updates appear here on travel day as {who} checks in, boards and lands.</Txt> : null}
        {events.map((e, i) => (
          <Row key={e.id} gap={12} style={{ alignItems: 'stretch' }}>
            <View style={{ alignItems: 'center', width: 18 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, marginTop: 5, backgroundColor: e.kind === 'help' ? colors.red : i === 0 ? colors.marigold : colors.teal }} />
              {i < events.length - 1 ? <View style={{ flex: 1, width: 2, backgroundColor: colors.line, minHeight: 20 }} /> : null}
            </View>
            <View style={{ flex: 1, paddingBottom: 14 }}>
              <Txt variant="title" style={{ fontSize: 16, color: e.kind === 'help' ? colors.red : colors.ink }}>
                {e.text}
              </Txt>
              <Txt variant="caption">{clock(e.at)}</Txt>
            </View>
          </Row>
        ))}
      </Card>

      <Card>
        <Toggle label="Look for companions" hint="Turn off if you no longer need company for this trip." value={trip.seeking} onChange={setSeeking} />
        {busy ? <Loading /> : null}
      </Card>
      <Button label="Delete trip" tone="ghost" onPress={remove} />
    </Screen>
  );
}

function headline(who: string, s: FlightStatus, companions: Companion[]): string {
  const withWhom = companions[0] ? `, with ${companions[0].name.split(' ')[0]}` : '';
  switch (s.state) {
    case 'boarding':
      return `${who} is boarding${withWhom}`;
    case 'in_air':
      return `${who} is in the air${withWhom}`;
    case 'landed':
      return `${who} has landed`;
    case 'cancelled':
      return 'Flight cancelled. Check with the airline.';
    default:
      return companions[0] ? `${who} will travel with ${companions[0].name.split(' ')[0]}` : `${who}'s flight is on schedule`;
  }
}
