import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Line, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WaypointLogo } from '../../components/WaypointLogo';
import { colors } from '../../theme/colors';

type Props = {
  /** 0–100 */
  progress: number;
  statusText: string;
  cachedOutlets: number;
  version?: string;
  build?: string;
};

const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function SplashScreen({
  progress,
  statusText,
  cachedOutlets,
  version = 'v2.4.0',
  build = '884',
}: Props) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // Animated progress bar
  const anim = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(0);

  useEffect(() => {
    const id = anim.addListener(({ value }) => setShown(Math.round(value)));
    return () => anim.removeListener(id);
  }, [anim]);

  useEffect(() => {
    Animated.timing(anim, {
      toValue: progress,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // width can't use the native driver
    }).start();
  }, [progress, anim]);

  const barWidth = anim.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  // One gentle pulse on the logo's status area is enough motion for a splash
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[colors.bgTop, colors.bgMid, colors.bgLow, colors.bgBottom]}
        locations={[0, 0.32, 0.7, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Decorative guides + route curves */}
      <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
        <Line x1={width * 0.2} y1={0} x2={width * 0.2} y2={height} stroke={colors.guide} strokeDasharray="4 6" />
        <Line x1={width * 0.9} y1={0} x2={width * 0.9} y2={height} stroke={colors.guide} strokeDasharray="4 6" />
        <Path
          d={`M0 ${height * 0.25} C ${width * 0.3} ${height * 0.22}, ${width * 0.6} ${height * 0.3}, ${width} ${height * 0.35}`}
          stroke={colors.curve}
          strokeWidth={1.2}
          fill="none"
        />
        <Path
          d={`M0 ${height * 0.72} C ${width * 0.25} ${height * 0.66}, ${width * 0.55} ${height * 0.8}, ${width} ${height * 0.74}`}
          stroke={colors.curve}
          strokeWidth={1}
          strokeDasharray="5 7"
          fill="none"
        />
      </Svg>

      {/* Top-right coordinates (Colombo) */}
      <Text style={[styles.coords, { top: insets.top + 44 }]}>
        {'SYS.LOC // 6.9271° N\n79.8612° E'}
      </Text>

      {/* Centre brand block */}
      <Animated.View style={[styles.center, { opacity: fade }]}>
        <WaypointLogo size={96} />
        <Text style={styles.title}>Waypoint</Text>

        <View style={styles.subtitleRow}>
          <View style={styles.subtitleLine} />
          <Text style={styles.subtitle}>DRIVER LOGISTICS OS</Text>
          <View style={styles.subtitleLine} />
        </View>

        <Text style={styles.tagline}>Smarter Deliveries. Stronger Tomorrow.</Text>

        <View style={styles.pill}>
          <Ionicons name="checkmark-circle-outline" size={16} color={colors.success} />
          <Text style={styles.pillText}>Offline First Enabled · 100% Local Resilience</Text>
        </View>
      </Animated.View>

      {/* Bottom loader */}
      <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
        <View style={styles.statusRow}>
          <View style={styles.statusLeft}>
            <View style={styles.bullet} />
            <Text style={styles.statusText} numberOfLines={1}>
              {statusText}
            </Text>
          </View>
          <Text style={styles.percent}>{shown}%</Text>
        </View>

        <View style={styles.track}>
          <Animated.View style={[styles.fillWrap, { width: barWidth }]}>
            <LinearGradient
              colors={[colors.barStart, colors.barEnd]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaText}>CACHE: {cachedOutlets} OUTLETS READY</Text>
          <Text style={styles.metaText}>SQLITE: ENCRYPTED</Text>
        </View>

        <View style={styles.divider} />

        <View style={styles.footerRow}>
          <View style={styles.footerLeft}>
            <Ionicons name="git-network-outline" size={14} color={colors.textMuted} />
            <Text style={styles.footerText}>Sri Lanka Fleet Network</Text>
          </View>
          <Text style={styles.footerText}>
            {version} (Build {build})
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgLow },

  coords: {
    position: 'absolute',
    right: 24,
    textAlign: 'right',
    fontFamily: MONO,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.5,
    color: colors.textMuted,
  },

  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 60,
  },
  title: {
    marginTop: 28,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: colors.white,
  },
  subtitleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  subtitleLine: { width: 28, height: 1, backgroundColor: colors.guide },
  subtitle: {
    marginHorizontal: 10,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 2.2,
    color: colors.textSecondary,
  },
  tagline: {
    marginTop: 22,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  pill: {
    marginTop: 22,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    backgroundColor: colors.pillBg,
    borderWidth: 1,
    borderColor: colors.pillBorder,
  },
  pillText: { fontSize: 12, fontWeight: '600', color: colors.white },

  bottom: { paddingHorizontal: 24 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statusLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 12 },
  bullet: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.dotLight, marginRight: 8 },
  statusText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  percent: { fontSize: 12, fontWeight: '700', color: colors.white },

  track: {
    marginTop: 10,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.trackBg,
    overflow: 'hidden',
  },
  fillWrap: { height: '100%', borderRadius: 3, overflow: 'hidden' },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  metaText: { fontSize: 10, letterSpacing: 0.8, color: colors.textMuted },

  divider: { height: 1, backgroundColor: colors.guide, marginTop: 18, marginBottom: 14 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerText: { fontSize: 11, color: colors.textMuted },
});