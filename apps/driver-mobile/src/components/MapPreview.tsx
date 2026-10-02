import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/tokens';

type Props = {
  /** e.g. "1.8 MI | 8 MIN" */
  summary: string;
  gpsLabel: string; // e.g. "GPS: Strong (6.2 km left)"
  gpsOk?: boolean;
};

/**
 * Stylised route preview drawn with SVG, so it works offline in Expo Go.
 * Swap for react-native-maps later if live maps are needed (nice-to-have).
 */
export function MapPreview({ summary, gpsLabel, gpsOk = true }: Props) {
  return (
    <View style={styles.wrapper}>
      <Svg width="100%" height="100%" viewBox="0 0 358 156" preserveAspectRatio="xMidYMid slice">
        <Rect x="0" y="0" width="358" height="156" fill={colors.mapBase} />
        {/* parks */}
        <Rect x="0" y="40" width="70" height="50" rx="6" fill={colors.mapPark} />
        <Rect x="120" y="96" width="60" height="44" rx="6" fill={colors.mapPark} />
        <Rect x="250" y="12" width="46" height="40" rx="6" fill={colors.mapPark} />
        {/* roads */}
        <Polyline points="0,70 358,70" stroke={colors.mapRoad} strokeWidth="7" fill="none" />
        <Polyline points="0,120 358,120" stroke={colors.mapRoad} strokeWidth="7" fill="none" />
        <Polyline points="100,0 100,156" stroke={colors.mapRoad} strokeWidth="7" fill="none" />
        <Polyline points="200,0 200,156" stroke={colors.mapRoad} strokeWidth="7" fill="none" />
        <Polyline points="300,0 300,156" stroke={colors.mapRoad} strokeWidth="7" fill="none" />
        {/* route */}
        <Polyline
          points="40,120 100,120 100,70 200,70 200,100 270,100 270,60"
          stroke={colors.primary}
          strokeWidth="4"
          strokeLinejoin="round"
          fill="none"
        />
        <Circle cx="40" cy="120" r="6" fill={colors.primary} stroke="#FFFFFF" strokeWidth="2" />
        <Circle cx="270" cy="56" r="9" fill={colors.mapPin} stroke="#FFFFFF" strokeWidth="2" />
        <Circle cx="270" cy="56" r="3" fill="#FFFFFF" />
      </Svg>

      <View style={styles.summaryChip}>
        <Text style={styles.summaryText}>{summary}</Text>
      </View>

      <View style={styles.controls}>
        <Ionicons name="locate-outline" size={22} color={colors.textPrimary} />
        <View style={styles.divider} />
        <Ionicons name="layers-outline" size={22} color={colors.textPrimary} />
      </View>

      <View style={styles.gpsChip}>
        <View style={[styles.dot, { backgroundColor: gpsOk ? '#22C55E' : colors.mapPin }]} />
        <Text style={styles.gpsText}>{gpsLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    height: 156,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.mapBase,
  },
  summaryChip: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: 'rgba(14,21,48,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  summaryText: { color: '#FFFFFF', fontSize: 8, fontWeight: '700' },
  controls: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 44,
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  divider: { height: 1, width: 24, backgroundColor: colors.border, marginVertical: 10 },
  gpsChip: {
    position: 'absolute',
    left: 10,
    bottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14,21,48,0.88)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  gpsText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
});