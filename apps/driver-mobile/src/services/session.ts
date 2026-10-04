import { Directory, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import type { AuthUser } from '@waypoint/api-contracts';

const TOKEN_KEY = 'waypoint.driver.access-token';
// The last server-confirmed profile, used only for offline relaunch of a remembered session.
const PROFILE_KEY = 'waypoint.driver.profile';
// Unremembered sessions live only in memory and end when the app process ends.
let memoryToken: string | null = null;

export const session = {
  async getToken(): Promise<string | null> {
    return memoryToken ?? SecureStore.getItemAsync(TOKEN_KEY);
  },
  async setToken(token: string, remember = true): Promise<void> {
    memoryToken = token;
    if (remember) await SecureStore.setItemAsync(TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(TOKEN_KEY);
  },
  async getCachedUser(): Promise<AuthUser | null> {
    const stored = await SecureStore.getItemAsync(PROFILE_KEY);
    try {
      return stored ? JSON.parse(stored) as AuthUser : null;
    } catch {
      return null;
    }
  },
  async cacheUser(user: AuthUser, remember = true): Promise<void> {
    if (remember) await SecureStore.setItemAsync(PROFILE_KEY, JSON.stringify(user));
    else await SecureStore.deleteItemAsync(PROFILE_KEY);
  },
  async clear(): Promise<void> {
    memoryToken = null;
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    await SecureStore.deleteItemAsync(PROFILE_KEY);
    // Proof photos downloaded for viewing belong to this account; unsent POD drafts are kept per user.
    try {
      const viewed = new Directory(Paths.cache, 'pod-view');
      if (viewed.exists) viewed.delete();
    } catch {
      // Nothing cached.
    }
  },
};
