import * as Speech from 'expo-speech';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { LangSwitch, SizeSwitch } from '@/components/ParentControls';
import { Avatar, Button, ErrorBox, Icon, Loading, Row, Screen, Txt } from '@/components/ui';
import { call } from '@/lib/contact';
import { city, flightLabel, longDate } from '@/lib/format';
import { useParentPrefs } from '@/lib/parentText';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';
import type { ParentHomeData } from '@/lib/types';
import { useLoad } from '@/lib/useLoad';

export default function ParentHome() {
  const { api } = useSession();
  const { lang, setLang, scale, setScale, t } = useParentPrefs();
  const { data, error, reload } = useLoad(() => api<ParentHomeData>('GET', '/parent/home'), [api]);
  const [speaking, setSpeaking] = useState(false);
  const fs = (n: number) => Math.round(n * scale);

  if (!data) {
    return <Screen white>{error ? <ErrorBox message={t.error} onRetry={reload} /> : <Loading />}</Screen>;
  }

  const first = data.traveller.name.split(' ')[0];
  const comp = data.companions[0];
  const familyFirst = data.family.name?.split(' ')[0] ?? null;
  const trip = data.trip;

  function speak() {
    if (speaking) {
      Speech.stop();
      setSpeaking(false);
      return;
    }
    const parts = [t.hello(first), t.notAlone];
    if (trip) parts.push(t.yourFlight, longDate(trip.flightDate, lang), `${city(trip.origin, lang)}, ${city(trip.destination, lang)}`);
    if (comp) parts.push(t.yourSaathi, comp.name, t.sitsNear(comp.seat));
    setSpeaking(true);
    Speech.speak(parts.join('. '), {
      language: lang === 'hi' ? 'hi-IN' : 'en-IN',
      rate: 0.9,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }

  return (
    <Screen white>
      <Row style={{ justifyContent: 'space-between', flexWrap: 'wrap' }} gap={8}>
        <LangSwitch lang={lang} onChange={setLang} />
        <SizeSwitch scale={scale} onChange={setScale} />
      </Row>
      <Pressable
        onPress={speak}
        accessibilityRole="button"
        style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 8, minHeight: 52, paddingHorizontal: 16, borderRadius: 999, borderWidth: 2, borderColor: colors.navy }}
      >
        <Icon name={speaking ? 'stop' : 'volume-high'} />
        <Txt style={{ fontSize: 17, fontFamily: fonts.bold, color: colors.navy }}>{speaking ? t.stop : t.listen}</Txt>
      </Pressable>

      <View style={{ gap: 6 }}>
        <Txt style={{ fontSize: fs(34), lineHeight: fs(42), fontFamily: fonts.bold, color: colors.navy }}>{t.hello(first)}</Txt>
        <Txt style={{ fontSize: fs(21), lineHeight: fs(29), color: colors.text2 }}>{trip ? t.notAlone : t.noTrip}</Txt>
      </View>

      {trip ? (
        <View style={{ backgroundColor: colors.ground, borderRadius: 24, padding: 20, gap: 6 }}>
          <Txt style={{ fontSize: fs(17), fontFamily: fonts.bold, color: colors.muted }}>{t.yourFlight}</Txt>
          <Txt style={{ fontSize: fs(26), lineHeight: fs(34), fontFamily: fonts.bold }}>{longDate(trip.flightDate, lang)}</Txt>
          <Txt style={{ fontSize: fs(26), lineHeight: fs(34), fontFamily: fonts.bold, color: colors.navy }}>
            {`${city(trip.origin, lang)} → ${city(trip.destination, lang)}`}
          </Txt>
          {trip.departTime ? <Txt style={{ fontSize: fs(21), color: colors.text2 }}>{`${flightLabel(trip.flightNumber)} · ${trip.departTime}`}</Txt> : null}
        </View>
      ) : null}

      {comp ? (
        <Row gap={16} style={{ backgroundColor: colors.marigoldSoft, borderRadius: 24, padding: 20 }}>
          <Avatar initials={comp.initials} ring size={80} />
          <View style={{ flex: 1, gap: 4 }}>
            <Txt style={{ fontSize: fs(17), fontFamily: fonts.bold, color: colors.brown }}>{t.yourSaathi}</Txt>
            <Txt style={{ fontSize: fs(26), lineHeight: fs(32), fontFamily: fonts.bold }}>{comp.name}</Txt>
            <Txt style={{ fontSize: fs(17), lineHeight: fs(24), color: colors.brownDeep }}>
              {[comp.homeCity, t.sitsNear(comp.seat)].filter(Boolean).join('. ')}
            </Txt>
          </View>
        </Row>
      ) : null}

      <View style={{ gap: 12 }}>
        {comp?.contact?.travellerPhone ? (
          <Button big tone="gold" icon="call" label={t.call(comp.name.split(' ')[0])} fontSize={fs(21)} onPress={() => call(comp.contact!.travellerPhone!)} />
        ) : null}
        {data.family.phone ? (
          <Button big icon="call" label={t.call(familyFirst ?? 'family')} fontSize={fs(21)} onPress={() => call(data.family.phone!)} />
        ) : null}
        {trip ? <Button big tone="outline" icon="arrow-forward" label={t.start} fontSize={fs(21)} onPress={() => router.push('/parent/journey')} /> : null}
      </View>
    </Screen>
  );
}
