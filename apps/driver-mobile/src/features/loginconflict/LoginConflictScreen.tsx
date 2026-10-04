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
import { L } from "../../theme/loginColors";
import { LoginHeader } from "../login/components/LoginHeader";
import { LabeledField } from "../login/components/LabeledField";
import { VehicleCard } from "../login/components/VehicleCard";
import { ConflictPanel } from "./components/ConflictPanel";
import { LoginConflictSnapshot } from "./types";

type Props = {
  data: LoginConflictSnapshot;
  onSubmit?: (payload: {
    driverId: string;
    pin: string;
    remember: boolean;
    unitId: string;
  }) => void;
  onForgotPin?: () => void;
  onContactDispatch?: () => void;
};

export function LoginConflictScreen({ data, onSubmit, onForgotPin, onContactDispatch }: Props) {
  const [driverId, setDriverId] = useState(data.driverId);
  const [pin, setPin] = useState(data.pin);
  const [showPin, setShowPin] = useState(true); // design shows the PIN revealed
  const [remember, setRemember] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [unitId, setUnitId] = useState<string | null>(null);

  const idValid = /^DRV-\d{4}$/i.test(driverId.trim());
  // the conflict blocks sign-in until the driver picks another unit
  const canSubmit = idValid && pin.length >= 4 && unitId !== null;

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
          <LabeledField label="DRIVER ID / BADGE NO." rightLabel="Verified RFID ID">
            <MaterialCommunityIcons
              name="card-account-details-outline"
              size={20}
              color={L.muted}
            />
            <TextInput
              style={styles.input}
              value={driverId}
              onChangeText={setDriverId}
              placeholder="DRV-0000"
              placeholderTextColor="#B5BBD0"
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={8}
            />
            {idValid ? <Ionicons name="checkmark-circle" size={22} color={L.green} /> : null}
          </LabeledField>

          <LabeledField
            label="SHIFT PIN / PASSCODE"
            rightLabel="Forgot PIN?"
            onRightPress={onForgotPin}
          >
            <Ionicons name="lock-closed-outline" size={20} color={L.muted} />
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="••••"
              placeholderTextColor="#B5BBD0"
              secureTextEntry={!showPin}
              keyboardType="number-pad"
              maxLength={6}
            />
            <Pressable onPress={() => setShowPin((s) => !s)} hitSlop={10}>
              <Ionicons
                name={showPin ? "eye-outline" : "eye-off-outline"}
                size={22}
                color={L.muted}
              />
            </Pressable>
          </LabeledField>

          <View style={styles.unitHeader}>
            <Text style={styles.unitLabel}>ASSIGNED TRANSPORT UNIT</Text>
            <View style={styles.ready}>
              <View style={styles.readyDot} />
              <Text style={styles.readyText}>Pre-Trip Ready</Text>
            </View>
          </View>

          <VehicleCard
            plate={data.plate}
            depot={data.depot}
            chamber={data.chamber}
            capacity={data.capacity}
          />

          <ConflictPanel
            conflict={data.conflict}
            hub={data.hub}
            units={data.units}
            expanded={expanded}
            selectedUnitId={unitId}
            onToggleExpanded={() => setExpanded((e) => !e)}
            onSelectUnit={setUnitId}
            onContactDispatch={onContactDispatch}
          />

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
            <Text style={styles.device}>Rugged PNA Device</Text>
          </View>

          <Pressable
            onPress={() =>
              canSubmit && unitId && onSubmit?.({ driverId: driverId.trim(), pin, remember, unitId })
            }
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.cta,
              !canSubmit && styles.ctaDisabled,
              pressed && { opacity: 0.9 },
            ]}
          >
            <Text style={styles.ctaText}>Start Shift & Download Run Sheet</Text>
            <Ionicons name="arrow-forward" size={18} color="#fff" />
          </Pressable>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: L.greenBg,
    borderWidth: 1,
    borderColor: "#BFE8CD",
  },
  readyDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: L.green },
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
  rememberText: { fontSize: 14, fontWeight: "700", color: L.text },
  device: { fontSize: 12, fontWeight: "600", color: L.muted },
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
});