import Svg, { Path, Line } from "react-native-svg";

/**
 * Static sample signature that matches the design.
 * TODO(feature/driver-pod-ui): replace with a real drawing pad that records the touch path
 * (PanResponder + this same <Path> with a growing "d" string).
 */
export function SignaturePreview() {
  return (
    <Svg width={170} height={64} viewBox="0 0 170 64">
      <Line
        x1={28}
        y1={50}
        x2={115}
        y2={50}
        stroke="#14214F"
        strokeWidth={1.2}
        strokeDasharray="3 3"
      />
      <Path
        d="M0 47 C6 32 12 22 22 24 C32 26 36 52 44 52 C54 52 54 10 62 8 C70 6 68 56 74 58 C80 60 82 46 94 48 C106 50 116 52 126 40 C134 28 140 18 148 20 C154 22 154 38 155 47"
        stroke="#14214F"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}