import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, ErrorBox, Header, Loading, Screen, Txt } from '@/components/ui';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';

/** Shows a one-time code to type into the parent's phone. */
export default function PairParent() {
  const { api } = useSession();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchCode = useCallback(async () => {
    setError(null);
    setCode(null);
    setCopied(false);
    try {
      const r = await api<{ code: string }>('POST', `/travellers/${id}/pair-code`);
      setCode(r.code);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [api, id]);

  useEffect(() => {
    fetchCode();
  }, [fetchCode]);

  return (
    <Screen>
      <Header title="Set up their phone" onBack={() => router.back()} />
      <Card style={{ gap: 12 }}>
        <Txt variant="title">1. Install Saathi on their phone</Txt>
        <Txt>Open the app and tap "I'm the traveller".</Txt>
        <Txt variant="title">2. Type this code</Txt>
        {code ? (
          <View style={{ backgroundColor: colors.marigoldSoft, borderRadius: 20, paddingVertical: 20, alignItems: 'center' }}>
            <Txt style={{ fontSize: 48, lineHeight: 56, letterSpacing: 10, fontFamily: fonts.bold, color: colors.navy }}>{code}</Txt>
          </View>
        ) : error ? (
          <ErrorBox message={error} onRetry={fetchCode} />
        ) : (
          <Loading />
        )}
        <Txt variant="small">The code works once and expires in 24 hours. Their phone stays signed in, so they won't need to do this again.</Txt>
        {code ? (
          <Button
            label={copied ? 'Copied' : 'Copy code to send on WhatsApp'}
            icon={copied ? 'checkmark' : 'copy'}
            tone="outline"
            onPress={async () => {
              await Clipboard.setStringAsync(`Your Saathi code is ${code}. Open Saathi, tap "I'm the traveller" and type it in.`);
              setCopied(true);
            }}
          />
        ) : null}
      </Card>
      <Banner icon="information-circle" tone="teal">
        <Txt style={{ color: colors.tealDeep }}>Their app shows only their own trip, their companion and big buttons to call you. They can switch between English and Hindi.</Txt>
      </Banner>
      <Button label="Make a new code" tone="ghost" onPress={fetchCode} />
    </Screen>
  );
}
