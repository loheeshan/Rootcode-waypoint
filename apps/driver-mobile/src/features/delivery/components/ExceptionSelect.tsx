import { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { D } from "../../../theme/deliveryColor";
import { EXCEPTION_OPTIONS } from "../exceptions";
import { ExceptionCode } from "../types";

type Props = {
  value: ExceptionCode;
  onChange: (code: ExceptionCode) => void;
};

export function ExceptionSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = EXCEPTION_OPTIONS.find((o) => o.code === value) ?? EXCEPTION_OPTIONS[0];

  return (
    <>
      <Pressable style={styles.select} onPress={() => setOpen(true)}>
        <Text numberOfLines={1} style={styles.value}>
          {current.label}
        </Text>
        <Ionicons name="chevron-down" size={14} color={D.muted} />
      </Pressable>

      <Modal
        transparent
        animationType="fade"
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Exception</Text>
            {EXCEPTION_OPTIONS.map((o) => (
              <Pressable
                key={o.code}
                style={styles.option}
                onPress={() => {
                  onChange(o.code);
                  setOpen(false);
                }}
              >
                <Text style={[styles.optionText, o.code === value && styles.optionOn]}>
                  {o.label}
                </Text>
                {o.code === value ? (
                  <Ionicons name="checkmark" size={18} color={D.primary} />
                ) : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  select: {
    flex: 1,
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: D.card,
    borderWidth: 1,
    borderColor: D.border,
  },
  value: { flex: 1, fontSize: 13, color: D.text },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(10,16,48,0.55)",
  },
  sheet: { padding: 8, borderRadius: 16, backgroundColor: "#fff" },
  sheetTitle: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: D.muted,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
  },
  optionText: { fontSize: 15, color: D.text },
  optionOn: { fontWeight: "800", color: D.primary },
});