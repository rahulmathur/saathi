import { router } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { Button, ErrorBox, Header, Screen, Txt } from '@/components/ui';
import { request } from '@/lib/api';
import { useSession } from '@/lib/session';
import { colors, fonts } from '@/lib/theme';

/** The traveller's own phone: type the code shown in the family app. */
export default function Pair() {
  const { signIn } = useSession();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const r = await request<{ token: string }>('POST', '/auth/parent', { code });
      await signIn(r.token, 'parent');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen white>
      <Header title="Open with a code" onBack={() => router.back()} />
      <Txt style={{ fontSize: 21, lineHeight: 30 }}>Your son or daughter has a 6-digit code for you in their Saathi app. Type it here.</Txt>
      <Txt style={{ fontSize: 21, lineHeight: 32, color: colors.text2 }}>अपने बेटे या बेटी से 6 अंकों का कोड लें और यहाँ लिखें।</Txt>
      <View>
        <TextInput
          value={code}
          onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          accessibilityLabel="6-digit code"
          placeholder="000000"
          placeholderTextColor="#B5BAC6"
          maxLength={6}
          style={{
            height: 84,
            borderRadius: 20,
            borderWidth: 2,
            borderColor: colors.navy,
            fontSize: 44,
            letterSpacing: 12,
            textAlign: 'center',
            fontFamily: fonts.bold,
            color: colors.navy,
          }}
        />
      </View>
      {error ? <ErrorBox message={error} /> : null}
      <Button label="Open Saathi" big onPress={submit} loading={busy} disabled={code.length !== 6} />
    </Screen>
  );
}
