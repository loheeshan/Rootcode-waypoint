import { useState } from "react";
import { useRouter } from "expo-router";
import { SignInError, signInMessages } from "@waypoint/api-contracts";
import { LoginScreen } from "../src/features/login/components/LoginScreen";
import { HOME, noticeMessages, useAuth } from "../src/services/auth";

// Development builds offer the demo email; the password is still checked by the API.
const DEMO_EMAIL = __DEV__ ? "driver@waypoint.demo" : null;
// Docker demo stack only (EXPO_PUBLIC_DEMO_MODE=true): show the demo account. Sign-in still
// goes through the API with these values; nothing is bypassed.
const DEMO_ACCOUNT = process.env.EXPO_PUBLIC_DEMO_MODE === "true" && process.env.EXPO_PUBLIC_DEMO_PASSWORD
  ? { email: "driver@waypoint.demo", password: process.env.EXPO_PUBLIC_DEMO_PASSWORD }
  : null;

export default function Login() {
  const router = useRouter();
  const { signIn, notice } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (email: string, password: string, remember: boolean) => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await signIn(email, password, remember);
      router.replace(HOME);
    } catch (failure) {
      setError(failure instanceof SignInError ? signInMessages[failure.reason] : signInMessages.unavailable);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LoginScreen
      onSubmit={submit}
      loading={loading}
      error={error ?? (notice ? noticeMessages[notice] : null)}
      demoEmail={DEMO_EMAIL}
      demoAccount={DEMO_ACCOUNT}
    />
  );
}
