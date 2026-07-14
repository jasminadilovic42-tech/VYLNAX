import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import { colors, spacing, radius, font, ROLES } from "@/src/theme";
import { api, todayStr } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { Card, Ring, StatusBadge, PrimaryButton } from "@/src/components/ui";
import { PatientSwitcher, SosFab, SectionTitle } from "@/src/components/shared";

type Item = {
  medication_id: string;
  name: string;
  dosage: string;
  form: string;
  color: string;
  time: string;
  status: string;
};

export default function Dashboard() {
  const { user } = useAuth();
  const { activePatient } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activePatient) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const res = await api<{ items: Item[] }>(
        `/patients/${activePatient.id}/schedule?date_str=${todayStr()}`
      );
      setItems(res.items);
    } catch {
    } finally {
      setLoading(false);
    }
  }, [activePatient]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load])
  );

  const confirm = async (it: Item) => {
    if (!activePatient) return;
    setConfirming(it.medication_id + it.time);
    if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    try {
      await api("/intake", {
        method: "POST",
        body: {
          patient_id: activePatient.id,
          medication_id: it.medication_id,
          scheduled_date: todayStr(),
          scheduled_time: it.time,
          status: "taken",
        },
      });
      await load();
    } finally {
      setConfirming(null);
    }
  };

  const nowStr = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;
  const next = items.find((i) => i.status === "pending" && i.time >= nowStr) || items.find((i) => i.status === "pending");
  const done = items.filter((i) => i.status === "taken").length;
  const missed = items.filter((i) => i.status === "missed").length;
  const rate = items.length ? Math.round((done / items.length) * 100) : 100;

  const firstName = (user?.name || "").split(" ")[0] || "Willkommen";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <View>
          <Text style={styles.greeting}>Hallo, {firstName}</Text>
          <Text style={styles.role}>{ROLES[user?.role || "patient"]}</Text>
        </View>
        <Pressable testID="header-bell" style={styles.bell}>
          <Ionicons name="notifications-outline" size={22} color={colors.brand} />
          {missed > 0 && <View style={styles.dot} />}
        </Pressable>
      </View>
      <PatientSwitcher />

      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 140 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} tintColor={colors.brandPrimary} />}
      >
        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 60 }} />
        ) : (
          <>
            {/* Next dose hero */}
            <Card style={styles.hero}>
              <Text style={styles.heroLabel}>NÄCHSTE EINNAHME</Text>
              {next ? (
                <>
                  <Text style={styles.heroTime}>{next.time}</Text>
                  <View style={styles.heroMedRow}>
                    <View style={[styles.pill, { backgroundColor: next.color }]} />
                    <Text style={styles.heroMed}>{next.name} · {next.dosage}</Text>
                  </View>
                  <PrimaryButton
                    testID="confirm-next-dose"
                    label="Einnahme bestätigen"
                    icon="checkmark-circle"
                    loading={confirming === next.medication_id + next.time}
                    onPress={() => confirm(next)}
                    style={{ marginTop: spacing.md, backgroundColor: "#fff" }}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.heroTime}>Alles erledigt</Text>
                  <Text style={styles.heroDone}>Keine weitere Einnahme heute ausstehend.</Text>
                </>
              )}
            </Card>

            {/* Quick actions */}
            <View style={styles.quickRow}>
              <Pressable testID="quick-device" onPress={() => router.push("/device")} style={styles.quickCard}>
                <Ionicons name="hardware-chip" size={22} color={colors.brandPrimary} />
                <Text style={styles.quickText}>Gerät</Text>
              </Pressable>
              <Pressable testID="quick-safety" onPress={() => router.push("/safety")} style={styles.quickCard}>
                <Ionicons name="shield-checkmark" size={22} color={colors.brandPrimary} />
                <Text style={styles.quickText}>Sicherheit</Text>
              </Pressable>
              <Pressable testID="quick-add-med" onPress={() => router.push({ pathname: "/add-medication", params: { patientId: activePatient?.id } })} style={styles.quickCard}>
                <Ionicons name="add-circle" size={22} color={colors.brandPrimary} />
                <Text style={styles.quickText}>Medikament</Text>
              </Pressable>
              <Pressable testID="quick-assistant" onPress={() => router.push("/(tabs)/assistant")} style={styles.quickCard}>
                <Ionicons name="sparkles" size={22} color={colors.brandPrimary} />
                <Text style={styles.quickText}>KI-Hilfe</Text>
              </Pressable>
            </View>

            {/* Today status */}
            <SectionTitle title="Heutiger Status" />
            <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.lg }}>
              <Ring percent={rate} size={110} sublabel="erledigt" color={rate >= 80 ? colors.success : colors.warning} />
              <View style={{ flex: 1, gap: spacing.md }}>
                <StatRow icon="checkmark-circle" color={colors.success} label="Bestätigt" value={done} />
                <StatRow icon="time" color={colors.warning} label="Ausstehend" value={items.filter(i=>i.status==="pending").length} />
                <StatRow icon="close-circle" color={colors.error} label="Vergessen" value={missed} />
              </View>
            </Card>

            {/* Today schedule */}
            <SectionTitle title="Einnahmen heute" action="Zum Plan" onAction={() => router.push("/(tabs)/plan")} />
            {items.length === 0 ? (
              <Card style={{ alignItems: "center", paddingVertical: spacing["2xl"] }}>
                <Ionicons name="medkit-outline" size={40} color={colors.borderStrong} />
                <Text style={styles.emptyT}>Noch keine Medikamente</Text>
                <PrimaryButton
                  testID="empty-add-med"
                  label="Medikament hinzufügen"
                  icon="add"
                  variant="outline"
                  onPress={() => router.push({ pathname: "/add-medication", params: { patientId: activePatient?.id } })}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            ) : (
              items.map((it) => (
                <Card key={it.medication_id + it.time} style={styles.medRow}>
                  <Text style={styles.medTime}>{it.time}</Text>
                  <View style={[styles.pill, { backgroundColor: it.color }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.medName}>{it.name}</Text>
                    <Text style={styles.medDose}>{it.dosage} · {it.form}</Text>
                  </View>
                  {it.status === "taken" ? (
                    <StatusBadge status="taken" />
                  ) : (
                    <Pressable
                      testID={`confirm-${it.medication_id}-${it.time}`}
                      onPress={() => confirm(it)}
                      style={styles.checkBtn}
                    >
                      {confirming === it.medication_id + it.time ? (
                        <ActivityIndicator color={colors.brandPrimary} size="small" />
                      ) : (
                        <Ionicons
                          name={it.status === "missed" ? "alert-circle" : "ellipse-outline"}
                          size={26}
                          color={it.status === "missed" ? colors.error : colors.borderStrong}
                        />
                      )}
                    </Pressable>
                  )}
                </Card>
              ))
            )}
          </>
        )}
      </ScrollView>
      <SosFab bottom={insets.bottom + 76} />
    </View>
  );
}

function StatRow({ icon, color, label, value }: any) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={{ color: colors.onSurfaceSecondary, flex: 1 }}>{label}</Text>
      <Text style={{ fontWeight: "800", color: colors.onSurface, fontSize: 16 }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  greeting: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  role: { fontSize: 13, color: colors.brandPrimary, fontWeight: "600", marginTop: 2 },
  bell: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 10, right: 12, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.error },
  hero: { backgroundColor: colors.brand, borderColor: colors.brand },
  heroLabel: { color: "#9DC3E6", fontSize: 12, fontWeight: "800", letterSpacing: 1 },
  heroTime: { color: "#fff", fontSize: 44, fontWeight: "900", marginTop: 4 },
  heroMedRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  heroMed: { color: "#E6F0F9", fontSize: font.lg, fontWeight: "600" },
  heroDone: { color: "#C7D6E5", marginTop: 6 },
  pill: { width: 8, height: 28, borderRadius: 4 },
  medRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.md, paddingVertical: spacing.md },
  medTime: { fontSize: 15, fontWeight: "800", color: colors.brand, width: 48 },
  medName: { fontSize: font.lg, fontWeight: "700", color: colors.onSurface },
  medDose: { fontSize: 13, color: colors.onSurfaceTertiary, marginTop: 2 },
  checkBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  emptyT: { color: colors.onSurfaceSecondary, fontWeight: "600", marginTop: spacing.sm },
  quickRow: { flexDirection: "row", gap: spacing.md, marginTop: spacing.lg },
  quickCard: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", paddingVertical: spacing.lg, gap: 6 },
  quickText: { fontSize: 12, fontWeight: "700", color: colors.onSurfaceSecondary },
});
