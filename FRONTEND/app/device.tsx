import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { colors, spacing, radius, font } from "@/src/theme";
import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { Card, PrimaryButton } from "@/src/components/ui";
import { PatientSwitcher } from "@/src/components/shared";
import { DeviceVisual } from "@/src/components/DeviceVisual";

const STATUS = {
  ok: { c: "#059669", bg: "#E7F5EF", label: "Verfügbar" },
  low: { c: "#D97706", bg: "#FDF3E6", label: "Niedrig" },
  empty: { c: "#DC2626", bg: "#FDECEC", label: "Leer" },
} as const;

function SignalBars({ value, color = colors.brandPrimary }: { value: number; color?: string }) {
  const active = Math.ceil((value / 100) * 4);
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 2, height: 16 }}>
      {[1, 2, 3, 4].map((i) => (
        <View key={i} style={{ width: 4, height: 4 + i * 3, borderRadius: 1, backgroundColor: i <= active ? color : colors.surfaceTertiary }} />
      ))}
    </View>
  );
}

export default function Device() {
  const { activePatient } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState("dispenser-1");
  const [toast, setToast] = useState("");

  const load = useCallback(async () => {
    if (!activePatient) { setLoading(false); return; }
    try {
      const res = await api(`/patients/${activePatient.id}/device`);
      setData(res);
    } catch {} finally { setLoading(false); }
  }, [activePatient]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const firmwareUpdate = async () => {
    if (!activePatient) return;
    setUpdating(true);
    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const res = await api<any>(`/patients/${activePatient.id}/device/action`, { method: "POST", body: { action: "firmware" } });
      setToast(res.message);
      setTimeout(() => setToast(""), 3000);
      await load();
    } catch {} finally { setUpdating(false); }
  };

  const d = data?.dispenser;
  const b = data?.band;
  const isBand = selectedDevice === "band-1";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View style={styles.headerRow}>
          <Pressable testID="device-back" onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
          </Pressable>
          <Text style={styles.title}>Geräte</Text>
          <View style={{ width: 40 }} />
        </View>
        <PatientSwitcher />
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 60 }} />
        ) : !d ? (
          <Text style={styles.empty}>Kein Gerät verbunden.</Text>
        ) : (
          <>
            {/* Multi-device selector */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devSelector}>
              {data.devices.map((dev: any) => {
                const active = selectedDevice === dev.id;
                return (
                  <Pressable key={dev.id} testID={`device-tab-${dev.id}`} onPress={() => setSelectedDevice(dev.id)} style={[styles.devChip, active && styles.devChipActive]}>
                    <Ionicons name={dev.type === "band" ? "watch" : "hardware-chip"} size={16} color={active ? "#fff" : colors.brandPrimary} />
                    <Text style={[styles.devChipText, active && { color: "#fff" }]}>{dev.name}</Text>
                    <View style={styles.onlineDot} />
                  </Pressable>
                );
              })}
            </ScrollView>

            {toast ? (
              <View style={styles.toast} testID="device-toast"><Ionicons name="checkmark-circle" size={18} color="#fff" /><Text style={styles.toastText}>{toast}</Text></View>
            ) : null}

            {!isBand ? (
              <>
                {/* Reminders */}
                {d.reminders?.filter((r: any) => r.urgent).map((r: any, i: number) => (
                  <View key={i} style={styles.reminderUrgent} testID={`reminder-${r.type}`}>
                    <Ionicons name="alert-circle" size={20} color={colors.error} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.remTitle}>{r.title}</Text>
                      <Text style={styles.remDetail}>{r.detail}</Text>
                    </View>
                  </View>
                ))}

                {/* Visualization */}
                <Card style={styles.visualCard}>
                  <LinearGradient colors={[colors.brand, colors.brandPrimary]} style={styles.visualHead}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.visualName}>{d.name}</Text>
                      <View style={styles.connRow}><View style={styles.greenDot} /><Text style={styles.connText}>Verbunden · {d.location}</Text></View>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: d.status.includes("Ordnung") ? "rgba(34,197,94,0.25)" : "rgba(245,158,11,0.25)" }]}>
                      <Text style={styles.statusPillText}>{d.status}</Text>
                    </View>
                  </LinearGradient>
                  <DeviceVisual compartments={d.compartments} waterLevel={d.water.level_ml} waterMax={d.water.max_ml} />
                  <View style={styles.legend}>
                    {(["ok", "low", "empty"] as const).map((s) => (
                      <View key={s} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: STATUS[s].c }]} />
                        <Text style={styles.legendText}>{STATUS[s].label}</Text>
                      </View>
                    ))}
                  </View>
                </Card>

                {/* Quick stats */}
                <View style={styles.statRow}>
                  <StatBox icon="calendar" value={`${d.days_remaining}`} label="Tage Reichweite" />
                  <StatBox icon="water" value={`${d.water.remaining_doses}`} label="Dosen (Wasser)" />
                  <StatBox icon="grid" value={`${d.compartments_filled}/${d.compartments_total}`} label="Fächer voll" />
                </View>

                {/* Compartments */}
                <Text style={styles.section}>Fächer & Füllstand</Text>
                <View style={styles.compGrid}>
                  {d.compartments.map((c: any) => {
                    const s = (STATUS as any)[c.status];
                    return (
                      <View key={c.slot} style={[styles.compCard, { borderColor: s.c }]} testID={`compartment-${c.slot}`}>
                        <View style={styles.compTop}>
                          <View style={[styles.compDot, { backgroundColor: s.c }]} />
                          <Text style={styles.compSlot}>Fach {c.slot}</Text>
                        </View>
                        <Text style={styles.compMed} numberOfLines={1}>{c.med}</Text>
                        <Text style={[styles.compCount, { color: s.c }]}>{c.tablets} Stk.</Text>
                        <View style={styles.compTrack}><View style={[styles.compFill, { width: `${Math.round((c.tablets / c.capacity) * 100)}%`, backgroundColor: s.c }]} /></View>
                        <Text style={[styles.compStatus, { color: s.c }]}>{s.label}</Text>
                      </View>
                    );
                  })}
                </View>

                {/* Water system */}
                <Text style={styles.section}>Wassersystem</Text>
                <Card>
                  <Row icon="water" color={colors.info} label="Wasserstand" value={`${d.water.level_ml} / ${d.water.max_ml} ml`} progress={d.water.level_ml / d.water.max_ml} />
                  <Row icon="beaker" color={colors.brandPrimary} label="Verbleibende Dosen" value={`${d.water.remaining_doses}`} />
                  <Row icon="sync" color={colors.success} label="Pumpe" value={d.water.pump_status} />
                  <Row icon="sunny" color="#7C3AED" label="UVC-Sterilisation" value={d.water.uvc_status} last />
                </Card>

                {/* Monitoring & sensors */}
                <Text style={styles.section}>Überwachung & Sensoren</Text>
                <Card>
                  <SignalRow label="Bluetooth" value={d.bluetooth_signal} />
                  <SignalRow label="WLAN" value={d.wifi_signal} />
                  <Row icon="time" color={colors.onSurfaceSecondary} label="Letzte Sync" value="gerade eben" />
                  <Row icon="thermometer" color={colors.warning} label="Temperatur" value={`${d.temperature_c} °C`} />
                  <Row icon="water-outline" color={colors.info} label="Luftfeuchte" value={`${d.humidity_pct}%`} />
                  <Row icon="battery-charging" color={colors.success} label="Stromversorgung" value={d.power_supply} />
                  <Row icon="battery-half" color={colors.success} label="Backup-Akku" value={`${d.backup_battery}%`} progress={d.backup_battery / 100} />
                  <Row icon="pulse" color={colors.brandPrimary} label="Akku-Gesundheit" value={`${d.battery_health}%`} last />
                </Card>

                {/* Firmware */}
                <Card style={{ marginTop: spacing.lg }}>
                  <View style={styles.fwRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.fwLabel}>Firmware</Text>
                      <Text style={styles.fwVersion}>Version {d.firmware} · S/N {d.serial}</Text>
                    </View>
                    {d.update_available ? (
                      <View style={styles.updateBadge}><Text style={styles.updateBadgeText}>Update {d.latest_firmware}</Text></View>
                    ) : (
                      <Ionicons name="checkmark-circle" size={22} color={colors.success} />
                    )}
                  </View>
                  {d.update_available && (
                    <PrimaryButton testID="firmware-update" label="Firmware aktualisieren" icon="cloud-download" loading={updating} onPress={firmwareUpdate} style={{ marginTop: spacing.md }} />
                  )}
                </Card>

                <PrimaryButton testID="open-diagnostics" label="Diagnose & Wartung" icon="build" variant="outline" onPress={() => router.push("/device-diagnostics")} style={{ marginTop: spacing.lg }} />
                <PrimaryButton testID="pair-device-button" label="Neues Gerät koppeln" icon="qr-code" variant="outline" onPress={() => router.push("/pairing")} style={{ marginTop: spacing.md }} />
              </>
            ) : (
              <Card style={{ marginTop: spacing.md }}>
                <LinearGradient colors={[colors.brand, colors.brandPrimary]} style={styles.bandHead}>
                  <Ionicons name="watch" size={28} color="#fff" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.visualName}>{b.name}</Text>
                    <View style={styles.connRow}><View style={styles.greenDot} /><Text style={styles.connText}>{b.location}</Text></View>
                  </View>
                </LinearGradient>
                <View style={{ paddingTop: spacing.md }}>
                  <Row icon="battery-half" color={colors.success} label="Akku" value={`${b.battery}%`} progress={b.battery / 100} />
                  <Row icon="pulse" color={colors.error} label="Herzfrequenz" value={`${b.heart_rate} bpm`} />
                  <Row icon="walk" color={colors.brandPrimary} label="Schritte heute" value={`${b.steps}`} />
                  <SignalRow label="Bluetooth" value={b.bluetooth_signal} />
                  <Row icon="hardware-chip" color={colors.onSurfaceSecondary} label="Firmware" value={b.firmware} last />
                </View>
              </Card>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function StatBox({ icon, value, label }: any) {
  return (
    <View style={styles.statBox}>
      <Ionicons name={icon} size={20} color={colors.brandPrimary} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function Row({ icon, color, label, value, progress, last }: any) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1, alignItems: "flex-end" }}>
        <Text style={styles.rowValue}>{value}</Text>
        {typeof progress === "number" && (
          <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(progress * 100)}%`, backgroundColor: color }]} /></View>
        )}
      </View>
    </View>
  );
}

function SignalRow({ label, value }: any) {
  const color = value >= 66 ? colors.success : value >= 33 ? colors.warning : colors.error;
  return (
    <View style={styles.row}>
      <Ionicons name={label === "WLAN" ? "wifi" : "bluetooth"} size={20} color={colors.brandPrimary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
        <Text style={styles.rowValue}>{value}%</Text>
        <SignalBars value={value} color={color} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { backgroundColor: colors.surface, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: spacing.sm },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  empty: { textAlign: "center", color: colors.onSurfaceSecondary, marginTop: 60 },
  devSelector: { gap: spacing.sm, paddingBottom: spacing.md },
  devChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, height: 38, borderRadius: radius.pill, backgroundColor: colors.brandSecondary, borderWidth: 1, borderColor: colors.border },
  devChipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  devChipText: { fontWeight: "700", color: colors.brand, fontSize: 13 },
  onlineDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#22C55E" },
  toast: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.success, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md },
  toastText: { color: "#fff", fontWeight: "700", flex: 1 },
  reminderUrgent: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: "#FDECEC", borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: "#F5C6C6" },
  remTitle: { fontWeight: "800", color: colors.error },
  remDetail: { fontSize: 12.5, color: "#7F1D1D", marginTop: 2 },
  visualCard: { padding: 0, overflow: "hidden" },
  visualHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg },
  visualName: { color: "#fff", fontSize: 18, fontWeight: "800" },
  connRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  greenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#4ADE80" },
  connText: { color: "#DFF5E4", fontSize: 12.5, fontWeight: "600" },
  statusPill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill },
  statusPillText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  legend: { flexDirection: "row", justifyContent: "center", gap: spacing.lg, paddingBottom: spacing.md },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, color: colors.onSurfaceSecondary, fontWeight: "600" },
  statRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  statBox: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: "center", paddingVertical: spacing.md, gap: 4 },
  statValue: { fontSize: 18, fontWeight: "800", color: colors.onSurface },
  statLabel: { fontSize: 10.5, color: colors.onSurfaceTertiary, textAlign: "center" },
  section: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  compGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  compCard: { width: "31.5%", backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1.5, padding: spacing.sm },
  compTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  compDot: { width: 8, height: 8, borderRadius: 4 },
  compSlot: { fontSize: 11, fontWeight: "700", color: colors.onSurfaceTertiary },
  compMed: { fontSize: 12.5, fontWeight: "700", color: colors.onSurface, marginTop: 4 },
  compCount: { fontSize: 16, fontWeight: "800", marginTop: 2 },
  compTrack: { height: 5, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginTop: 6, overflow: "hidden" },
  compFill: { height: 5, borderRadius: 3 },
  compStatus: { fontSize: 10.5, fontWeight: "700", marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingVertical: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowLabel: { color: colors.onSurfaceSecondary, fontSize: font.base, width: 130 },
  rowValue: { color: colors.onSurface, fontWeight: "700", fontSize: font.base },
  track: { width: 90, height: 6, borderRadius: 3, backgroundColor: colors.surfaceTertiary, marginTop: 6, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  fwRow: { flexDirection: "row", alignItems: "center" },
  fwLabel: { fontSize: 12, color: colors.onSurfaceTertiary, fontWeight: "700" },
  fwVersion: { fontSize: 14, color: colors.onSurface, fontWeight: "600", marginTop: 2 },
  updateBadge: { backgroundColor: colors.warning, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill },
  updateBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  bandHead: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, margin: -spacing.lg, marginBottom: 0, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg },
});
