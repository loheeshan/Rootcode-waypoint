import * as SecureStore from 'expo-secure-store';
const TOKEN_KEY = 'waypoint.loader.access-token';
export const session = {
  getToken: () => SecureStore.getItemAsync(TOKEN_KEY),
  setToken: (token: string) => SecureStore.setItemAsync(TOKEN_KEY, token),
  clear: () => SecureStore.deleteItemAsync(TOKEN_KEY),
};
