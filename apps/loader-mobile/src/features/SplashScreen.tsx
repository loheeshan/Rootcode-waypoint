import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { splash } from '../../theme/splashTokens';

/* ───────── EDIT HERE: copy ───────── */
const COPY = {
  coordsLine1: 'SYS.LOC // 6.9271° N',
  coordsLine2: '79.8612° E',
  title: 'Waypoint',
  subtitle: 'LOADER LOGISTICS OS',
  tagline: 'Smarter Deliveries. Stronger Tomorrow.',
  pill: 'Offline First Enabled · 100% Local Resilience',
  cache: 'CACHE: LOADING LISTS READY',
  storage: 'SQLITE: ENCRYPTED',
  network: 'Sri Lanka Fleet Network',
};

/* ───────── EDIT HERE: timing ───────── */
const DURATION_MS = 2600; // time to reach 100%
const HOLD_MS = 300; // pause on 100% before navigating

/* ───────── EDIT HERE: status text per progress range ───────── */
const STATUS_STEPS = [
  { upTo: 30, label: 'Starting Waypoint Loader...' },
  { upTo: 65, label: 'Opening local storage...' },
  { upTo: 99, label: 'Initializing offline sync engine...' },
  { upTo: 100, label: 'Ready to load' },
];

type Props = { onFinish: () => void };

export function LoaderSplashScreen({ onFinish }: Props) {
  const insets = useSafeAreaInsets();
  const [pct, setPct] = useState(0);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  // entrance animation
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.92)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [fade, scale]);

  // progress 0 -> 100
  useEffect(() => {
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / DURATION_MS);
      setPct(Math.round((1 - Math.pow(1 - p, 2)) * 100));
      if (p >= 1) clearInterval(id);
    }, 50);
    return () => clearInterval(id);
  }, []);

  // navigate after 100%
  useEffect(() => {
    if (pct < 100) return;
    const id = setTimeout(() => finishRef.current(), HOLD_MS);
    return () => clearTimeout(id);
  }, [pct]);

  const label = STATUS_STEPS.find((s) => pct <= s.upTo)?.label ?? '';
  const version = `v${Constants.expoConfig?.version ?? '0.0.0'}`;

  return (
    <View style={[s.root, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <StatusBar style="light" />

      {/* background: glow, guides, curves */}
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={[s.glow, { width: 620, height: 620, opacity: 0.08 }]} />
        <View style={[s.glow, { width: 460, height: 460, opacity: 0.1 }]} />
        <View style={[s.glow, { width: 300, height: 300, opacity: 0.14 }]} />
        <View style={[s.guide, { left: 22 }]} />
        <View style={[s.guide, { right: 22 }]} />
        <View style={[s.curve, { top: 190, transform: [{ rotate: '4deg' }] }]} />
        <View style={[s.curve, { bottom: 170, transform: [{ rotate: '-4deg' }] }]} />
      </View>

      {/* top-right coordinates */}
      <View style={s.coords}>
        <Text style={s.coordsText}>{COPY.coordsLine1}</Text>
        <Text style={s.coordsText}>{COPY.coordsLine2}</Text>
      </View>

      {/* center brand block */}
      <Animated.View style={[s.center, { opacity: fade }]}>
        <Animated.View style={[s.logoWrap, { transform: [{ scale }] }]}>
          <View style={s.logo}>
            <View style={[s.stroke, { left: 40, transform: [{ rotate: '28deg' }] }]} />
            <View style={[s.stroke, { left: 54, transform: [{ rotate: '28deg' }] }]} />
            <View style={[s.dot, { top: 30, left: 26, backgroundColor: splash.dotLight }]} />
            <View style={[s.dot, { top: 54, left: 66, backgroundColor: splash.dotBlue }]} />
          </View>
          <View style={s.statusRing}>
            <View style={s.statusDot} />
          </View>
        </Animated.View>

        <Text style={s.title}>{COPY.title}</Text>

        <View style={s.subRow}>
          <View style={s.subLine} />
          <Text style={s.subtitle}>{COPY.subtitle}</Text>
          <View style={s.subLine} />
        </View>

        <Text style={s.tagline}>{COPY.tagline}</Text>

        <View style={s.pill}>
          <Ionicons name="checkmark-circle-outline" size={16} color={splash.statusGreen} />
          <Text style={s.pillText}>{COPY.pill}</Text>
        </View>
      </Animated.View>

      {/* bottom: progress + footer */}
      <View style={s.bottom}>
        <View style={s.progressHead}>
          <View style={s.labelRow}>
            <View style={s.labelDot} />
            <Text style={s.label} numberOfLines={1}>
              {label}
            </Text>
          </View>
          <Text style={s.pct}>{pct}%</Text>
        </View>

        <View
          style={s.track}
          accessibilityRole="progressbar"
          accessibilityLabel="Loading Waypoint Loader"
          accessibilityValue={{ min: 0, max: 100, now: pct }}
        >
          <View style={[s.fill, { width: `${pct}%` }]}>
            <View style={s.tip} />
          </View>
        </View>

        <View style={s.metaRow}>
          <Text style={s.meta}>{COPY.cache}</Text>
          <Text style={s.meta}>{COPY.storage}</Text>
        </View>

        <View style={s.footer}>
          <View style={s.footerLeft}>
            <Ionicons name="git-network-outline" size={14} color={splash.meta} />
            <Text style={s.footerText}>{COPY.network}</Text>
          </View>
          <Text style={s.footerText}>{version}</Text>
        </View>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: splash.bg },

  glow: {
    position: 'absolute',
    top: '12%',
    left: '50%',
    backgroundColor: splash.glow,
    borderRadius: 999,
    transform: [{ translateX: -310 }],
  },
  guide: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: splash.guide,
  },
  curve: {
    position: 'absolute',
    left: -80,
    width: 560,
    height: 180,
    borderTopWidth: 1.5,
    borderRadius: 280,
    borderColor: splash.curve,
  },

  coords: { alignItems: 'flex-end', paddingTop: 20, paddingHorizontal: 28 },
  coordsText: { color: splash.meta, fontSize: 10, letterSpacing: 1, lineHeight: 15 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },

  logoWrap: { width: 100, height: 100, marginBottom: 28 },
  logo: {
    width: 96,
    height: 96,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: splash.logoBorder,
    backgroundColor: splash.logoFill,
  },
  stroke: {
    position: 'absolute',
    top: 28,
    width: 2,
    height: 40,
    borderRadius: 1,
    backgroundColor: splash.logoStroke,
  },
  dot: { position: 'absolute', width: 10, height: 10, borderRadius: 5 },
  statusRing: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: splash.statusRing,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: splash.statusGreen },

  title: { color: splash.title, fontSize: 38, fontWeight: '800', letterSpacing: -0.5 },
  subRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 10 },
  subLine: { width: 22, height: 1, backgroundColor: splash.divider },
  subtitle: { color: splash.subtitle, fontSize: 11, fontWeight: '600', letterSpacing: 2.2 },
  tagline: { color: splash.tagline, fontSize: 14, marginTop: 28, textAlign: 'center' },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: splash.pillBorder,
    backgroundColor: splash.pillBg,
  },
  pillText: { color: splash.title, fontSize: 12, fontWeight: '600' },

  bottom: { paddingHorizontal: 28, paddingBottom: 20 },
  progressHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  labelDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: splash.subtitle },
  label: { color: splash.subtitle, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  pct: { color: splash.title, fontSize: 13, fontWeight: '700' },

  track: {
    height: 5,
    borderRadius: 3,
    backgroundColor: splash.barTrack,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: splash.barFill,
    overflow: 'hidden',
    alignItems: 'flex-end',
  },
  tip: { width: 36, height: '100%', backgroundColor: splash.barTip, opacity: 0.85 },

  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  meta: { color: splash.meta, fontSize: 10, letterSpacing: 0.8 },

  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: splash.divider,
  },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  footerText: { color: splash.meta, fontSize: 11 },
});