import { createApiClient } from '@waypoint/api-contracts';
export const api = createApiClient(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1');
