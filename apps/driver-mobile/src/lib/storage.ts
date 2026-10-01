import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') return localStorage.setItem(key, value);
  return SecureStore.setItemAsync(key, value);
}

export async function getItem(key: string) {
  if (Platform.OS === 'web') return localStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}

export async function deleteItem(key: string) {
  if (Platform.OS === 'web') return localStorage.removeItem(key);
  return SecureStore.deleteItemAsync(key);
}