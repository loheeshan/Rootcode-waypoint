import { createApiClient } from '@waypoint/api-contracts';
import { session } from './session';
export function getApiClient() {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (!url) throw new Error('Set EXPO_PUBLIC_API_URL in this app’s .env file');
  return createApiClient(url, session.getToken);
}
