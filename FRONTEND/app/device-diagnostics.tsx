import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { colors, spacing, radius, font } from "@/src/theme";
import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { Card, PrimaryButton } from "@/src/components/ui";

const SEV = { info: colors.info, warning: colors.warning, error: colors.error } as const;

export default function DeviceDiagnostics() {
  const { activePatient } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [diag, setDiag] = useState<any>(null);
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    if (!activePatient) { setLoading(false); return; }
    try { setData(await api(`/patients/${activePatient.id}/device`)); } catch {} finally { setLoading(false); }
  }, [activePatient]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const act = async (action: string) => {
    if (!activePatient) return;
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (action === "run_diagnostics") setRunning(true);
    if (action === "restart") setRestarting(true);
    try {
      const res = await api<any>(`/patients/${activePatient.id}/device/action`, { method: "POST", body: { action } });
      if (action === "run_diagnostics") setDiag(res.results);
      setToast(res.message);
      setTimeout(() => setToast(""), 3500);
    } catch {} finally { setRunning(false); setRestarting(false); }
  };

  const d = data?.dispenser;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="diag-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Diagnose & Wartung</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}>
        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 60 }} />
        ) : !d ? (
          <Text style={styles.empty}>Kein Gerät.</Text>
        ) : (
          <>
            {toast ? <View style={styles.toast}><Ionicons name="information-circle" size={18} color="#fff" /><Text style={styles.toastText}>{toast}</Text></View> : null}

            {/* Remote actions */}
            <Text style={styles.section}>Fernwartung</Text>
            <View style={styles.actionRow}>
              <Pressable testID="run-diagnostics" onPress={() => act("run_diagnostics")} style={styles.actionCard}>
                {running ? <ActivityIndicator color={colors.brandPrimary} /> : <Ionicons name="pulse" size={26} color={colors.brandPrimary} />}
                <Text style={styles.actionText}>Diagnose starten</Text>
              </Pressable>
              <Pressable testID="remote-restart" onPress={() => act("restart")} style={styles.actionCard}>
                {restarting ? <ActivityIndicator color={colors.brandPrimary} /> : <Ionicons name="refresh-circle" size={26} color={colors.brandPrimary} />}
                <Text style={styles.actionText}>Neustart</Text>
              </Pressable>
            </View>

            {diag && (
              <Card style={{ marginTop: spacing.md }}>
                <Text style={styles.cardTitle}>Diagnose-Ergebnis</Text>
                {diag.map((r: any, i: number) => (
                  <View key={i} style={styles.diagRow}>
                    <Ionicons name={r.status === "ok" ? "checkmark-circle" : "close-circle"} size={18} color={r.status === "ok" ? colors.success : colors.error} />
                    <Text style={styles.diagText}>{r.check}</Text>
                    <Text style={[styles.diagStatus, { color: r.status === "ok" ? colors.success : colors.error }]}>{r.status === "ok" ? "OK" : "Fehler"}</Text>
                  </View>
                ))}
              </Card>
            )}

            {/* Error log */}
            <Text style={styles.section}>Fehlerprotokoll</Text>
            <Card>
              {d.error_log.map((e: any, i: number) => (
                <View key={i} style={[styles.logRow, i === d.error_log.length - 1 && { borderBottomWidth: 0 }]}>
                  <View style={[styles.sevDot, { backgroundColor: (SEV as any)[e.severity] }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logCode}>{e.code}</Text>
                    <Text style={styles.logMsg}>{e.message}</Text>
                  </View>
                  <Text style={styles.logTime}>{new Date(e.time).toLocaleDateString("de-DE")}</Text>
                </View>
              ))}
            </Card>

            {/* Maintenance history */}
            <Text style={styles.section}>Wartungshistorie</Text>
            <Card>
              {d.maintenance_history.map((m: any, i: number) => (
                <View key={i} style={[styles.logRow, i === d.maintenance_history.length - 1 && { borderBottomWidth: 0 }]}>
                  <Ionicons name="build" size={18} color={colors.brandPrimary} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.logCode}>{m.type}</Text>
                    <Text style={styles.logMsg}>{m.note}</Text>
                  </View>
                  <Text style={styles.logTime}>{m.date}</Text>
                </View>
              ))}
            </Card>

            <Text style={styles.serial}>S/N {d.serial} · Firmware {d.firmware}</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, paddingBottom: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  empty: { textAlign: "center", color: colors.onSurfaceSecondary, marginTop: 60 },
  toast: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.brandPrimary, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  toastText: { color: "#fff", fontWeight: "700", flex: 1 },
  section: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  actionRow: { flexDirection: "row", gap: spacing.md },
  actionCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: "center", paddingVertical: spacing.lg, gap: 8 },
  actionText: { fontWeight: "700", color: colors.onSurfaceSecondary, fontSize: 13 },
  cardTitle: { fontSize: font.lg, fontWeight: "800", color: colors.onSurface, marginBottom: spacing.sm },
  diagRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.sm },
  diagText: { flex: 1, color: colors.onSurfaceSecondary, fontSize: 14 },
  diagStatus: { fontWeight: "800", fontSize: 13 },
  logRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  sevDot: { width: 10, height: 10, borderRadius: 5 },
  logCode: { fontWeight: "800", color: colors.onSurface, fontSize: 13 },
  logMsg: { color: colors.onSurfaceTertiary, fontSize: 12.5, marginTop: 2 },
  logTime: { color: colors.onSurfaceTertiary, fontSize: 11 },
  serial: { textAlign: "center", color: colors.onSurfaceTertiary, fontSize: 12, marginTop: spacing.lg },
});
