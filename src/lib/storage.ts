import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Key-value storage with synchronous reads, like the web's localStorage: every `kno:` key is loaded
 * into memory once at startup (`hydrateStorage`), and writes go to memory at once and to
 * AsyncStorage in the background. That keeps the Daily history and cache code the same as the web.
 */
const PREFIX = 'kno:';
const memory = new Map<string, string>();

export async function hydrateStorage(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
    for (const [key, value] of await AsyncStorage.multiGet(keys)) {
      if (value !== null) memory.set(key, value);
    }
  } catch {
    // Storage unavailable: the app works for this session without persistence.
  }
}

export const storage = {
  getItem(key: string): string | null {
    return memory.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    memory.set(key, value);
    AsyncStorage.setItem(key, value).catch(() => {});
  },
  removeItem(key: string): void {
    memory.delete(key);
    AsyncStorage.removeItem(key).catch(() => {});
  },
};
