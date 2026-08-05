import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable, RefreshControl } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, spacing, radius, font } from "@/src/theme";
import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { Card, Ring } from "@/src/components/ui";

const RISK = {
  high: { c: colors.error, bg: "#FDECEC", label: "Hoch" },
  medium: { c: colors.warning, bg: "#FDF3E6", label: "Mittel" },
  low: { c: colors.info, bg: "#E6F2FB", label: "Gering" },
} as const;

const TYPE_ICON: Record<string, any> = {
  missed: "time", interaction: "swap-horizontal", allergy: "warning", double: "copy", schedule: "calendar",
};

export default function Safety() {
  const { activePatient } = useApp();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activePatient) { setLoading(false); return; }
    try {
      const res = await api(`/patients/${activePatient.id}/safety`);
      setData(res);
    } catch {} finally { setLoading(false); }
  }, [activePatient]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const scoreColor = data ? (data.score >= 85 ? colors.success : data.score >= 70 ? colors.info : data.score >= 50 ? colors.warning : colors.error) : colors.brandPrimary;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable testID="safety-back" onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={colors.onSurface} />
        </Pressable>
        <Text style={styles.title}>Sicherheits-Analyse</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}>
        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 60 }} />
        ) : !data ? (
          <Text style={styles.empty}>Kein Patient ausgewählt.</Text>
        ) : (
          <>
            <Card style={{ alignItems: "center" }}>
              <Text style={styles.cardLabel}>SICHERHEITS-SCORE</Text>
              <Ring percent={data.score} size={160} color={scoreColor} sublabel={data.grade} />
              <View style={styles.miniRow}>
                <Mini label="Einnahmequote" value={`${data.adherence}%`} />
                <Mini label="Vergessen (7T)" value={data.missed} />
                <Mini label="Medikamente" value={data.med_count} />
              </View>
            </Card>

            <Text style={styles.section}>Erkannte Risiken ({data.issues.length})</Text>
            {data.issues.length === 0 ? (
              <Card style={{ alignItems: "center", paddingVertical: spacing.xl }}>
                <Ionicons name="shield-checkmark" size={40} color={colors.success} />
                <Text style={styles.okText}>Keine Auffälligkeiten erkannt.</Text>
              </Card>
            ) : (
              data.issues.map((it: any, i: number) => {
                const r = (RISK as any)[it.risk] || RISK.low;
                return (
                  <Card key={i} style={[styles.issueCard, { borderLeftColor: r.c }]} testID={`issue-${it.type}-${i}`}>
                    <View style={styles.issueHead}>
                      <View style={[styles.issueIcon, { backgroundColor: r.bg }]}>
                        <Ionicons name={TYPE_ICON[it.type] || "alert-circle"} size={18} color={r.c} />
                      </View>
                      <Text style={styles.issueTitle}>{it.title}</Text>
                      <View style={[styles.riskPill, { backgroundColor: r.bg }]}>
                        <Text style={[styles.riskPillText, { color: r.c }]}>{r.label}</Text>
                      </View>
                    </View>
                    <Text style={styles.issueDetail}>{it.detail}</Text>
                  </Card>
                );
              })
            )}

            <View style={styles.disclaimer}>
              <Ionicons name="information-circle" size={16} color={colors.onSurfaceTertiary} />
              <Text style={styles.disclaimerText}>Diese KI-Analyse dient der Unterstützung und ersetzt keine ärztliche Beratung.</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Mini({ label, value }: any) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 18, fontWeight: "800", color: colors.onSurface }}>{value}</Text>
      <Text style={{ fontSize: 11, color: colors.onSurfaceTertiary, textAlign: "center" }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: colors.surface, paddingBottom: spacing.md, paddingHorizontal: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  cardLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: colors.onSurfaceTertiary },
  miniRow: { flexDirection: "row", marginTop: spacing.lg, width: "100%" },
  section: { fontSize: 18, fontWeight: "800", color: colors.onSurface, marginTop: spacing.xl, marginBottom: spacing.md },
  issueCard: { borderLeftWidth: 4, marginBottom: spacing.md },
  issueHead: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  issueIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  issueTitle: { flex: 1, fontSize: 15, fontWeight: "700", color: colors.onSurface },
  riskPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  riskPillText: { fontSize: 11, fontWeight: "800" },
  issueDetail: { fontSize: 13, color: colors.onSurfaceSecondary, marginTop: spacing.sm, lineHeight: 19 },
  okText: { color: colors.onSurfaceSecondary, fontWeight: "600", marginTop: spacing.sm },
  disclaimer: { flexDirection: "row", gap: 6, marginTop: spacing.lg, paddingHorizontal: spacing.xs },
  disclaimerText: { flex: 1, fontSize: 12, color: colors.onSurfaceTertiary, fontStyle: "italic", lineHeight: 17 },
  empty: { textAlign: "center", color: colors.onSurfaceSecondary, marginTop: 60 },
});
