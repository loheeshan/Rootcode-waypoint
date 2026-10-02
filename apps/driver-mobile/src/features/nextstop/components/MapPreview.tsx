import { View, Text, StyleSheet } from "react-native";
import Svg, { Rect, Path, Circle } from "react-native-svg";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { N } from "../../../theme/nextStopColors";

type Props = { meta: string; gpsLabel: string; kmLeft: number };

/**
 * Drawn placeholder for the live map.
 * TODO(integration): swap the <Svg> for a real map (react-native-maps or Mapbox)
 * and keep the overlays (meta label, controls, GPS pill) as they are.
 */
export function MapPreview({ meta, gpsLabel, kmLeft }: Props) {
  return (
    <View style={styles.wrap}>
      <Svg width="100%" height="100%" viewBox="0 0 340 200" preserveAspectRatio="xMidYMid slice">
        <Rect width="340" height="200" fill={N.mapBase} />

        {/* parks */}
        <Rect x="0" y="118" width="96" height="82" fill="#CDE2BE" />
        <Rect x="214" y="132" width="126" height="68" fill="#CDE2BE" />
        <Rect x="150" y="0" width="60" height="38" fill="#D6E8C8" />

        {/* city blocks */}
        <Rect x="16" y="14" width="52" height="38" fill="#DCDFE6" />
        <Rect x="82" y="14" width="56" height="38" fill="#D3D8E2" />
        <Rect x="224" y="12" width="46" height="44" fill="#DCDFE6" />
        <Rect x="284" y="12" width="44" height="44" fill="#D3D8E2" />
        <Rect x="112" y="124" width="84" height="58" fill="#DCDFE6" />

        {/* roads */}
        <Path d="M0 100 L340 100" stroke="#fff" strokeWidth="9" />
        <Path d="M0 60 L340 60" stroke="#fff" strokeWidth="6" />
        <Path d="M104 0 L104 200" stroke="#fff" strokeWidth="8" />
        <Path d="M208 0 L208 200" stroke="#fff" strokeWidth="9" />
        <Path d="M290 0 L290 200" stroke="#fff" strokeWidth="6" />
        <Path d="M0 170 L340 170" stroke="#F4D8A8" strokeWidth="7" />

        {/* route */}
        <Path
          d="M56 150 L104 150 L104 100 L208 100 L208 60 L262 60 L262 42"
          stroke="#2B6CE6"
          strokeWidth="5"
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* current position */}
        <Circle cx="56" cy="150" r="14" fill="rgba(43,108,230,0.18)" />
        <Circle cx="56" cy="150" r="7" fill="#2B6CE6" stroke="#fff" strokeWidth="3" />

        {/* destination pin */}
        <Path
          d="M262 16 a11 11 0 0 1 11 11 c0 9 -11 22 -11 22 s-11 -13 -11 -22 a11 11 0 0 1 11 -11z"
          fill="#E53935"
        />
        <Circle cx="262" cy="27" r="4" fill="#fff" />
      </Svg>

      <View style={styles.meta}>
        <Text style={styles.metaText}>{meta}</Text>
      </View>

      <View style={styles.controls}>
        <View style={styles.ctrl}>
          <MaterialCommunityIcons name="crosshairs-gps" size={20} color={N.text} />
        </View>
        <View style={styles.ctrl}>
          <MaterialCommunityIcons name="layers-outline" size={20} color={N.text} />
        </View>
      </View>

      <View style={styles.gps}>
        <View style={styles.gpsDot} />
        <Text style={styles.gpsText}>
          GPS: {gpsLabel} ({kmLeft} km left)
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: 190,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: N.mapBase,
  },
  meta: {
    position: "absolute",
    top: 6,
    left: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  metaText: { fontSize: 8, fontWeight: "800", color: N.text },
  controls: {
    position: "absolute",
    top: 12,
    right: 10,
    padding: 4,
    gap: 6,
    borderRadius: 12,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  ctrl: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  gps: {
    position: "absolute",
    left: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: N.gpsPill,
  },
  gpsDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: N.eta },
  gpsText: { color: "#fff", fontSize: 13, fontWeight: "700" },
});