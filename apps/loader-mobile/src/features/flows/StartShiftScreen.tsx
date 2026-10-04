import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, TextInput, View, StyleSheet } from 'react-native';
import { SignInError, signInMessages } from '@waypoint/api-contracts';

import { AppHeader } from '../../components/AppHeader';
import { ActionButton, InfoCard, Notice, Screen } from '../../components/ui/ScreenKit';
import { t } from '../../theme/loaderTokens';
import { HOME, noticeMessages, useAuth } from '../../services/auth';

// Development builds offer the demo email; the password is still checked by the API.
const DEMO_EMAIL = __DEV__ ? 'loader@waypoint.demo' : null;

export default function StartShiftScreen() {
  const router = useRouter();
  const { signIn, notice } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const message = error ?? (notice ? noticeMessages[notice] : null);

  const submit = async () => {
    if (busy) return;
    if (!email.trim() || !password) {
      setError('Enter your work email and password.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password, remember);
      setPassword('');
      router.replace(HOME);
    } catch (failure) {
      setError(failure instanceof SignInError ? signInMessages[failure.reason] : signInMessages.unavailable);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <AppHeader role="LOADER" location="Sign in" />
      <Screen title="Start your loading shift">
        <InfoCard
          title="Sign in with your Waypoint account"
          lines={['Your depot and trips come from your account after sign-in.']}
        />
        {message ? <Notice tone="red" title="Sign-in problem">{message}</Notice> : null}
        <Text style={styles.label}>Work email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="you@company.com"
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          autoCorrect={false}
          accessibilityLabel="Work email"
        />
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          autoCapitalize="none"
          autoComplete="password"
          textContentType="password"
          autoCorrect={false}
          accessibilityLabel="Password"
          onSubmitEditing={submit}
        />
        <Pressable
          onPress={() => setRemember((value) => !value)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: remember }}
          style={styles.remember}
        >
          <Text style={styles.rememberText}>{remember ? '☑' : '☐'} Remember on this device</Text>
        </Pressable>
        <ActionButton label={busy ? 'Signing in…' : 'Sign in'} onPress={submit} />
        {DEMO_EMAIL ? (
          <Pressable onPress={() => setEmail(DEMO_EMAIL)} accessibilityRole="button">
            <Text style={styles.demo}>
              Demo: use {DEMO_EMAIL} with the password set when demo accounts were seeded
            </Text>
          </Pressable>
        ) : null}
        <ActionButton variant="secondary" label="Can’t sign in?" onPress={() => router.navigate('/sign-in-help')} />
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: t.text, marginTop: 8, marginBottom: 4 },
  input: {
    backgroundColor: t.card,
    borderColor: t.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: t.text,
  },
  remember: { paddingVertical: 10 },
  rememberText: { fontSize: 14, color: t.text },
  demo: { fontSize: 13, color: t.muted, marginVertical: 8 },
});
