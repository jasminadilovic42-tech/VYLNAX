import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { Card } from "@/src/components/ui";
import { useApp } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import { colors, radius, spacing } from "@/src/theme";

type MeasureStatus = "suggested" | "active" | "rejected";
type MeasureSource = "ai" | "caregiver";

type PatientMeasure = {
  id: string;
  patient_id: string;
  topic: string;
  title: string;
  description: string;
  rationale?: string | null;
  frequency?: string | null;
  responsible?: string | null;
  evaluation_date?: string | null;
  source: MeasureSource;
  status: MeasureStatus;
  approved_by_name?: string | null;
  approved_at?: string | null;
  rejected_by_name?: string | null;
  rejected_at?: string | null;
};

type Draft = {
  topic: string;
  title: string;
  description: string;
  rationale: string;
  frequency: string;
  responsible: string;
  evaluation_date: string;
};

const EMPTY_DRAFT: Draft = {
  topic: "",
  title: "",
  description: "",
  rationale: "",
  frequency: "",
  responsible: "Pflegefachkraft",
  evaluation_date: "",
};

function normalizeRole(role?: string | null) {
  return String(role || "").trim().toLowerCase();
}

function MeasureCard({
  item,
  canEdit,
  onApprove,
  onEdit,
  onReject,
}: {
  item: PatientMeasure;
  canEdit: boolean;
  onApprove: (item: PatientMeasure) => void;
  onEdit: (item: PatientMeasure) => void;
  onReject: (item: PatientMeasure) => void;
}) {
  return (
    <Card style={styles.card}>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.topic}>{item.topic || "Allgemein"}</Text>
          <Text style={styles.title}>{item.title}</Text>
        </View>

        <View
          style={[
            styles.badge,
            item.status === "active"
              ? styles.badgeActive
              : item.status === "rejected"
              ? styles.badgeRejected
              : styles.badgeSuggested,
          ]}
        >
          <Text style={styles.badgeText}>
            {item.status === "active"
              ? "Aktiv"
              : item.status === "rejected"
              ? "Abgelehnt"
              : "KI-Vorschlag"}
          </Text>
        </View>
      </View>

      <Text style={styles.description}>{item.description}</Text>

      {item.rationale ? (
        <View style={styles.infoBox}>
          <Text style={styles.infoLabel}>Bezug zur SIS</Text>
          <Text style={styles.infoText}>{item.rationale}</Text>
        </View>
      ) : null}

      <Text style={styles.meta}>
        Quelle: {item.source === "ai" ? "KI" : "PFK"} · Häufigkeit:{" "}
        {item.frequency || "nicht festgelegt"}
      </Text>

      <Text style={styles.meta}>
        Verantwortlich: {item.responsible || "nicht festgelegt"} · Evaluation:{" "}
        {item.evaluation_date || "nicht festgelegt"}
      </Text>

      {canEdit && item.status === "suggested" ? (
        <View style={styles.actionRow}>
          <Pressable style={styles.approve} onPress={() => onApprove(item)}>
            <Text style={styles.approveText}>Annehmen</Text>
          </Pressable>

          <Pressable style={styles.edit} onPress={() => onEdit(item)}>
            <Text style={styles.editText}>Bearbeiten</Text>
          </Pressable>

          <Pressable style={styles.reject} onPress={() => onReject(item)}>
            <Text style={styles.rejectText}>Ablehnen</Text>
          </Pressable>
        </View>
      ) : null}

      {canEdit && item.status === "active" ? (
        <Pressable style={styles.fullEdit} onPress={() => onEdit(item)}>
          <Ionicons name="create-outline" size={18} color={colors.brandPrimary} />
          <Text style={styles.fullEditText}>Maßnahme bearbeiten</Text>
        </Pressable>
      ) : null}
    </Card>
  );
}

export default function PatientMeasuresScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { activePatient } = useApp();
  const { accessUser, user } = useAuth();

  const role = normalizeRole(accessUser?.role || user?.role);
  const canEdit =
    role === "caregiver" || role === "doctor" || role === "admin";

  const patientId = activePatient?.id;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [measures, setMeasures] = useState<PatientMeasure[]>([]);

  const [modalVisible, setModalVisible] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingSource, setEditingSource] =
    useState<MeasureSource>("caregiver");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);

  const suggested = useMemo(
    () => measures.filter((item) => item.status === "suggested"),
    [measures]
  );
  const active = useMemo(
    () => measures.filter((item) => item.status === "active"),
    [measures]
  );

  const loadMeasures = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const list = await api<PatientMeasure[]>(
        `/patients/${patientId}/measures`
      );
      setMeasures(Array.isArray(list) ? list : []);
    } catch (error) {
      console.warn("Maßnahmen konnten nicht geladen werden:", error);
      setMeasures([]);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadMeasures();
  }, [loadMeasures]);

  const openNew = () => {
    setEditingId(null);
    setEditingSource("caregiver");
    setDraft(EMPTY_DRAFT);
    setModalVisible(true);
  };

  const openEdit = (item: PatientMeasure) => {
    setEditingId(item.id);
    setEditingSource(item.source);
    setDraft({
      topic: item.topic || "",
      title: item.title || "",
      description: item.description || "",
      rationale: item.rationale || "",
      frequency: item.frequency || "",
      responsible: item.responsible || "Pflegefachkraft",
      evaluation_date: item.evaluation_date || "",
    });
    setModalVisible(true);
  };

  const save = async () => {
    if (!patientId) return;

    if (!draft.title.trim() || !draft.description.trim()) {
      Alert.alert("Fehlende Angaben", "Bitte Titel und Maßnahme ausfüllen.");
      return;
    }

    setSaving(true);

    try {
      const body = {
        topic: draft.topic.trim(),
        title: draft.title.trim(),
        description: draft.description.trim(),
        rationale: draft.rationale.trim(),
        frequency: draft.frequency.trim(),
        responsible: draft.responsible.trim(),
        evaluation_date: draft.evaluation_date.trim(),
        source: editingSource,
        status: "active",
      };

      if (editingId) {
        await api(`/patients/${patientId}/measures/${editingId}`, {
          method: "PUT",
          access: true,
          body,
        });
      } else {
        await api(`/patients/${patientId}/measures`, {
          method: "POST",
          access: true,
          body,
        });
      }

      setModalVisible(false);
      setDraft(EMPTY_DRAFT);
      setEditingId(null);
      await loadMeasures();
    } catch (error: any) {
      Alert.alert(
        "Speichern fehlgeschlagen",
        error?.message || "Maßnahme konnte nicht gespeichert werden."
      );
    } finally {
      setSaving(false);
    }
  };

  const approve = async (item: PatientMeasure) => {
    if (!patientId) return;

    await api(`/patients/${patientId}/measures/${item.id}`, {
      method: "PUT",
      access: true,
      body: { status: "active" },
    });

    await loadMeasures();
  };

  const reject = async (item: PatientMeasure) => {
    if (!patientId) return;

    await api(`/patients/${patientId}/measures/${item.id}`, {
      method: "PUT",
      access: true,
      body: { status: "rejected" },
    });

    await loadMeasures();
  };

  const generateAi = async () => {
    if (!patientId) return;

    setGenerating(true);

    try {
      await api(`/patients/${patientId}/measures/ai-suggest`, {
        method: "POST",
        access: true,
        body: {},
      });

      await loadMeasures();
    } catch (error: any) {
      Alert.alert(
        "KI-Vorschläge nicht verfügbar",
        error?.message || "Die KI konnte keine Maßnahmen erstellen."
      );
    } finally {
      setGenerating(false);
    }
  };

  if (!activePatient) {
    return (
      <View style={styles.center}>
        <Text style={styles.centerTitle}>Kein Patient ausgewählt</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Zurück</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable onPress={() => router.back()} style={styles.headerButton}>
          <Ionicons name="arrow-back" size={25} color={colors.onSurface} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Maßnahmenplan</Text>
          <Text style={styles.headerSubtitle}>{activePatient.name}</Text>
        </View>

        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.brandPrimary} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + spacing.xl * 2 },
          ]}
        >
          <Card style={styles.hero}>
            <Text style={styles.heroLabel}>PFLEGEPLANUNG</Text>
            <Text style={styles.heroName}>{activePatient.name}</Text>
            <Text style={styles.heroText}>
              {active.length} aktive Maßnahmen · {suggested.length} KI-Vorschläge
            </Text>
          </Card>

          {canEdit ? (
            <>
              <Pressable style={styles.aiButton} onPress={generateAi}>
                {generating ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Ionicons name="sparkles" size={23} color="#FFFFFF" />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.aiTitle}>KI-Maßnahmen vorschlagen</Text>
                  <Text style={styles.aiText}>
                    Vorschläge aus SIS und dokumentierten Patientendaten.
                  </Text>
                </View>
              </Pressable>

              <Pressable style={styles.manualButton} onPress={openNew}>
                <Ionicons
                  name="add-circle-outline"
                  size={23}
                  color={colors.brandPrimary}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.manualTitle}>Maßnahme selbst anlegen</Text>
                  <Text style={styles.manualText}>
                    PFK dokumentiert und aktiviert eine eigene Maßnahme.
                  </Text>
                </View>
              </Pressable>
            </>
          ) : null}

          <Text style={styles.sectionTitle}>KI-Vorschläge</Text>
          {suggested.length ? (
            suggested.map((item) => (
              <MeasureCard
                key={item.id}
                item={item}
                canEdit={canEdit}
                onApprove={approve}
                onEdit={openEdit}
                onReject={reject}
              />
            ))
          ) : (
            <Card>
              <Text style={styles.empty}>Noch keine KI-Vorschläge.</Text>
            </Card>
          )}

          <Text style={styles.sectionTitle}>Aktive Maßnahmen</Text>
          {active.length ? (
            active.map((item) => (
              <MeasureCard
                key={item.id}
                item={item}
                canEdit={canEdit}
                onApprove={approve}
                onEdit={openEdit}
                onReject={reject}
              />
            ))
          ) : (
            <Card>
              <Text style={styles.empty}>Noch keine aktiven Maßnahmen.</Text>
            </Card>
          )}
        </ScrollView>
      )}

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modal, { paddingBottom: insets.bottom + spacing.md }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingId ? "Maßnahme bearbeiten" : "Neue Maßnahme"}
              </Text>
              <Pressable onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={26} color={colors.onSurface} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={styles.modalContent}>
              {[
                ["Themenfeld", "topic"],
                ["Titel", "title"],
                ["Maßnahme", "description"],
                ["Bezug zur SIS / Begründung", "rationale"],
                ["Zeitpunkt / Häufigkeit", "frequency"],
                ["Verantwortlich", "responsible"],
                ["Evaluation am", "evaluation_date"],
              ].map(([label, key]) => (
                <View key={key}>
                  <Text style={styles.inputLabel}>{label}</Text>
                  <TextInput
                    value={String(draft[key as keyof Draft] || "")}
                    onChangeText={(value) =>
                      setDraft((current) => ({ ...current, [key]: value }))
                    }
                    multiline={key === "description" || key === "rationale"}
                    textAlignVertical="top"
                    style={[
                      styles.input,
                      (key === "description" || key === "rationale") &&
                        styles.textArea,
                    ]}
                  />
                </View>
              ))}

              <Pressable style={styles.saveButton} onPress={save} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>Speichern & freigeben</Text>
                )}
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: { width: 46, height: 46, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 21, fontWeight: "800", color: colors.onSurface },
  headerSubtitle: { marginTop: 2, fontSize: 13, color: colors.onSurfaceSecondary },
  content: { padding: spacing.lg, gap: spacing.md },
  hero: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  heroLabel: { color: "#DCEBFF", fontSize: 11, fontWeight: "800" },
  heroName: { marginTop: 3, color: "#FFFFFF", fontSize: 22, fontWeight: "800" },
  heroText: { marginTop: 4, color: "#EAF4FF", fontSize: 12 },
  aiButton: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.brandPrimary,
  },
  aiTitle: { color: "#FFFFFF", fontSize: 16, fontWeight: "800" },
  aiText: { marginTop: 3, color: "#EAF4FF", fontSize: 12 },
  manualButton: {
    minHeight: 76,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  manualTitle: { fontSize: 16, fontWeight: "800", color: colors.onSurface },
  manualText: { marginTop: 3, fontSize: 12, color: colors.onSurfaceSecondary },
  sectionTitle: { marginTop: spacing.sm, fontSize: 18, fontWeight: "800", color: colors.onSurface },
  card: { gap: spacing.sm },
  row: { flexDirection: "row", alignItems: "flex-start", gap: spacing.sm },
  topic: { fontSize: 11, fontWeight: "800", color: colors.brandPrimary, textTransform: "uppercase" },
  title: { marginTop: 4, fontSize: 17, fontWeight: "800", color: colors.onSurface },
  description: { fontSize: 14, lineHeight: 21, color: colors.onSurface },
  badge: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 14 },
  badgeSuggested: { backgroundColor: "#FFF3D6" },
  badgeActive: { backgroundColor: "#DCFCE7" },
  badgeRejected: { backgroundColor: "#FEE4E2" },
  badgeText: { fontSize: 10, fontWeight: "800", color: colors.onSurface },
  infoBox: { padding: spacing.sm, borderRadius: radius.md, backgroundColor: colors.surfaceSecondary },
  infoLabel: { fontSize: 10, fontWeight: "800", color: colors.onSurfaceTertiary },
  infoText: { marginTop: 4, fontSize: 12, lineHeight: 17, color: colors.onSurfaceSecondary },
  meta: { fontSize: 11, color: colors.onSurfaceTertiary },
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  approve: { padding: 10, borderRadius: radius.md, backgroundColor: colors.brandPrimary },
  approveText: { color: "#FFFFFF", fontWeight: "800" },
  edit: { padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: colors.brandPrimary },
  editText: { color: colors.brandPrimary, fontWeight: "800" },
  reject: { padding: 10, borderRadius: radius.md, borderWidth: 1, borderColor: "#FDA29B" },
  rejectText: { color: "#B42318", fontWeight: "800" },
  fullEdit: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    borderRadius: radius.md,
  },
  fullEditText: { color: colors.brandPrimary, fontWeight: "800" },
  empty: { textAlign: "center", color: colors.onSurfaceSecondary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl },
  centerTitle: { fontSize: 22, fontWeight: "800", color: colors.onSurface },
  backButton: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.brandPrimary },
  backButtonText: { color: "#FFFFFF", fontWeight: "800" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.3)" },
  modal: { maxHeight: "92%", backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.border },
  modalTitle: { fontSize: 20, fontWeight: "800", color: colors.onSurface },
  modalContent: { padding: spacing.lg, gap: spacing.sm },
  inputLabel: { marginTop: 5, fontSize: 12, fontWeight: "800", color: colors.onSurface },
  input: { minHeight: 50, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, backgroundColor: colors.surfaceSecondary, color: colors.onSurface },
  textArea: { minHeight: 100 },
  saveButton: { minHeight: 56, marginTop: spacing.md, alignItems: "center", justifyContent: "center", borderRadius: radius.md, backgroundColor: colors.brandPrimary },
  saveText: { color: "#FFFFFF", fontSize: 15, fontWeight: "800" },
});