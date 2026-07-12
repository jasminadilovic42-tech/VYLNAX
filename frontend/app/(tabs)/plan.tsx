import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { colors, spacing, radius, font } from "@/src/theme";
import { api, todayStr } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { Card, StatusBadge, PrimaryButton } from "@/src/components/ui";
import { PatientSwitcher } from "@/src/components/shared";

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

function weekDates(offset: number) {
  const now = new Date();
  const monday = new Date(now);
  const day = (now.getDay() + 6) % 7;
  monday.setDate(now.getDate() - day + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function Plan() {
  const { activePatient } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [selected, setSelected] = useState(new Date());
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekOffset] = useState(0);
  const dates = weekDates(weekOffset);

  const load = useCallback(async () => {
    if (!activePatient) { setItems([]); setLoading(false); return; }
    try {
      const res = await api<{ items: any[] }>(
        `/patients/${activePatient.id}/schedule?date_str=${todayStr(selected)}`
      );
      setItems(res.items);
    } catch {} finally { setLoading(false); }
  }, [activePatient, selected]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const act = async (it: any, status: string) => {
    if (!activePatient) return;
    if (Platform.OS !== "web") Haptics.selectionAsync();
    await api("/intake", {
      method: "POST",
      body: { patient_id: activePatient.id, medication_id: it.medication_id, scheduled_date: todayStr(selected), scheduled_time: it.time, status },
    });
    load();
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Medikamentenplan</Text>
        <PatientSwitcher />
        <View style={styles.weekRow}>
          {dates.map((d, i) => {
            const active = todayStr(d) === todayStr(selected);
            const isToday = todayStr(d) === todayStr();
            return (
              <Pressable key={i} testID={`day-${i}`} onPress={() => setSelected(d)} style={[styles.dayCol, active && styles.dayColActive]}>
                <Text style={[styles.dayName, active && { color: "#fff" }]}>{DAY_NAMES[i]}</Text>
                <Text style={[styles.dayNum, active && { color: "#fff" }, isToday && !active && { color: colors.brandPrimary }]}>{d.getDate()}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 60 }} />
        ) : items.length === 0 ? (
          <Card style={{ alignItems: "center", paddingVertical: spacing["2xl"] }}>
            <Ionicons name="calendar-clear-outline" size={40} color={colors.borderStrong} />
            <Text style={styles.emptyT}>Keine Einnahmen an diesem Tag</Text>
          </Card>
        ) : (
          items.map((it) => (
            <View key={it.medication_id + it.time} style={styles.tlRow}>
              <View style={styles.tlLeft}>
                <Text style={styles.tlTime}>{it.time}</Text>
                <View style={[styles.tlDot, { backgroundColor: it.color }]} />
              </View>
              <Card style={styles.tlCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.medName}>{it.name}</Text>
                  <Text style={styles.medDose}>{it.dosage} · {it.form}</Text>
                  <View style={{ marginTop: spacing.sm }}>
                    <StatusBadge status={it.status} />
                  </View>
                </View>
                {it.status !== "taken" && (
                  <View style={{ gap: 8 }}>
                    <Pressable testID={`take-${it.medication_id}-${it.time}`} onPress={() => act(it, "taken")} style={[styles.smallBtn, { backgroundColor: colors.success }]}>
                      <Ionicons name="checkmark" size={20} color="#fff" />
                    </Pressable>
                    <Pressable testID={`miss-${it.medication_id}-${it.time}`} onPress={() => act(it, "missed")} style={[styles.smallBtn, { backgroundColor: colors.surfaceTertiary }]}>
                      <Ionicons name="close" size={20} color={colors.error} />
                    </Pressable>
                  </View>
                )}
              </Card>
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 76 }]}>
        <PrimaryButton
          testID="add-medication-button"
          label="Medikament hinzufügen"
          icon="add"
          onPress={() => router.push({ pathname: "/add-medication", params: { patientId: activePatient?.id } })}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { backgroundColor: colors.surface, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  weekRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.lg, gap: 4 },
  dayCol: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.md },
  dayColActive: { backgroundColor: colors.brandPrimary },
  dayName: { fontSize: 12, color: colors.onSurfaceTertiary, fontWeight: "600" },
  dayNum: { fontSize: 16, fontWeight: "800", color: colors.onSurface, marginTop: 2 },
  tlRow: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  tlLeft: { alignItems: "center", width: 52 },
  tlTime: { fontSize: 14, fontWeight: "800", color: colors.brand },
  tlDot: { width: 12, height: 12, borderRadius: 6, marginTop: 6 },
  tlCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: spacing.md },
  medName: { fontSize: font.lg, fontWeight: "700", color: colors.onSurface },
  medDose: { fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2 },
  smallBtn: { width: 44, height: 40, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  emptyT: { color: colors.onSurfaceSecondary, fontWeight: "600", marginTop: spacing.sm },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
});
