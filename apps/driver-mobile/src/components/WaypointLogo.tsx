import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { colors } from '../theme/colors';

type Props = {
  size?: number;
  /** Green "online/ready" status dot in the top-right corner */
  showStatus?: boolean;
};

export function WaypointLogo({ size = 96, showStatus = true }: Props) {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 96 96">
        <Rect
          x={2}
          y={2}
          width={92}
          height={92}
          rx={26}
          fill={colors.logoFill}
          stroke={colors.logoBorder}
          strokeWidth={2.5}
        />
        {/* faint route slashes */}
        <Line x1={34} y1={58} x2={44} y2={44} stroke={colors.dotLight} strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
        <Line x1={46} y1={58} x2={56} y2={44} stroke={colors.dotLight} strokeOpacity={0.25} strokeWidth={2} strokeLinecap="round" />
        <Line x1={58} y1={58} x2={68} y2={44} stroke={colors.dotLight} strokeOpacity={0.18} strokeWidth={2} strokeLinecap="round" />
        {/* waypoints */}
        <Circle cx={31} cy={39} r={5} fill={colors.dotLight} />
        <Circle cx={65} cy={62} r={5} fill={colors.dotBlue} />
      </Svg>

      {showStatus && (
        <View style={styles.statusRing}>
          <View style={styles.statusDot} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  statusRing: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#101B45',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.success,
  },
});