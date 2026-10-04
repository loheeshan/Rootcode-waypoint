// Starts Expo/Metro for one mobile app inside Docker (demo stack) and prints how to open it.
// Usage: node scripts/expo-docker.mjs <loader|driver> <port>
import { spawn } from 'node:child_process';

const [app, port] = process.argv.slice(2);
const host = process.env.REACT_NATIVE_PACKAGER_HOSTNAME || '10.0.2.2';
const sdk = app === 'loader' ? '57' : '56';
const url = `exp://${host}:${port}`;
const line = '='.repeat(72);
console.log([
  line,
  `Waypoint ${app === 'loader' ? 'Loader' : 'Driver'} app (Expo Go SDK ${sdk}) — Metro on port ${port}`,
  `Open in Expo Go: ${url}`,
  `Android emulator: adb shell am start -a android.intent.action.VIEW -d exp://10.0.2.2:${port}`,
  `API used by the app: ${process.env.EXPO_PUBLIC_API_URL}`,
  `Physical phone: set DEMO_HOST_IP=<this computer's LAN IP> and restart (see DEMO-CREDENTIALS.md).`,
  line,
].join('\n'));

const child = spawn('pnpm', ['--filter', `@waypoint/${app}-mobile`, 'exec', 'expo', 'start', '--port', port, '--lan'], {
  stdio: 'inherit',
  env: { ...process.env, CI: '1' },
});
child.on('exit', (code) => process.exit(code ?? 1));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
