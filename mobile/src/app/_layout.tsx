import { AtkinsonHyperlegible_400Regular, AtkinsonHyperlegible_700Bold } from '@expo-google-fonts/atkinson-hyperlegible';
import { NotoSansDevanagari_400Regular, NotoSansDevanagari_700Bold } from '@expo-google-fonts/noto-sans-devanagari';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function Navigator() {
  const { mode } = useSession();
  const [fontsLoaded] = useFonts({
    AtkinsonHyperlegible_400Regular,
    AtkinsonHyperlegible_700Bold,
    NotoSansDevanagari_400Regular,
    NotoSansDevanagari_700Bold,
  });
  const ready = fontsLoaded && mode !== 'loading';

  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;
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
