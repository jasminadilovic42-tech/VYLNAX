import React, { useEffect } from "react";
import { View, StyleSheet } from "react-native";
import Svg, { Rect, Defs, LinearGradient as SvgGradient, Stop, Circle, Line, Text as SvgText } from "react-native-svg";
import Animated, {
  useSharedValue, useAnimatedProps, withRepeat, withTiming, Easing,
} from "react-native-reanimated";
import { colors } from "@/src/theme";

const AnimatedRect = Animated.createAnimatedComponent(Rect);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const STATUS_COLOR: Record<string, string> = {
  ok: "#22C55E",
  low: "#F59E0B",
  empty: "#EF4444",
};

/**
 * Premium animated "3D-style" visualization of the VYLNAX PRO dispenser.
 * (A true WebGL 3D model requires a native build; this SVG scene works everywhere.)
 */
export function DeviceVisual({
  compartments = [],
  waterLevel = 0,
  waterMax = 500,
}: {
  compartments?: any[];
  waterLevel?: number;
  waterMax?: number;
}) {
  const W = 320;
  const H = 240;
  const pulse = useSharedValue(1);
  const wave = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true);
    wave.value = withRepeat(withTiming(1, { duration: 2600, easing: Easing.linear }), -1, false);
  }, []);

  const alertProps = useAnimatedProps(() => ({ opacity: pulse.value }));

  // water column
  const colX = 236, colY = 40, colW = 54, colH = 150;
  const level = Math.max(0, Math.min(1, waterLevel / waterMax));
  const fillH = colH * level;
  const waterProps = useAnimatedProps(() => {
    return { y: colY + colH - fillH + Math.sin(wave.value * Math.PI * 2) * 2 };
  });

  // compartment grid: 3 columns
  const cols = 3;
  const startX = 24, startY = 96, cellW = 60, cellH = 30, gap = 6;

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
        <Defs>
          <SvgGradient id="body" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#123A5E" />
            <Stop offset="1" stopColor="#0A2542" />
          </SvgGradient>
          <SvgGradient id="screen" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#1A65A9" />
            <Stop offset="1" stopColor="#0B3A64" />
          </SvgGradient>
          <SvgGradient id="water" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#4DA6E8" />
            <Stop offset="1" stopColor="#1A65A9" />
          </SvgGradient>
        </Defs>

        {/* Dispenser body */}
        <Rect x={12} y={20} width={200} height={200} rx={16} fill="url(#body)" />
        {/* Screen */}
        <Rect x={28} y={30} width={168} height={52} rx={8} fill="url(#screen)" />
        <SvgText x={112} y={52} fill="#9DC3E6" fontSize="9" fontWeight="700" textAnchor="middle">VYLNAX PRO</SvgText>
        <SvgText x={112} y={70} fill="#FFFFFF" fontSize="18" fontWeight="800" textAnchor="middle">08:00</SvgText>

        {/* Compartments */}
        {compartments.slice(0, 9).map((c, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = startX + col * (cellW + gap);
          const y = startY + row * (cellH + gap);
          const fill = STATUS_COLOR[c.status] || "#64748B";
          const isAlert = c.status === "empty" || c.status === "low";
          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={cellW} height={cellH} rx={5} fill={fill} opacity={0.92} />
              {isAlert && (
                <AnimatedCircle cx={x + cellW - 8} cy={y + 8} r={4} fill={c.status === "empty" ? "#FCA5A5" : "#FDE68A"} animatedProps={alertProps} />
              )}
              <SvgText x={x + cellW / 2} y={y + cellH / 2 + 4} fill="#FFFFFF" fontSize="11" fontWeight="800" textAnchor="middle">{c.tablets}</SvgText>
            </React.Fragment>
          );
        })}

        {/* Dispensing tray */}
        <Rect x={40} y={196} width={140} height={14} rx={4} fill="#0F2F4E" />
        <Rect x={64} y={200} width={92} height={6} rx={3} fill="#4DA6E8" opacity={0.6} />

        {/* Water column */}
        <Rect x={colX} y={colY} width={colW} height={colH} rx={10} fill="#0A2542" stroke="#1E4E77" strokeWidth={2} />
        <AnimatedRect x={colX + 3} width={colW - 6} height={fillH} rx={7} fill="url(#water)" animatedProps={waterProps} />
        {[100, 200, 300, 400, 500].map((ml, i) => (
          <Line key={ml} x1={colX} y1={colY + colH - (colH * ml) / waterMax} x2={colX + 8} y2={colY + colH - (colH * ml) / waterMax} stroke="#3A6E9C" strokeWidth={1} />
        ))}

        {/* Band */}
        <Circle cx={276} cy={210} r={16} fill="#0F2F4E" stroke="#1A65A9" strokeWidth={2} />
        <SvgText x={276} y={214} fill="#4DA6E8" fontSize="10" fontWeight="800" textAnchor="middle">B</SvgText>
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", paddingVertical: 8 },
});
