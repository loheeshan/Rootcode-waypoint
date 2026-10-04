import { describe, expect, it } from 'vitest';
import { demoConfig } from '../lib/demo';

describe('demo sign-in details', () => {
  it('are returned only in the compose demo (APP_ENV=demo) with a password', () => {
    expect(demoConfig({ APP_ENV: 'demo', DEMO_MODE: 'true', DEMO_SEED_PASSWORD: 'pw' })).toEqual({
      demo: true, password: 'pw',
      accounts: { STORE_MANAGER: 'store@waypoint.demo', DISPATCHER: 'dispatcher@waypoint.demo' },
    });
    expect(demoConfig({ APP_ENV: 'development', DEMO_MODE: 'true', DEMO_SEED_PASSWORD: 'pw' })).toEqual({ demo: false });
    expect(demoConfig({ APP_ENV: 'demo', DEMO_MODE: 'false', DEMO_SEED_PASSWORD: 'pw' })).toEqual({ demo: false });
    expect(demoConfig({ APP_ENV: 'demo', DEMO_MODE: 'true' })).toEqual({ demo: false });
    expect(demoConfig({})).toEqual({ demo: false });
  });
});
