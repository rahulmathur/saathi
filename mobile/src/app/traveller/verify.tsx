import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, ErrorBox, Header, Icon, Loading, Row, Screen, Txt } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors } from '@/lib/theme';
import type { Traveller, VerificationStatus } from '@/lib/types';
import { useLoad } from '@/lib/useLoad';

/** Verifying a traveller's identity: required before families are introduced. */
export default function VerifyTraveller() {
  const { api } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, reload } = useLoad(async () => {
    const [{ travellers }, status] = await Promise.all([
      api<{ travellers: Traveller[] }>('GET', '/travellers'),
      api<VerificationStatus>('GET', `/travellers/${id}/verification`),
    ]);
    return { traveller: travellers.find((t) => t.id === id) ?? null, status };
  }, [api, id]);
  const [busy, setBusy] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  const pending = data?.status.latest?.status === 'pending' && !data.status.verified;

  // While a check is in progress (often in another tab or the in-app browser), keep looking for the result.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [pending, reload]);

  async function start() {
    setBusy(true);
    setStartError(null);
    try {
      const r = await api<{ url: string }>('POST', `/travellers/${id}/verification`);
      await reload();
      await WebBrowser.openBrowserAsync(r.url);
      await reload();
    } catch (e) {
      setStartError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <Screen>
        <Header title="Verify identity" onBack={() => router.back()} />
        {error ? <ErrorBox message={error} onRetry={reload} /> : <Loading />}
      </Screen>
    );
  }

  const t = data.traveller;
  const first = t?.name.split(' ')[0] ?? 'them';
  const isMe = t?.relation === 'Me';
  const { status } = data;

  return (
    <Screen>
      <Header title="Verify identity" onBack={() => router.back()} />

      {status.verified ? (
        <Card style={{ alignItems: 'center', gap: 12 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.tealSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="shield-checkmark" size={40} color={colors.teal} />
          </View>
          <Txt variant="h2" style={{ textAlign: 'center' }}>
            {first} is verified
          </Txt>
          <Txt style={{ textAlign: 'center' }}>Other families will see the "ID verified" badge, and introductions can now be accepted.</Txt>
          <Button label="Done" onPress={() => router.back()} style={{ alignSelf: 'stretch' }} />
        </Card>
      ) : (
        <>
          <Txt>
            Before families are introduced, both travellers confirm who they are with an official ID. It takes about two minutes.
          </Txt>
          <Card style={{ gap: 12 }}>
            {[
              ['card', isMe ? 'Have your passport or driving licence ready' : `Do this together with ${first}: you'll need their passport, driving licence or Aadhaar`],
              ['camera', 'A quick selfie confirms the ID belongs to the person'],
              ['lock-closed', 'Saathi keeps only the result, never a copy of the ID'],
            ].map(([icon, text]) => (
              <Row key={text} gap={12} style={{ alignItems: 'flex-start' }}>
                <Icon name={icon as 'card'} color={colors.teal} />
                <Txt style={{ flex: 1 }}>{text}</Txt>
              </Row>
            ))}
          </Card>

          {status.testMode ? (
            <Banner icon="flask">
              <Txt style={{ color: colors.brownDeep }}>Test version: no real ID check happens yet. The next page just lets you pass or fail the check.</Txt>
            </Banner>
          ) : null}

          {status.latest?.status === 'failed' ? (
            <ErrorBox message={`The last check didn't go through${status.latest.reason ? `: ${status.latest.reason}` : ''}. You can try again.`} />
          ) : null}
          {startError ? <ErrorBox message={startError} /> : null}

          {pending ? (
            <Card style={{ gap: 12 }}>
              <Loading />
              <Txt style={{ textAlign: 'center' }}>Waiting for the result. Finish the check in the page that opened, then come back here.</Txt>
              <Button label="Open the check again" tone="outline" onPress={start} loading={busy} />
            </Card>
          ) : (
            <Button label={`Verify ${first}`} icon="shield-checkmark" onPress={start} loading={busy} big />
          )}
        </>
      )}
    </Screen>
  );
}
