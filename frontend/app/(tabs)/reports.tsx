import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BarChart } from "react-native-gifted-charts";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { colors, spacing, radius, font } from "@/src/theme";
import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { Card, Ring } from "@/src/components/ui";
import { PatientSwitcher } from "@/src/components/shared";

const PERIODS = [
  { key: "day", label: "Tag" },
  { key: "week", label: "Woche" },
  { key: "month", label: "Monat" },
];

export default function Reports() {
  const { activePatient } = useApp();
  const insets = useSafeAreaInsets();
  const [period, setPeriod] = useState("week");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    if (!activePatient) { setData(null); setLoading(false); return; }
    try {
      const res = await api(`/patients/${activePatient.id}/reports?period=${period}`);
      setData(res);
    } catch {} finally { setLoading(false); }
  }, [activePatient, period]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));

  const barData = (data?.daily || []).map((d: any) => ({
    value: d.rate,
    label: d.label,
    frontColor: d.rate >= 80 ? colors.success : d.rate >= 50 ? colors.warning : colors.error,
  }));

  const exportPdf = async () => {
    if (!data || !activePatient) return;
    setExporting(true);
    try {
      const rows = data.daily
        .map((d: any) => `<tr><td>${d.label} (${d.date})</td><td style="text-align:center">${d.taken}/${d.total}</td><td style="text-align:right;color:${d.rate>=80?'#059669':'#D97706'}">${d.rate}%</td></tr>`)
        .join("");
      const html = `
        <html><head><meta charset="utf-8"><style>
        body{font-family:-apple-system,Arial;padding:32px;color:#111827}
        h1{color:#0B3A64}.sub{color:#6B7280}
        .kpi{display:flex;gap:16px;margin:24px 0}
        .box{flex:1;border:1px solid #E5E7EB;border-radius:12px;padding:16px;text-align:center}
        .val{font-size:32px;font-weight:800;color:#1A65A9}
        table{width:100%;border-collapse:collapse;margin-top:16px}
        td,th{padding:10px;border-bottom:1px solid #EEF2F6}
        </style></head><body>
        <h1>VYLNAX PRO — Einnahmebericht</h1>
        <p class="sub">Patient: ${activePatient.name} · Zeitraum: ${period === 'day'?'Heute':period==='week'?'Letzte 7 Tage':'Letzter Monat'}</p>
        <div class="kpi">
          <div class="box"><div class="val">${data.adherence}%</div>Einnahmequote</div>
          <div class="box"><div class="val" style="color:#059669">${data.taken}</div>Bestätigt</div>
          <div class="box"><div class="val" style="color:#DC2626">${data.missed}</div>Vergessen</div>
        </div>
        <table><tr><th style="text-align:left">Tag</th><th>Eingenommen</th><th style="text-align:right">Quote</th></tr>${rows}</table>
        <p class="sub" style="margin-top:32px">Erstellt mit VYLNAX PRO — Intelligent. Sicher. Menschlich.</p>
        </body></html>`;
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
    } catch {} finally { setExporting(false); }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Berichte</Text>
        <PatientSwitcher />
        <View style={styles.periodRow}>
          {PERIODS.map((p) => (
            <Pressable key={p.key} testID={`period-${p.key}`} onPress={() => setPeriod(p.key)} style={[styles.periodChip, period === p.key && styles.periodActive]}>
              <Text style={[styles.periodText, period === p.key && { color: "#fff" }]}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} style={{ marginTop: 60 }} />
        ) : !data ? (
          <Text style={styles.emptyT}>Keine Daten</Text>
        ) : (
          <>
            <Card style={{ alignItems: "center" }}>
              <Text style={styles.cardTitle}>Einnahmequote</Text>
              <Ring percent={data.adherence} size={150} color={data.adherence >= 80 ? colors.success : colors.warning} sublabel={data.adherence >= 80 ? "Sehr gut" : "Verbesserbar"} />
              <View style={styles.kpiRow}>
                <Kpi value={data.taken} label="Bestätigt" color={colors.success} />
                <Kpi value={data.missed} label="Vergessen" color={colors.error} />
                <Kpi value={data.pending} label="Offen" color={colors.warning} />
              </View>
            </Card>

            <Card style={{ marginTop: spacing.lg }}>
              <Text style={styles.cardTitle}>Einnahmen im Überblick</Text>
              {barData.length > 0 && (
                <View style={{ marginTop: spacing.md }}>
                  <BarChart
                    data={barData}
                    barWidth={period === "month" ? 8 : 22}
                    spacing={period === "month" ? 4 : 14}
                    roundedTop
                    hideRules={false}
                    rulesColor={colors.divider}
                    yAxisThickness={0}
                    xAxisThickness={0}
                    maxValue={100}
                    noOfSections={4}
                    yAxisTextStyle={{ color: colors.onSurfaceTertiary, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: colors.onSurfaceTertiary, fontSize: 10 }}
                    height={160}
                    isAnimated
                  />
                </View>
              )}
            </Card>

            <Pressable testID="export-pdf" onPress={exportPdf} disabled={exporting} style={styles.exportBtn}>
              {exporting ? <ActivityIndicator color={colors.brandPrimary} /> : <><Ionicons name="document-text-outline" size={20} color={colors.brandPrimary} /><Text style={styles.exportText}>Bericht als PDF exportieren</Text></>}
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Kpi({ value, label, color }: any) {
  return (
    <View style={{ alignItems: "center", flex: 1 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", color }}>{value}</Text>
      <Text style={{ fontSize: 12, color: colors.onSurfaceTertiary }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: { backgroundColor: colors.surface, paddingBottom: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 22, fontWeight: "800", color: colors.onSurface, paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  periodRow: { flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.lg },
  periodChip: { flex: 1, height: 40, borderRadius: radius.md, backgroundColor: colors.surfaceTertiary, alignItems: "center", justifyContent: "center" },
  periodActive: { backgroundColor: colors.brandPrimary },
  periodText: { fontWeight: "700", color: colors.onSurfaceSecondary },
  cardTitle: { fontSize: font.lg, fontWeight: "800", color: colors.onSurface, alignSelf: "flex-start" },
  kpiRow: { flexDirection: "row", marginTop: spacing.lg, width: "100%" },
  exportBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: spacing.lg, minHeight: 52, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.brandPrimary },
  exportText: { color: colors.brandPrimary, fontWeight: "700", fontSize: font.lg },
  emptyT: { color: colors.onSurfaceSecondary, textAlign: "center", marginTop: 60 },
});
