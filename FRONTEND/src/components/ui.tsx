import React from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, spacing, radius, font, shadow } from "@/src/theme";

// VYLNAX "V" logo mark
export function VLogo({ size = 40 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        backgroundColor: colors.brand,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text style={{ color: "#4DA6E8", fontSize: size * 0.6, fontWeight: "900" }}>V</Text>
    </View>
  );
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: any; testID?: string }) {
  return <View testID={testID} style={[styles.card, style]}>{children}</View>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    taken: { label: "Bestätigt", color: colors.success, bg: "#E7F5EF", icon: "checkmark-circle" },
    missed: { label: "Vergessen", color: colors.error, bg: "#FDECEC", icon: "close-circle" },
    pending: { label: "Ausstehend", color: colors.warning, bg: "#FDF3E6", icon: "time" },
  };
  const s = map[status] || map.pending;
  return (
    <View style={[styles.badge, { backgroundColor: s.bg }]} testID={`status-badge-${status}`}>
      <Ionicons name={s.icon} size={14} color={s.color} />
      <Text style={[styles.badgeText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  icon,
  loading,
  style,
  testID,
  variant = "primary",
}: {
  label: string;
  onPress: () => void;
  icon?: any;
  loading?: boolean;
  style?: any;
  testID?: string;
  variant?: "primary" | "outline" | "danger";
}) {
  const bg = variant === "danger" ? colors.error : variant === "outline" ? "transparent" : colors.brandPrimary;
  const fg = variant === "outline" ? colors.brandPrimary : "#fff";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={loading}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderWidth: variant === "outline" ? 1.5 : 0,
          borderColor: colors.brandPrimary,
          opacity: pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={[styles.btnText, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

// Simple circular progress ring using SVG-free stacked borders alternative
import Svg, { Circle } from "react-native-svg";
export function Ring({
  percent,
  size = 120,
  stroke = 12,
  color = colors.brandPrimary,
  label,
  sublabel,
}: {
  percent: number;
  size?: number;
  stroke?: number;
  color?: string;
  label?: string;
  sublabel?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <Svg width={size} height={size} style={{ position: "absolute" }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceTertiary} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={off}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <Text style={{ fontSize: size * 0.26, fontWeight: "800", color: colors.onSurface }}>
        {label ?? `${percent}%`}
      </Text>
      {sublabel ? <Text style={{ fontSize: 12, color: colors.onSurfaceTertiary }}>{sublabel}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.card,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  btn: {
    minHeight: 52,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: spacing.lg,
  },
  btnText: { fontSize: font.lg, fontWeight: "700" },
});
