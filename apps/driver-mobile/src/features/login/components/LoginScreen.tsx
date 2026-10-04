import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { L } from "../../../theme/loginColors";
import { LoginHeader } from "./LoginHeader";
import { LabeledField } from "./LabeledField";

type Props = {
  onSubmit: (email: string, password: string, remember: boolean) => void;
  /** Optional; hidden unless a real implementation is supplied. */
  onBiometric?: () => void;
  onNfc?: () => void;
  onForgotPassword?: () => void;
  /** Development-only demo account email offered as a one-tap fill. */
  demoEmail?: string | null;
  loading?: boolean;
  error?: string | null;
};

export function LoginScreen({
  onSubmit,
  onBiometric,
  onNfc,
  onForgotPassword,
  demoEmail = null,
  loading = false,
  error = null,
}: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  const canSubmit = emailValid && password.length > 0 && !loading;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: L.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <LoginHeader />

        <View style={styles.body}>
          <LabeledField label="WORK EMAIL">
            <MaterialCommunityIcons name="email-outline" size={20} color={L.muted} />
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor="#B5BBD0"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="username"
              autoCorrect={false}
            />
            {emailValid ? (
              <Ionicons name="checkmark-circle" size={22} color={L.green} />
            ) : null}
          </LabeledField>

          <LabeledField
            label="PASSWORD"
            rightLabel={onForgotPassword ? "Forgot password?" : undefined}
            onRightPress={onForgotPassword}
          >
            <Ionicons name="lock-closed-outline" size={20} color={L.muted} />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#B5BBD0"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              autoCorrect={false}
            />
            <Pressable
              onPress={() => setShowPassword((s) => !s)}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? "Hide password" : "Show password"}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={22}
                color={L.muted}
              />
            </Pressable>
          </LabeledField>

          <View style={styles.rememberRow}>
            <Pressable
              style={styles.rememberLeft}
              onPress={() => setRemember((r) => !r)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
            >
              <View style={[styles.checkbox, remember && styles.checkboxOn]}>
                {remember ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
              </View>
              <Text style={styles.rememberText}>Remember on this phone</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            onPress={() => canSubmit && onSubmit(email.trim(), password, remember)}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.cta,
              !canSubmit && styles.ctaDisabled,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.ctaText}>
              {loading ? "Signing in…" : "Start Shift & Download Run Sheet"}
            </Text>
            {!loading ? <Ionicons name="arrow-forward" size={18} color="#fff" /> : null}
          </Pressable>

          {demoEmail ? (
            <Pressable
              onPress={() => setEmail(demoEmail)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Fill demo email ${demoEmail}`}
            >
              <Text style={styles.rememberText}>
                Demo: use {demoEmail} with the password set when demo accounts were seeded
              </Text>
            </Pressable>
          ) : null}

          {onBiometric ? (
          <Pressable style={styles.bio} onPress={onBiometric}>
            <MaterialCommunityIcons name="fingerprint" size={20} color={L.primary} />
            <Text style={styles.bioText}>Sign In with Fingerprint / Face ID</Text>
          </Pressable>
          ) : null}

          {onNfc ? (
          <View style={styles.dead}>
            <View style={styles.deadIcon}>
              <MaterialCommunityIcons name="nfc" size={20} color="#E0A100" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.deadTitle}>Starting shift in a dead zone?</Text>
              <Text style={styles.deadSub}>
                Load cached offline route tokens via physical card.
              </Text>
            </View>
            <Pressable style={styles.nfcBtn} onPress={onNfc}>
              <Text style={styles.nfcText}>VERIFY{"\n"}NFC</Text>
            </Pressable>
          </View>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 16, paddingTop: 4 },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 18,
    fontWeight: "700",
    color: L.text,
    letterSpacing: 0.5,
  },
  unitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  unitLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, color: L.label },
  ready: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: L.greenBg,
  },
  readyText: { fontSize: 11, fontWeight: "700", color: L.green },
  rememberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingHorizontal: 4,
  },
  rememberLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: "#B5BBD0",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxOn: { backgroundColor: L.primary, borderColor: L.primary },
  rememberText: { fontSize: 14, color: L.text },
  device: { fontSize: 12, fontWeight: "600", color: L.muted },
  error: { marginTop: 12, color: "#C62828", fontSize: 13, fontWeight: "600" },
  cta: {
    marginTop: 18,
    height: 54,
    borderRadius: 14,
    backgroundColor: L.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: L.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  ctaDisabled: { backgroundColor: "#9AA9E6", shadowOpacity: 0, elevation: 0 },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  bio: {
    marginTop: 12,
    height: 48,
    borderRadius: 12,
    backgroundColor: "#fff",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  bioText: { fontSize: 13, fontWeight: "700", color: L.text },
  dead: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    backgroundColor: L.infoBg,
    borderWidth: 1,
    borderColor: L.border,
  },
  deadIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: "#FFF4D6",
    alignItems: "center",
    justifyContent: "center",
  },
  deadTitle: { fontSize: 13, fontWeight: "700", color: L.text },
  deadSub: { fontSize: 12, color: L.muted, marginTop: 2 },
  nfcBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: L.border,
  },
  nfcText: {
    fontSize: 11,
    fontWeight: "800",
    color: L.primary,
    textAlign: "center",
    letterSpacing: 0.5,
  },
});