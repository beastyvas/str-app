import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import aesjs from 'aes-js';
import { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// expo-secure-store (Keychain/Keystore) caps values at 2048 bytes, too small
// for a full Supabase session (access + refresh token + user object). Instead
// we encrypt the session with a random AES key, keep the (small) key in
// SecureStore, and store the (unbounded-size) ciphertext in AsyncStorage —
// so the session is never written to disk in plaintext, while avoiding
// SecureStore's size limit.
class LargeSecureStore {
  private async getEncryptionKey(keyName: string): Promise<Uint8Array> {
    const stored = await SecureStore.getItemAsync(keyName);
    if (stored) return aesjs.utils.hex.toBytes(stored);

    const key = await Crypto.getRandomBytesAsync(32);
    await SecureStore.setItemAsync(keyName, aesjs.utils.hex.fromBytes(key));
    return key;
  }

  async getItem(key: string): Promise<string | null> {
    const encrypted = await AsyncStorage.getItem(key);
    if (!encrypted) return null;

    const encryptionKey = await this.getEncryptionKey(`${key}_key`);
    const [ivHex, cipherHex] = encrypted.split(':');
    if (!ivHex || !cipherHex) return null;

    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(aesjs.utils.hex.toBytes(ivHex)));
    const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(cipherHex));
    return aesjs.utils.utf8.fromBytes(decryptedBytes);
  }

  async setItem(key: string, value: string): Promise<void> {
    const encryptionKey = await this.getEncryptionKey(`${key}_key`);
    const iv = await Crypto.getRandomBytesAsync(16);
    const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(iv));
    const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
    await AsyncStorage.setItem(key, `${aesjs.utils.hex.fromBytes(iv)}:${aesjs.utils.hex.fromBytes(encryptedBytes)}`);
  }

  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(`${key}_key`);
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: new LargeSecureStore(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit', // PKCE loses state in RN WebBrowser — use implicit
  },
});
