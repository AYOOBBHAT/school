import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

/** Stay under Expo SecureStore per-item limits (Android ~2048 bytes). */
const CHUNK_SIZE = 2000;

async function clearChunks(baseKey: string): Promise<void> {
  await SecureStore.deleteItemAsync(baseKey).catch(() => {});
  const nStr = await SecureStore.getItemAsync(`${baseKey}__n`);
  await SecureStore.deleteItemAsync(`${baseKey}__n`).catch(() => {});
  const n = nStr ? parseInt(nStr, 10) : 0;
  if (Number.isFinite(n) && n > 0 && n < 200) {
    for (let i = 0; i < n; i++) {
      await SecureStore.deleteItemAsync(`${baseKey}__${i}`).catch(() => {});
    }
  }
}

async function readSecureOrMigrate(baseKey: string): Promise<string | null> {
  const single = await SecureStore.getItemAsync(baseKey);
  if (single != null) return single;

  const nStr = await SecureStore.getItemAsync(`${baseKey}__n`);
  if (nStr != null) {
    const n = parseInt(nStr, 10);
    if (!Number.isFinite(n) || n <= 0 || n >= 200) return null;
    let out = '';
    for (let i = 0; i < n; i++) {
      const part = await SecureStore.getItemAsync(`${baseKey}__${i}`);
      if (part == null) return null;
      out += part;
    }
    return out;
  }

  const legacy = await AsyncStorage.getItem(baseKey);
  if (legacy != null) {
    await writeSecure(baseKey, legacy);
    await AsyncStorage.removeItem(baseKey);
  }
  return legacy;
}

async function writeSecure(baseKey: string, value: string): Promise<void> {
  await clearChunks(baseKey);
  if (value.length <= CHUNK_SIZE) {
    await SecureStore.setItemAsync(baseKey, value);
    return;
  }
  const n = Math.ceil(value.length / CHUNK_SIZE);
  await SecureStore.setItemAsync(`${baseKey}__n`, String(n));
  for (let i = 0; i < n; i++) {
    await SecureStore.setItemAsync(`${baseKey}__${i}`, value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE));
  }
}

/** Supabase auth session storage — SecureStore + one-time migrate from AsyncStorage. */
export const supabaseSecureStorage = {
  getItem: (key: string) => readSecureOrMigrate(key),
  setItem: (key: string, value: string) => writeSecure(key, value),
  removeItem: (key: string) => clearChunks(key),
};

export async function secureReadItem(key: string): Promise<string | null> {
  return readSecureOrMigrate(key);
}

export async function secureWriteItem(key: string, value: string): Promise<void> {
  await writeSecure(key, value);
}

export async function secureRemoveItem(key: string): Promise<void> {
  await clearChunks(key);
  await AsyncStorage.removeItem(key).catch(() => {});
}
