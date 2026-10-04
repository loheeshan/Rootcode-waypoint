/** Demo sign-in details (server only). Enabled only in the compose demo: APP_ENV=demo. */
const ACCOUNTS = { STORE_MANAGER: 'store@waypoint.demo', DISPATCHER: 'dispatcher@waypoint.demo' } as const;

export type DemoConfig =
  | { demo: true; password: string; accounts: typeof ACCOUNTS }
  | { demo: false };

export function demoConfig(env: Record<string, string | undefined> = process.env): DemoConfig {
  const password = env.DEMO_SEED_PASSWORD;
  return env.APP_ENV === 'demo' && env.DEMO_MODE !== 'false' && password
    ? { demo: true, password, accounts: ACCOUNTS }
    : { demo: false };
}
