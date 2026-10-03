import { useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { L } from "../../../theme/loginColors";
import { AvailableUnit } from "../types";

type Props = {
  units: AvailableUnit[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function UnitSelect({ units, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const current = units.find((u) => u.id === selectedId) ?? units[0];

  return (
    <>
      <Pressable style={styles.select} onPress={() => setOpen(true)}>
        <Text numberOfLines={1} style={styles.value}>
          {current?.label}
        </Text>
        <MaterialCommunityIcons name="unfold-more-horizontal" size={18} color={L.muted} />
      </Pressable>

      <Modal
        transparent
        animationType="fade"
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>AVAILABLE UNITS</Text>
            {units.map((u) => {
              const on = u.id === selectedId;
              return (
                <Pressable
                  key={u.id}
                  style={styles.option}
                  onPress={() => {
                    onSelect(u.id);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.optionText, on && styles.optionOn]}>{u.label}</Text>
                  {on ? <Ionicons name="checkmark" size={18} color={L.primary} /> : null}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  select: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: L.border,
  },
  value: { flex: 1, fontSize: 14, color: L.text },
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
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.6,
    color: L.muted,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 10,
  },
  optionText: { flex: 1, fontSize: 14, color: L.text },
  optionOn: { fontWeight: "800", color: L.primary },
});