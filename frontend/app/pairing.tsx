import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import Svg, { Rect, G } from "react-native-svg";
import { colors, spacing, radius, font } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";

type Method = "qr" | "bluetooth" | "wifi";
type Step = "select" | "scanning" | "connecting" | "success";

function FakeQR({ size = 180 }: { size?: number }) {
  const cells = 11;
  const cell = size / cells;
  const rects: any[] = [];
  const pattern = "10110101101001011010110010110101101011010010110100101101011010110100101101011";
  for (let r = 0; r < cells; r++) {
    for (let c = 0; c < cells; c++) {
      const idx = (r * cells + c) % pattern.length;
      if (pattern[idx] === "1") {
        rects.push(<Rect key={`${r}-${c}`} x={c * cell} y={r * cell} width={cell} height={cell} fill={colors.brand} />);
      }
    }
  }
  const finder = (x: number, y: number) => (
    <G key={`f-${x}-${y}`}>
      <Rect x={x} y={y} width={cell * 3} height={cell * 3} fill={colors.brand} />
      <Rect x={x + cell * 0.7} y={y + cell * 0.7} width={cell * 1.6} height={cell * 1.6} fill="#fff" />
    </G>
  );
  return (
    <Svg width={size} height={size}>
      {rects}
      {finder(0, 0)}
      {finder(size - cell * 3, 0)}
      {finder(0, size - cell * 3)}
    </Svg>
  );
}

const METHODS = [
  { key: "qr", icon: "qr-code", title: "QR-Code", desc: "Code auf dem Gerät scannen" },
  { key: "bluetooth", icon: "bluetooth", title: "Bluetooth", desc: "Kabellos in der Nähe koppeln" },
  { key: "wifi", icon: "wifi", title: "WLAN", desc: "Über Ihr Heimnetzwerk verbinden" },
];

export default function Pairing() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [method, setMethod] = useState<Method | null>(null);
  const [step, setStep] = useState<Step>("select");

  const start = (m: Method) => {
    setMethod(m);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setStep(m === "qr" ? "scanning" : "connecting");
  };

  useEffect(() => {
    if (step === "scanning") {
      const t = setTimeout(() => setStep("connecting"), 2200);
      return () => clearTimeout(t);
    }
    if (step === "connecting") {
      const t = setTimeout(() => {
        if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setStep("success");
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.sm, paddingBottom: insets.bottom + spacing.lg }]}>
      <View style={styles.header}>
        <Pressable testID="pairing-close" onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Gerät koppeln</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.body}>
        {step === "select" && (
          <>
            <Text style={styles.lead}>Verbindungsart wählen</Text>
            <Text style={styles.leadSub}>Verbinden Sie Ihr VYLNAX PRO Gerät oder VYLNAX Band.</Text>
            <View style={{ width: "100%", gap: spacing.md, marginTop: spacing.xl }}>
              {METHODS.map((m) => (
                <Pressable key={m.key} testID={`method-${m.key}`} onPress={() => start(m.key as Method)} style={styles.methodCard}>
                  <View style={styles.methodIcon}><Ionicons name={m.icon as any} size={26} color={colors.brandPrimary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.methodTitle}>{m.title}</Text>
                    <Text style={styles.methodDesc}>{m.desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={colors.borderStrong} />
                </Pressable>
              ))}
            </View>
          </>
        )}

        {step === "scanning" && (
          <View style={styles.center}>
            <View style={styles.qrFrame}>
              <FakeQR size={180} />
              <View style={styles.scanLine} />
            </View>
            <Text style={styles.statusText}>QR-Code wird gescannt…</Text>
            <Text style={styles.statusSub}>Richten Sie die Kamera auf den Code am Gerät.</Text>
          </View>
        )}

        {step === "connecting" && (
          <View style={styles.center}>
            <LinearGradient colors={[colors.brand, colors.brandPrimary]} style={styles.connCircle}>
              <ActivityIndicator color="#fff" size="large" />
            </LinearGradient>
            <Text style={styles.statusText}>Verbindung wird hergestellt…</Text>
            <Text style={styles.statusSub}>
              {method === "bluetooth" ? "Bluetooth-Kopplung läuft" : method === "wifi" ? "WLAN-Verbindung wird aufgebaut" : "Gerät wird authentifiziert"}
            </Text>
          </View>
        )}

        {step === "success" && (
          <View style={styles.center}>
            <View style={styles.successCircle}><Ionicons name="checkmark" size={56} color="#fff" /></View>
            <Text style={styles.statusText}>Erfolgreich gekoppelt!</Text>
            <Text style={styles.statusSub}>VYLNAX PRO ist jetzt verbunden und synchronisiert.</Text>
          </View>
        )}
      </View>

      {step === "success" && (
        <PrimaryButton testID="pairing-done" label="Fertig" icon="checkmark" onPress={() => router.back()} />
      )}
      {(step === "scanning" || step === "connecting") && (
        <Pressable testID="pairing-cancel" onPress={() => setStep("select")} style={styles.cancel}>
          <Text style={styles.cancelText}>Abbrechen</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, paddingHorizontal: spacing.lg },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  closeBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: font.lg, fontWeight: "800", color: colors.onSurface },
  body: { flex: 1, alignItems: "center", justifyContent: "center" },
  lead: { fontSize: 24, fontWeight: "800", color: colors.onSurface, textAlign: "center" },
  leadSub: { fontSize: 15, color: colors.onSurfaceSecondary, textAlign: "center", marginTop: spacing.sm },
  methodCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, borderRadius: radius.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  methodIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  methodTitle: { fontSize: font.lg, fontWeight: "800", color: colors.onSurface },
  methodDesc: { fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2 },
  center: { alignItems: "center" },
  qrFrame: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: "#fff", borderWidth: 2, borderColor: colors.brandSecondary, overflow: "hidden" },
  scanLine: { position: "absolute", left: spacing.lg, right: spacing.lg, height: 3, backgroundColor: colors.brandPrimary, top: "50%", opacity: 0.8 },
  statusText: { fontSize: 20, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xl },
  statusSub: { fontSize: 14, color: colors.onSurfaceSecondary, marginTop: spacing.xs, textAlign: "center" },
  connCircle: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center" },
  successCircle: { width: 120, height: 120, borderRadius: 60, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  cancel: { alignItems: "center", paddingVertical: spacing.md },
  cancelText: { color: colors.onSurfaceTertiary, fontWeight: "700", fontSize: font.lg },
});
