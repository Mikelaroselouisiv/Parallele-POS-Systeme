import * as SecureStore from 'expo-secure-store';

export const TOKEN_KEY = 'pos_token';
export const REFRESH_TOKEN_KEY = 'pos_refresh_token';
export const USER_KEY = 'pos_user';

export async function secureGet(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    /* ignore */
  }
}

export async function secureDelete(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* ignore */
  }
}
