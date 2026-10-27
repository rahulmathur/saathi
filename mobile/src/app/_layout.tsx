import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { NotoSansDevanagari_400Regular, NotoSansDevanagari_700Bold } from '@expo-google-fonts/noto-sans-devanagari';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LogoMark } from '@/components/Logo';
import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { mode } = useSession();
  const [fontsLoaded, fontError] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_700Bold,
  });
  // Fonts are a nicety: if they fail or are slow (a phone browser on a weak
  // connection), carry on with system fonts rather than staying blank.
  const [fontWaitOver, setFontWaitOver] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontWaitOver(true), 3000);
    return () => clearTimeout(t);
  }, []);
  const ready = (fontsLoaded || !!fontError || fontWaitOver) && mode !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, backgroundColor: colors.ground }}>
        <LogoMark size={72} />
        <ActivityIndicator color={colors.navy} />
      </View>
    );
  }
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Protected guard={mode === 'signedOut'}>
        <Stack.Screen name="welcome" />
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="pair" />
      </Stack.Protected>
      <Stack.Protected guard={mode === 'family'}>
        <Stack.Screen name="(family)" />
        <Stack.Screen name="trip/[id]/index" />
        <Stack.Screen name="trip/[id]/matches" />
        <Stack.Screen name="trip/[id]/companion" />
        <Stack.Screen name="traveller/edit" />
        <Stack.Screen name="traveller/pair" />
      </Stack.Protected>
      <Stack.Protected guard={mode === 'parent'}>
        <Stack.Screen name="parent/index" />
        <Stack.Screen name="parent/journey" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SessionProvider>
        <StatusBar style="dark" />
        <Navigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}
