import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LangSwitch } from '@/components/ParentControls';
import { Button, ErrorBox, Icon, Loading, Row, Screen, Txt } from '@/components/ui';
import { STEPS, useParentPrefs } from '@/lib/parentText';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';
import { useLoad } from '@/lib/useLoad';
import type { ParentHomeData } from '@/lib/types';

export default function Journey() {
  const { api } = useSession();
  const { lang, setLang, scale, t } = useParentPrefs();
  const { data, error, reload } = useLoad(() => api<ParentHomeData>('GET', '/parent/home'), [api]);
  const [step, setStep] = useState(0);
  const [help, setHelp] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');
  const fs = (n: number) => Math.round(n * scale);

  useEffect(() => {
    if (data?.trip) setStep(Math.min(data.trip.journeyStep, STEPS.en.length));
  }, [data?.trip]);

  if (!data?.trip) {
    return <Screen white>{error ? <ErrorBox message={t.error} onRetry={reload} /> : <Loading />}</Screen>;
  }
  const trip = data.trip;
  const steps = STEPS[lang];
  const done = step >= steps.length;
  const cur = steps[Math.min(step, steps.length - 1)];

  async function go(to: number) {
    const prev = step;
    setStep(to);
    try {
      await api('POST', `/parent/trips/${trip.id}/step`, { step: to });
    } catch {
      setStep(prev);
    }
  }

  async function askHelp() {
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    setHelp('sending');
    try {
      await api('POST', `/parent/trips/${trip.id}/help`, {});
      setHelp('sent');
    } catch {
      setHelp('failed');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }} edges={['top', 'left', 'right', 'bottom']}>
      <Screen white padTop={false}>
        <Row style={{ justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t.back}
            style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: colors.greySoft, alignItems: 'center', justifyContent: 'center' }}
          >
            <Icon name="chevron-back" size={28} />
          </Pressable>
          <LangSwitch lang={lang} onChange={setLang} />
        </Row>

        <View style={{ gap: 8 }}>
          <Txt style={{ fontSize: fs(17), fontFamily: fonts.bold, color: colors.muted }}>{t.of(Math.min(step + 1, steps.length), steps.length)}</Txt>
          <Row gap={6}>
            {steps.map((_, i) => (
              <View key={i} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < step ? colors.teal : i === step ? colors.marigold : colors.line }} />
            ))}
          </Row>
        </View>

        {help === 'sent' || help === 'failed' ? (
          <View accessibilityRole="alert" style={{ backgroundColor: help === 'sent' ? colors.tealSoft : colors.redSoft, borderColor: help === 'sent' ? colors.teal : colors.red, borderWidth: 2, borderRadius: 20, padding: 16, gap: 8 }}>
            <Txt style={{ fontSize: fs(23), fontFamily: fonts.bold, color: help === 'sent' ? colors.teal : colors.red }}>{help === 'sent' ? t.helpTitle : t.error}</Txt>
            {help === 'sent' ? <Txt style={{ fontSize: fs(20), lineHeight: fs(28), color: colors.tealDeep }}>{t.helpBody}</Txt> : null}
            {help === 'sent' && data.companions[0] ? (
              <Txt style={{ fontSize: fs(20), color: colors.tealDeep }}>{`${t.yourSaathi}: ${data.companions[0].name}`}</Txt>
            ) : null}
            <Button label={t.ok} tone="outline" onPress={() => setHelp('idle')} style={{ alignSelf: 'flex-start' }} />
          </View>
        ) : null}

        <View style={{ backgroundColor: colors.marigoldSoft, borderWidth: 3, borderColor: colors.marigold, borderRadius: 24, padding: 20, gap: 10 }}>
          {done ? (
            <>
              <Txt style={{ fontSize: fs(30), lineHeight: fs(38), fontFamily: fonts.bold, color: colors.navy }}>{t.finished}</Txt>
              <Button label={t.restart} tone="outline" onPress={() => go(0)} />
            </>
          ) : (
            <>
              <Txt style={{ fontSize: fs(17), fontFamily: fonts.bold, color: colors.brown }}>{t.now}</Txt>
              <Txt style={{ fontSize: fs(30), lineHeight: fs(38), fontFamily: fonts.bold, color: colors.navy }}>{cur[0]}</Txt>
              <Txt style={{ fontSize: fs(20), lineHeight: fs(29), color: '#2B2F38' }}>{cur[1]}</Txt>
              <Button big icon="checkmark" label={t.done} fontSize={fs(21)} onPress={() => go(step + 1)} style={{ marginTop: 6 }} />
            </>
          )}
        </View>

        {!done ? (
          <View style={{ gap: 8 }}>
            <Txt style={{ fontSize: fs(17), fontFamily: fonts.bold, color: colors.muted }}>{t.later}</Txt>
            {steps.slice(step + 1).map(([title], i) => (
              <Row key={title} gap={12} style={{ padding: 14, borderRadius: 16, backgroundColor: colors.ground }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
                  <Txt style={{ fontSize: 16, fontFamily: fonts.bold, color: colors.text2 }}>{String(step + i + 2)}</Txt>
                </View>
                <Txt style={{ fontSize: fs(18), color: '#2B2F38', flex: 1 }}>{title}</Txt>
              </Row>
            ))}
          </View>
        ) : null}
      </Screen>
      <View style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8, borderTopWidth: 1, borderTopColor: colors.line }}>
        <Button big tone="danger" icon="alert-circle" label={t.needHelp} fontSize={fs(23)} onPress={askHelp} loading={help === 'sending'} style={{ minHeight: 76 }} />
      </View>
    </SafeAreaView>
  );
}
