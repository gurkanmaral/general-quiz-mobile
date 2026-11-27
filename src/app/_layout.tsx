import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { Inter_900Black } from '@expo-google-fonts/inter/900Black';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { useFonts } from 'expo-font';
import { router, Stack, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccountProvider, useAccount } from '@/lib/account';
import { NotificationsProvider } from '@/lib/notifications';
import { ProgressProvider } from '@/lib/progress';
import { hydrateStorage } from '@/lib/storage';
import { colors } from '@/ui/theme';

void SplashScreen.preventAutoHideAsync();

/** A signed-in player without a Username/avatar finishes the profile step first (Story 1.3). */
function ProfileGate() {
  const { status, me } = useAccount();
  const segments = useSegments();
  const onSignIn = segments[0] === 'sign-in';
  useEffect(() => {
    if (status === 'signedIn' && me && !me.profileComplete && !onSignIn) {
      router.push({ pathname: '/sign-in', params: { step: 'profile' } });
    }
  }, [status, me, onSignIn]);
  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    Inter_500Medium,
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
  });
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    void hydrateStorage().then(() => setStorageReady(true));
  }, []);

  const ready = (fontsLoaded || Boolean(fontError)) && storageReady;
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <AccountProvider>
        <ProgressProvider>
          <NotificationsProvider>
            <StatusBar style="dark" />
            <ProfileGate />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="sign-in" options={{ presentation: 'modal' }} />
            </Stack>
          </NotificationsProvider>
        </ProgressProvider>
      </AccountProvider>
    </SafeAreaProvider>
  );
}
