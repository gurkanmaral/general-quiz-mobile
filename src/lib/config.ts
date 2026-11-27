import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * In development the API runs on the same machine as the Expo dev server, so its address is the
 * dev server's host (works for simulators and for phones on the same Wi-Fi). Production builds
 * set EXPO_PUBLIC_API_URL / EXPO_PUBLIC_WEB_URL.
 */
function devHost(): string {
  const hostUri = Constants.expoConfig?.hostUri;
  const host = hostUri?.split(':')[0];
  if (host) return host;
  // The Android emulator reaches the host machine at 10.0.2.2.
  return Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
}

const trim = (url: string) => url.replace(/\/+$/, '');

/** The API origin, e.g. http://192.168.1.20:8787 (paths add /api/...). */
export const API_URL = trim(process.env.EXPO_PUBLIC_API_URL ?? `http://${devHost()}:8787`);

/** The web app origin, used for links people share (Lobby, friend and Nudge Links). */
export const WEB_URL = trim(process.env.EXPO_PUBLIC_WEB_URL ?? `http://${devHost()}:5180`);
