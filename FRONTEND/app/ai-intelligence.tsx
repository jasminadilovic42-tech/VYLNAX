import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { colors, spacing, radius } from "@/src/theme";

type RiskLevel = "niedrig" | "mittel" | "hoch";

type IntelligenceReport = {
  days: number;
  adherence: number;
  taken: number;
  missed: number;
  risk_score: number;
  risk_level: RiskLevel;
  reasons: string[];
  recommendations: string[];
  daily: Array<{
    date: string;
    scheduled: number;
    taken: number;
    missed: number;
    adherence: number;
  }>;
  vitals_count: number;
  vital_alerts: number;
  journal_count: number;
  narrative: string;
  disclaimer: string;
};

const levelLabel: Record<RiskLevel, string> = {
  niedrig: "Niedrig",
  mittel: "Aufmerksamkeit",
  hoch: "Erhöht",
};

const levelIcon: Record<RiskLevel, keyof typeof Ionicons.glyphMap> = {
  niedrig: "shield-checkmark",
  mittel: "alert-circle",
  hoch: "warning",
};

export default function AIHealthIntelligence() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePatient } = useApp();

  const [report, setReport] = useState<IntelligenceReport | null>(null);
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (silent = false) => {
      if (!activePatient) {
        setReport(null);
        setLoading(false);
        return;
      }

      if (!silent) setLoading(true);
      setError("");

      try {
        const result = await api<IntelligenceReport>(
          `/patients/${activePatient.id}/weekly-intelligence?days=${days}`
        );
        setReport(result);
      } catch {
        setError("Die AI-Auswertung konnte nicht geladen werden.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activePatient, days]
  );

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const healthScore = report
    ? Math.max(0, Math.min(100, 100 - report.risk_score))
    : 0;

  const statusText = useMemo(() => {
    if (!report) return "";
    if (report.risk_level === "hoch") {
      return "Mehrere Auffälligkeiten benötigen fachliche Aufmerksamkeit.";
    }
    if (report.risk_level === "mittel") {
      return "Einige Muster sollten weiter beobachtet werden.";
    }
    return "Aktuell wurden keine deutlichen Risikosignale erkannt.";
  }, [report]);

  const today = report?.daily?.[report.daily.length - 1];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={colors.onSurface} />
        </Pressable>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.title}>AI Health Intelligence</Text>
          <Text style={styles.subtitle}>
            {activePatient?.name || "Kein Patient ausgewählt"}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            setRefreshing(true);
            void load(true);
          }}
          style={styles.refreshButton}
        >
          <Ionicons name="refresh" size={20} color={colors.brandPrimary} />
        </Pressable>
      </View>

      <View style={styles.periodBar}>
        {([7, 14, 30] as const).map((value) => (
          <Pressable
            key={value}
            onPress={() => setDays(value)}
            style={[
              styles.periodButton,
              days === value && styles.periodButtonActive,
            ]}
          >
            <Text
              style={[
                styles.periodText,
                days === value && styles.periodTextActive,
              ]}
            >
              {value} Tage
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
          <Text style={styles.loadingText}>AI analysiert Patientendaten…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={42} color={colors.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => void load()} style={styles.retryButton}>
            <Text style={styles.retryText}>Erneut versuchen</Text>
          </Pressable>
        </View>
      ) : !activePatient || !report ? (
        <View style={styles.center}>
          <Ionicons
            name="person-circle-outline"
            size={50}
            color={colors.onSurfaceTertiary}
          />
          <Text style={styles.emptyText}>
            Bitte zuerst einen Patienten auswählen.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load(true);
              }}
            />
          }
        >
          <View style={styles.heroCard}>
            <View style={styles.scoreCircle}>
              <Text style={styles.scoreValue}>{healthScore}</Text>
              <Text style={styles.scoreMax}>/100</Text>
            </View>

            <View style={styles.heroContent}>
              <View style={styles.statusRow}>
                <Ionicons
                  name={levelIcon[report.risk_level]}
                  size={20}
                  color={colors.brandPrimary}
                />
                <Text style={styles.statusTitle}>
                  Unterstützungsrisiko: {levelLabel[report.risk_level]}
                </Text>
              </View>
              <Text style={styles.statusText}>{statusText}</Text>
              <Text style={styles.generatedText}>
                Analysezeitraum: letzte {report.days} Tage
              </Text>
            </View>
          </View>

          <View style={styles.metricsGrid}>
            <MetricCard
              icon="checkmark-circle"
              label="Einnahmequote"
              value={`${report.adherence} %`}
              helper={`${report.taken} bestätigt`}
            />
            <MetricCard
              icon="close-circle"
              label="Versäumt"
              value={`${report.missed}`}
              helper="bewertbare Einnahmen"
            />
            <MetricCard
              icon="pulse"
              label="Vitalwerte"
              value={`${report.vitals_count}`}
              helper={`${report.vital_alerts} auffällig`}
            />
            <MetricCard
              icon="document-text"
              label="Tagebuch"
              value={`${report.journal_count}`}
              helper="Einträge im Zeitraum"
            />
          </View>

          <SectionCard
            icon="sparkles"
            title="AI hat erkannt"
            items={report.reasons}
            emptyText="Keine deutlichen Muster erkannt."
          />

          <SectionCard
            icon="bulb"
            title="Empfohlene Aufmerksamkeit"
            items={report.recommendations}
            emptyText="Aktuellen Plan fortführen."
          />

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons
                name="calendar"
                size={19}
                color={colors.brandPrimary}
              />
              <Text style={styles.cardTitle}>Heutiger Fortschritt</Text>
            </View>

            <ProgressRow
              label="Geplante Einnahmen"
              value={today?.scheduled ?? 0}
            />
            <ProgressRow
              label="Bestätigt"
              value={today?.taken ?? 0}
            />
            <ProgressRow
              label="Versäumt"
              value={today?.missed ?? 0}
            />
            <ProgressRow
              label="Tagesquote"
              value={`${today?.adherence ?? 0} %`}
            />
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons
                name="help-circle"
                size={19}
                color={colors.brandPrimary}
              />
              <Text style={styles.cardTitle}>Warum dieser Score?</Text>
            </View>

            <View style={styles.scoreExplainRow}>
              <Text style={styles.scoreExplainLabel}>Einnahmequote</Text>
              <Text style={styles.scoreExplainValue}>{report.adherence} %</Text>
            </View>
            <View style={styles.scoreExplainRow}>
              <Text style={styles.scoreExplainLabel}>Versäumte Einnahmen</Text>
              <Text style={styles.scoreExplainValue}>{report.missed}</Text>
            </View>
            <View style={styles.scoreExplainRow}>
              <Text style={styles.scoreExplainLabel}>Vitalwarnungen</Text>
              <Text style={styles.scoreExplainValue}>{report.vital_alerts}</Text>
            </View>
            <View style={styles.scoreExplainRow}>
              <Text style={styles.scoreExplainLabel}>Tagebucheinträge</Text>
              <Text style={styles.scoreExplainValue}>{report.journal_count}</Text>
            </View>

            <Text style={styles.scoreExplainHint}>
              Der Health Score wird aus dem vom Backend berechneten Risikowert
              abgeleitet: 100 bedeutet geringe Auffälligkeit, 0 bedeutet hohe
              Auffälligkeit.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.cardTitleRow}>
              <Ionicons
                name="analytics"
                size={19}
                color={colors.brandPrimary}
              />
              <Text style={styles.cardTitle}>Zusammenfassung</Text>
            </View>
            <Text style={styles.narrative}>{report.narrative}</Text>
          </View>

          <View style={styles.disclaimerCard}>
            <Ionicons
              name="information-circle"
              size={18}
              color={colors.onSurfaceTertiary}
            />
            <Text style={styles.disclaimerText}>{report.disclaimer}</Text>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function MetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={21} color={colors.brandPrimary} />
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricHelper}>{helper}</Text>
    </View>
  );
}

function SectionCard({
  icon,
  title,
  items,
  emptyText,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  items: string[];
  emptyText: string;
}) {
  const safeItems = items?.length ? items : [emptyText];

  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <Ionicons name={icon} size={19} color={colors.brandPrimary} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>

      {safeItems.map((item, index) => (
        <View key={`${item}-${index}`} style={styles.insightRow}>
          <View style={styles.dot} />
          <Text style={styles.insightText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function ProgressRow({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <View style={styles.progressRow}>
      <Text style={styles.progressLabel}>{label}</Text>
      <Text style={styles.progressValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleWrap: {
    flex: 1,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.onSurface,
  },
  subtitle: {
    fontSize: 12,
    color: colors.onSurfaceTertiary,
    marginTop: 2,
  },
  periodBar: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  periodButton: {
    flex: 1,
    minHeight: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSecondary,
  },
  periodButtonActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  periodText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  periodTextActive: {
    color: "#fff",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.onSurfaceSecondary,
  },
  errorText: {
    marginTop: spacing.md,
    color: colors.error,
    textAlign: "center",
  },
  emptyText: {
    marginTop: spacing.md,
    color: colors.onSurfaceTertiary,
    textAlign: "center",
  },
  retryButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  retryText: {
    color: "#fff",
    fontWeight: "800",
  },
  content: {
    padding: spacing.lg,
    paddingBottom: 60,
    gap: spacing.md,
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  scoreCircle: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 8,
    borderColor: colors.brandPrimary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  scoreValue: {
    fontSize: 27,
    fontWeight: "900",
    color: colors.onSurface,
  },
  scoreMax: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceTertiary,
    marginTop: 9,
  },
  heroContent: {
    flex: 1,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  statusTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "800",
    color: colors.onSurface,
  },
  statusText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurfaceSecondary,
    marginTop: spacing.xs,
  },
  generatedText: {
    fontSize: 10,
    color: colors.onSurfaceTertiary,
    marginTop: spacing.sm,
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  metricCard: {
    width: "48.5%",
    minHeight: 138,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  metricLabel: {
    marginTop: spacing.sm,
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    color: colors.onSurfaceTertiary,
  },
  metricValue: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "900",
    color: colors.onSurface,
  },
  metricHelper: {
    marginTop: 3,
    fontSize: 11,
    color: colors.onSurfaceSecondary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.onSurface,
  },
  insightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    paddingVertical: 7,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.brandPrimary,
    marginTop: 6,
  },
  insightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurfaceSecondary,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  progressLabel: {
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  progressValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  narrative: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.onSurfaceSecondary,
  },
  scoreExplainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  scoreExplainLabel: {
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },
  scoreExplainValue: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },
  scoreExplainHint: {
    marginTop: spacing.sm,
    fontSize: 10,
    lineHeight: 15,
    color: colors.onSurfaceTertiary,
  },
  disclaimerCard: {
    flexDirection: "row",
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  disclaimerText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 15,
    color: colors.onSurfaceTertiary,
  },
});