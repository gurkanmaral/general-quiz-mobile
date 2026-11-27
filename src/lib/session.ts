import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { storage } from './storage';

/**
 * The Better Auth session token. Native apps have no cookies: the API's bearer plugin hands the
 * token over in the `set-auth-token` header, and every request sends it back as
 * `Authorization: Bearer …`. It lives in the Keychain / Keystore (web preview: local storage).
 */
const KEY = 'kno.session-token';
const WEB_KEY = 'kno:session-token';
let token: string | null = null;

export async function loadToken(): Promise<string | null> {
  try {
    token = Platform.OS === 'web' ? storage.getItem(WEB_KEY) : await SecureStore.getItemAsync(KEY);
  } catch {
    token = null;
  }
  return token;
}

export function getToken(): string | null {
  return token;
}

export async function setToken(next: string | null): Promise<void> {
  token = next;
  try {
    if (Platform.OS === 'web') {
      if (next) storage.setItem(WEB_KEY, next);
      else storage.removeItem(WEB_KEY);
    } else if (next) {
      await SecureStore.setItemAsync(KEY, next);
    } else {
      await SecureStore.deleteItemAsync(KEY);
    }
  } catch {
    // Keeps working for this session; the player signs in again next launch.
  }
}
