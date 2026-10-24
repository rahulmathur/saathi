import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, ErrorBox, Field, Header, Screen, Txt } from '@/components/ui';
import { request } from '@/lib/api';
import { onboarding, useSession } from '@/lib/session';
import type { User } from '@/lib/types';

export default function SignIn() {
  const { signIn } = useSession();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const r = await request<{ sent: boolean; devCode?: string }>('POST', '/auth/start', { email: email.trim() });
      setDevCode(r.devCode ?? null);
      setStep('code');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const r = await request<{ token: string; isNew: boolean; user: User }>('POST', '/auth/verify', { email: email.trim(), code: code.trim() });
      onboarding.pending = r.isNew;
      await signIn(r.token, 'family');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Header title="Sign in" onBack={() => (step === 'code' ? setStep('email') : router.back())} />
      {step === 'email' ? (
        <View style={{ gap: 18 }}>
          <Txt>We'll email you a 6-digit code. No password to remember.</Txt>
          <Field
            label="Your email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            returnKeyType="send"
            onSubmitEditing={sendCode}
          />
          {error ? <ErrorBox message={error} /> : null}
          <Button label="Send my code" onPress={sendCode} loading={busy} disabled={!email.includes('@')} />
        </View>
      ) : (
        <View style={{ gap: 18 }}>
          <Txt>Enter the code we sent to {email.trim()}.</Txt>
          {devCode ? (
            <Banner icon="construct">
              <Txt style={{ color: '#4A2E00' }}>Test mode: email isn't connected yet, so your code is {devCode}.</Txt>
            </Banner>
          ) : null}
          <Field
            label="6-digit code"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            style={{ fontSize: 28, letterSpacing: 8, textAlign: 'center' }}
            onSubmitEditing={verify}
          />
          {error ? <ErrorBox message={error} /> : null}
          <Button label="Sign in" onPress={verify} loading={busy} disabled={code.length !== 6} />
          <Button label="Send a new code" tone="ghost" onPress={sendCode} />
        </View>
      )}
    </Screen>
  );
}
