import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { O } from "../../../theme/offlineLaunchColors";

type Props = { appName: string; subtitle: string; tagline: string };

const RINGS = [150, 240, 340];

export function BrandHero({ appName, subtitle, tagline }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.hero}>
        {RINGS.map((size) => (
          <View
            key={size}
            style={[
              styles.ring,
              {
                width: size,
                height: size,
                borderRadius: size / 2,
                marginLeft: -size / 2,
                marginTop: -size / 2,
              },
            ]}
          />
        ))}

        <View style={styles.glow} />

        <LinearGradient colors={[O.iconTop, O.iconBottom]} style={styles.icon}>
          <View style={styles.glyphRow}>
            <View style={styles.glyphDot} />
            <Text style={styles.glyph}>//</Text>
            <View style={[styles.glyphDot, { backgroundColor: "#4DA3FF" }]} />
          </View>
          <View style={styles.cornerDot} />
        </LinearGradient>
      </View>

      <Text style={styles.name}>{appName}</Text>

      <View style={styles.subRow}>
        <View style={styles.line} />
        <Text style={styles.subtitle}>{subtitle}</Text>
        <View style={styles.line} />
      </View>

      <Text style={styles.tagline}>{tagline}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center" },
  hero: { width: "100%", height: 150, alignItems: "center", justifyContent: "center" },
  ring: {
    position: "absolute",
    left: "50%",
    top: "50%",
    borderWidth: 1,
    borderColor: O.ring,
  },
  glow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(47,123,255,0.14)",
  },
  icon: {
    width: 84,
    height: 84,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: O.iconBorder,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: O.blue,
    shadowOpacity: 0.7,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 0 },
    elevation: 14,
  },
  glyphRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  glyphDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#8FB6FF" },
  glyph: { color: "#BFD3FF", fontSize: 18, fontWeight: "800", letterSpacing: -1 },
  cornerDot: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: O.amber,
  },
  name: { color: O.white, fontSize: 36, fontWeight: "800", marginTop: 18 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  line: { width: 22, height: 1, backgroundColor: "rgba(47,214,224,0.5)" },
  subtitle: { color: O.cyan, fontSize: 12, fontWeight: "700", letterSpacing: 1.6 },
  tagline: { color: "#C9D2EE", fontSize: 15, marginTop: 14 },
});