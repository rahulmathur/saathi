import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LogoMark } from '@/components/Logo';
import { Route } from '@/components/TripCard';
import { Avatar, Button, Card, Chip, Divider, ErrorBox, Icon, Loading, Row, Txt } from '@/components/ui';
import { todayIso, todayLong } from '@/lib/format';
import { onboarding, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';
import type { Traveller, TripSummary, User } from '@/lib/types';
import { useLoad } from '@/lib/useLoad';

export default function Home() {
  const { api } = useSession();
  const { data, error, loading, reload } = useLoad(async () => {
    const [me, trips, travellers] = await Promise.all([
      api<{ user: User }>('GET', '/me'),
      api<{ trips: TripSummary[] }>('GET', '/trips'),
      api<{ travellers: Traveller[] }>('GET', '/travellers'),
    ]);
    return { user: me.user, trips: trips.trips, travellers: travellers.travellers };
  }, [api]);

  useEffect(() => {
    if (onboarding.pending) {
      onboarding.pending = false;
      router.push('/account?welcome=1');
    }
  }, []);

  const today = todayIso();
  const upcoming = data?.trips.filter((t) => (t.arriveDate ?? t.flightDate) >= today) ?? [];
  const past = data?.trips.filter((t) => (t.arriveDate ?? t.flightDate) < today) ?? [];
  const withoutTrips = data?.travellers.filter((tr) => !upcoming.some((t) => t.travellerId === tr.id)) ?? [];
  const firstName = data?.user.name?.split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.ground }} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={{ padding: 20, gap: 20 }} refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={reload} />}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Row gap={10}>
            <LogoMark />
            <Txt variant="h2" style={{ fontSize: 24, color: colors.navy }}>
              Saathi
            </Txt>
          </Row>
        </Row>
        <View style={{ gap: 4 }}>
          <Txt variant="small">{todayLong()}</Txt>
          <Txt variant="h1">{firstName ? `Hello, ${firstName}` : 'Hello'}</Txt>
        </View>

        {error ? <ErrorBox message={error} onRetry={reload} /> : null}
        {!data && loading ? <Loading /> : null}

        {upcoming.map((t) => (
          <TripCard key={t.id} trip={t} />
        ))}

        {withoutTrips.map((tr) => (
          <Card key={tr.id} style={{ gap: 10 }}>
            <Row style={{ justifyContent: 'space-between' }}>
              <Txt variant="label">{tr.relation ? `${tr.relation}'s trip` : tr.name}</Txt>
              <Chip label="No trip yet" tone="gold" />
            </Row>
            <Txt>Add the flight when it is booked and we'll start looking for company.</Txt>
          </Card>
        ))}

        {data && data.travellers.length === 0 ? (
          <Card>
            <Txt variant="title">Who are you looking after?</Txt>
            <Txt>Add your parent, or yourself if you'd like to help other travellers.</Txt>
            <Button label="Add a family member" icon="person-add" onPress={() => router.push('/traveller/edit')} />
          </Card>
        ) : null}

        {data && data.travellers.length > 0 ? (
          <Pressable
            onPress={() => router.push('/add')}
            accessibilityRole="button"
            style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.lineStrong, borderRadius: 22 }}
          >
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.marigold, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="add" size={28} />
            </View>
            <View style={{ flex: 1 }}>
              <Txt variant="title" style={{ color: colors.navy }}>
                Add a trip
              </Txt>
              <Txt variant="small">Paste the booking email. We do the rest.</Txt>
            </View>
          </Pressable>
        ) : null}

        {past.length ? (
          <View style={{ gap: 10 }}>
            <Txt variant="label">Past trips</Txt>
            {past
              .slice(-5)
              .reverse()
              .map((t) => (
                <Pressable key={t.id} onPress={() => router.push(`/trip/${t.id}`)} style={{ padding: 14, backgroundColor: colors.card, borderRadius: 16 }}>
                  <Txt>
                    {t.traveller.relation ?? t.traveller.name} · {t.origin} → {t.destination} · {t.flightDate}
                  </Txt>
                </Pressable>
              ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function TripCard({ trip }: { trip: TripSummary }) {
  const who = trip.traveller.relation ? `${trip.traveller.relation}'s trip` : `${trip.traveller.name.split(' ')[0]}'s trip`;
  const companion = trip.companions[0];
  return (
    <Card>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt variant="label">{who}</Txt>
        {companion ? (
          <Chip label="Companion found" tone="teal" icon="checkmark" />
        ) : trip.pendingRequests ? (
          <Chip label={`${trip.pendingRequests} request${trip.pendingRequests > 1 ? 's' : ''}`} tone="gold" icon="mail" />
        ) : trip.seeking ? (
          <Chip label="Looking for company" tone="gold" />
        ) : (
          <Chip label="Not looking" tone="grey" />
        )}
      </Row>
      <Route trip={trip} />
      {companion ? (
        <>
          <Divider />
          <Pressable onPress={() => router.push(`/trip/${trip.id}`)}>
            <Row gap={12}>
              <Avatar initials={companion.initials} seed={companion.name} />
              <View style={{ flex: 1 }}>
                <Txt variant="title" style={{ fontSize: 17 }}>
                  {companion.name}
                  {companion.age ? `, ${companion.age}` : ''}
                </Txt>
                <Txt variant="small" style={{ fontSize: 14 }}>
                  {[companion.homeCity, companion.languages.slice(0, 2).join(', '), companion.seat ? `Seat ${companion.seat}` : null].filter(Boolean).join(' · ')}
                </Txt>
              </View>
            </Row>
          </Pressable>
        </>
      ) : null}
      <Row gap={10}>
        <Button label="Open trip" onPress={() => router.push(`/trip/${trip.id}`)} style={{ flex: 1 }} />
        {!companion && trip.seeking ? (
          <Button label="Find company" tone="gold" onPress={() => router.push(`/trip/${trip.id}/matches`)} style={{ flex: 1 }} />
        ) : null}
      </Row>
    </Card>
  );
}
