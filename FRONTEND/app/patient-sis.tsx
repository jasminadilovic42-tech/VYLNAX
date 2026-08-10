import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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
import { colors, font, radius, spacing } from "@/src/theme";

type SisRiskMatrix = {
  fall: boolean;
  pressure_ulcer: boolean;
  pain: boolean;
  nutrition: boolean;
  incontinence: boolean;
  aspiration: boolean;
  dehydration: boolean;
  other: boolean;
};

type SisRecord = {
  id?: string;
  patient_id: string;

  current_concern: string;

  cognitive_communication: string;
  mobility: string;
  disease_related: string;
  self_care: string;
  social_relationships: string;
  living_environment: string;

  risks: SisRiskMatrix;
  risk_notes: string;

  resources: string;
  wishes: string;
  nursing_focus: string;

  status: "draft" | "completed";
  created_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const EMPTY_RISKS: SisRiskMatrix = {
  fall: false,
  pressure_ulcer: false,
  pain: false,
  nutrition: false,
  incontinence: false,
  aspiration: false,
  dehydration: false,
  other: false,
};

function normalizeRole(role?: string | null): string {
  return String(role || "").trim().toLowerCase();
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  minHeight = 130,
  editable = true,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  minHeight?: number;
  editable?: boolean;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceTertiary}
        multiline
        textAlignVertical="top"
        editable={editable}
        style={[
          styles.textArea,
          { minHeight },
          !editable && styles.textAreaDisabled,
        ]}
      />
    </View>
  );
}

function SectionTitle({
  number,
  title,
  subtitle,
}: {
  number?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={styles.sectionTitleRow}>
      {number ? (
        <View style={styles.sectionNumber}>
          <Text style={styles.sectionNumberText}>{number}</Text>
        </View>
      ) : null}

      <View style={styles.flexOne}>
        <Text style={styles.sectionTitle}>{title}</Text>

        {subtitle ? (
          <Text style={styles.sectionSubtitle}>
            {subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function RiskRow({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.riskRow}>
      <Text style={styles.riskLabel}>{label}</Text>

      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: colors.border,
          true: colors.brandSecondary,
        }}
        thumbColor={
          value
            ? colors.brandPrimary
            : colors.onSurfaceTertiary
        }
      />
    </View>
  );
}

export default function PatientSisScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { activePatient } = useApp();
  const { accessUser, user } = useAuth();

  const role = normalizeRole(
    accessUser?.role || user?.role
  );

  const canEdit =
    role === "caregiver" ||
    role === "doctor" ||
    role === "admin";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [currentConcern, setCurrentConcern] =
    useState("");

  const [
    cognitiveCommunication,
    setCognitiveCommunication,
  ] = useState("");

  const [mobility, setMobility] = useState("");
  const [diseaseRelated, setDiseaseRelated] =
    useState("");

  const [selfCare, setSelfCare] = useState("");
  const [
    socialRelationships,
    setSocialRelationships,
  ] = useState("");

  const [
    livingEnvironment,
    setLivingEnvironment,
  ] = useState("");

  const [risks, setRisks] =
    useState<SisRiskMatrix>(EMPTY_RISKS);

  const [riskNotes, setRiskNotes] = useState("");
  const [resources, setResources] = useState("");
  const [wishes, setWishes] = useState("");
  const [nursingFocus, setNursingFocus] =
    useState("");

  const [status, setStatus] =
    useState<"draft" | "completed">("draft");

  const [meta, setMeta] = useState<{
    created_by_name?: string | null;
    created_at?: string | null;
    updated_at?: string | null;
  }>({});

  const patientId = activePatient?.id;

  const loadSis = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const data = await api<SisRecord>(
        `/patients/${patientId}/sis`
      );

      setCurrentConcern(data?.current_concern || "");

      setCognitiveCommunication(
        data?.cognitive_communication || ""
      );

      setMobility(data?.mobility || "");
      setDiseaseRelated(
        data?.disease_related || ""
      );

      setSelfCare(data?.self_care || "");

      setSocialRelationships(
        data?.social_relationships || ""
      );

      setLivingEnvironment(
        data?.living_environment || ""
      );

      setRisks({
        ...EMPTY_RISKS,
        ...(data?.risks || {}),
      });

      setRiskNotes(data?.risk_notes || "");
      setResources(data?.resources || "");
      setWishes(data?.wishes || "");
      setNursingFocus(data?.nursing_focus || "");

      setStatus(
        data?.status === "completed"
          ? "completed"
          : "draft"
      );

      setMeta({
        created_by_name:
          data?.created_by_name || null,
        created_at: data?.created_at || null,
        updated_at: data?.updated_at || null,
      });
    } catch (error: any) {
      const message = String(
        error?.message || error || ""
      );

      if (
        !message.includes("404") &&
        !message
          .toLowerCase()
          .includes("not found")
      ) {
        console.warn(
          "SIS konnte nicht geladen werden:",
          error
        );
      }
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    void loadSis();
  }, [loadSis]);

  const updateRisk = (
    key: keyof SisRiskMatrix,
    value: boolean
  ) => {
    setRisks((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const activeRiskCount = useMemo(
    () =>
      Object.values(risks).filter(Boolean)
        .length,
    [risks]
  );

  const saveSis = async (
    nextStatus: "draft" | "completed"
  ) => {
    if (!patientId || !activePatient) {
      Alert.alert(
        "Kein Patient ausgewählt",
        "Bitte wählen Sie zuerst einen Patienten aus."
      );
      return;
    }

    if (!canEdit) {
      Alert.alert(
        "Keine Berechtigung",
        "Nur berechtigte Pflegekräfte, Ärzte oder Administratoren dürfen die SIS bearbeiten."
      );
      return;
    }

    setSaving(true);

    try {
      const body: SisRecord = {
        patient_id: patientId,
        current_concern: currentConcern.trim(),
        cognitive_communication:
          cognitiveCommunication.trim(),
        mobility: mobility.trim(),
        disease_related:
          diseaseRelated.trim(),
        self_care: selfCare.trim(),
        social_relationships:
          socialRelationships.trim(),
        living_environment:
          livingEnvironment.trim(),
        risks,
        risk_notes: riskNotes.trim(),
        resources: resources.trim(),
        wishes: wishes.trim(),
        nursing_focus:
          nursingFocus.trim(),
        status: nextStatus,
      };

      const saved = await api<SisRecord>(
        `/patients/${patientId}/sis`,
        {
          method: "PUT",
          access: true,
          body,
        }
      );

      setStatus(
        saved?.status === "completed"
          ? "completed"
          : nextStatus
      );

      setMeta({
        created_by_name:
          saved?.created_by_name ||
          meta.created_by_name ||
          accessUser?.name ||
          user?.name ||
          null,
        created_at:
          saved?.created_at ||
          meta.created_at ||
          null,
        updated_at:
          saved?.updated_at || null,
      });

      Alert.alert(
        nextStatus === "completed"
          ? "SIS abgeschlossen"
          : "SIS gespeichert",
        nextStatus === "completed"
          ? `Die SIS von ${activePatient.name} wurde als abgeschlossen gespeichert.`
          : `Die SIS von ${activePatient.name} wurde als Entwurf gespeichert.`
      );
    } catch (error: any) {
      Alert.alert(
        "SIS konnte nicht gespeichert werden",
        error?.message ||
          "Bitte versuchen Sie es erneut."
      );
    } finally {
      setSaving(false);
    }
  };

  if (!activePatient) {
    return (
      <View
        style={[
          styles.emptyContainer,
          {
            paddingTop:
              insets.top + spacing.xl,
            paddingBottom:
              insets.bottom + spacing.xl,
          },
        ]}
      >
        <Ionicons
          name="document-text-outline"
          size={60}
          color={colors.onSurfaceTertiary}
        />

        <Text style={styles.emptyTitle}>
          Kein Patient ausgewählt
        </Text>

        <Text style={styles.emptyText}>
          Öffnen Sie zuerst eine Patientenakte
          und wählen Sie den gewünschten
          Patienten aus.
        </Text>

        <Pressable
          onPress={() => router.back()}
          style={styles.backMain}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color="#FFFFFF"
          />

          <Text style={styles.backMainText}>
            Zurück
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <View
        style={[
          styles.header,
          {
            paddingTop:
              insets.top + spacing.sm,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons
            name="arrow-back"
            size={25}
            color={colors.onSurface}
          />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            SIS
          </Text>

          <Text
            style={styles.headerSubtitle}
            numberOfLines={1}
          >
            {activePatient.name}
          </Text>
        </View>

        <View style={styles.headerButton} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator
            size="large"
            color={colors.brandPrimary}
          />

          <Text style={styles.loadingText}>
            SIS wird geladen...
          </Text>
        </View>
      ) : (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.content,
            {
              paddingBottom:
                insets.bottom +
                spacing.xl * 2,
            },
          ]}
        >
          <Card style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons
                name="document-text-outline"
                size={28}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.flexOne}>
              <Text style={styles.heroEyebrow}>
                STRUKTURIERTE INFORMATIONSSAMMLUNG
              </Text>

              <Text style={styles.heroName}>
                {activePatient.name}
              </Text>

              <Text style={styles.heroStatus}>
                Status:{" "}
                {status === "completed"
                  ? "Abgeschlossen"
                  : "Entwurf"}
              </Text>
            </View>
          </Card>

          {!canEdit ? (
            <View style={styles.readOnlyBox}>
              <Ionicons
                name="lock-closed-outline"
                size={20}
                color={colors.onSurfaceSecondary}
              />

              <Text style={styles.readOnlyText}>
                Sie können die SIS lesen, aber
                nicht bearbeiten.
              </Text>
            </View>
          ) : null}

          <Card style={styles.card}>
            <SectionTitle
              title="Aktuelle Situation"
              subtitle="Ausgangspunkt der Informationssammlung"
            />

            <Field
              label="Was bewegt Sie im Augenblick? Was brauchen Sie? Was können wir für Sie tun?"
              value={currentConcern}
              onChangeText={setCurrentConcern}
              editable={canEdit}
              placeholder="Aussagen, Wünsche, aktuelle Anliegen und Unterstützungsbedarf dokumentieren..."
              minHeight={150}
            />
          </Card>

          <Card style={styles.card}>
            <SectionTitle
              number="1"
              title="Kognitive und kommunikative Fähigkeiten"
              subtitle="Orientierung, Verstehen, Kommunikation, Entscheidungen und Verhalten"
            />

            <Field
              label="Dokumentation"
              value={cognitiveCommunication}
              onChangeText={
                setCognitiveCommunication
              }
              editable={canEdit}
              placeholder="Ressourcen, Einschränkungen, Orientierung, Sprache, Kommunikation, Demenz, Verhalten..."
            />
          </Card>

          <Card style={styles.card}>
            <SectionTitle
              number="2"
              title="Mobilität und Beweglichkeit"
              subtitle="Bewegung, Positionswechsel, Transfers und Hilfsmittel"
            />

            <Field
              label="Dokumentation"
              value={mobility}
              onChangeText={setMobility}
              editable={canEdit}
              placeholder="Gehen, Stehen, Transfer, Rollator, Rollstuhl, Lagerung, Beweglichkeit..."
            />
          </Card>

          <Card style={styles.card}>
            <SectionTitle
              number="3"
              title="Krankheitsbezogene Anforderungen und Belastungen"
              subtitle="Gesundheitszustand, Behandlung und krankheitsbezogene Anforderungen"
            />

            <Field
              label="Dokumentation"
              value={diseaseRelated}
              onChangeText={setDiseaseRelated}
              editable={canEdit}
              placeholder="Diagnosen, Medikation, Schmerzen, Wunden, Diabetes, Atemprobleme, Arztanordnungen..."
            />
          </Card>

          <Card style={styles.card}>
            <SectionTitle
              number="4"
              title="Selbstversorgung"
              subtitle="Körperpflege, Ernährung, Ausscheidung und Ankleiden"
            />

            <Field
              label="Dokumentation"
              value={selfCare}
              onChangeText={setSelfCare}
              editable={canEdit}
              placeholder="Was kann die Person selbstständig? Wo benötigt sie Unterstützung?"
            />
          </Card>

          <Card style={styles.card}>
            <SectionTitle
              number="5"
              title="Leben in sozialen Beziehungen"
              subtitle="Angehörige, Kontakte, Gewohnheiten, Tagesstruktur und Teilhabe"
            />

            <Field
              label="Dokumentation"
              value={socialRelationships}
              onChangeText={
                setSocialRelationships
              }
              editable={canEdit}
              placeholder="Familie, Freunde, wichtige Bezugspersonen, soziale Gewohnheiten, Interessen..."
            />
          </Card>

          <Card style={styles.card}>
            <SectionTitle
              number="6"
              title="Wohnen / Häuslichkeit"
              subtitle="Wohnumfeld, Sicherheit und Unterstützung im Alltag"
            />

            <Field
              label="Dokumentation"
              value={livingEnvironment}
              onChangeText={
                setLivingEnvironment
              }
              editable={canEdit}
              placeholder="Wohnsituation, Barrieren, Treppen, Hilfsmittel, Sicherheit, Haushalt..."
            />
          </Card>

          <Card style={styles.card}>
            <SectionTitle
              title="Risikomatrix"
              subtitle={`${activeRiskCount} aktive Risiken markiert`}
            />

            <RiskRow
              label="Sturz"
              value={risks.fall}
              disabled={!canEdit}
              onValueChange={(value) =>
                updateRisk("fall", value)
              }
            />

            <RiskRow
              label="Dekubitus"
              value={risks.pressure_ulcer}
              disabled={!canEdit}
              onValueChange={(value) =>
                updateRisk(
                  "pressure_ulcer",
                  value
                )
              }
            />

            <RiskRow
              label="Schmerz"
              value={risks.pain}
              disabled={!canEdit}
              onValueChange={(value) =>
                updateRisk("pain", value)
              }
            />

            <RiskRow
              label="Ernährung"
              value={risks.nutrition}
              disabled={!canEdit}
              onValueChange={(value) =>
                updateRisk(
                  "nutrition",
                  value
                )
              }
            />

            <RiskRow
              label="Inkontinenz"
              value={risks.incontinence}
              disabled={!canEdit}
              onValueChange={(value) =>
                updateRisk(
                  "incontinence",
                  value
                )
              }
            />

            <RiskRow
              label="Aspiration"
              value={risks.aspiration}
              disabled={!canEdit}
              onValueChange={(value) =>
                updateRisk(
                  "aspiration",
                  value
                )
              }
            />

            <RiskRow
              label="Dehydratation"
              value={risks.dehydration}
              disabled={!canEdit}
              onValueChange={(value) =>
                updateRisk(
                  "dehydration",
                  value
                )
              }
            />

            <RiskRow
              label="Sonstiges Risiko"
              value={risks.other}
              disabled={!canEdit}
              onValueChange={(value) =>
                updateRisk("other", value)
              }
            />

            <Field
              label="Hinweise zur Risikoeinschätzung"
              value={riskNotes}
              onChangeText={setRiskNotes}
              editable={canEdit}
              placeholder="Begründung, Beobachtungen, vorhandene Prophylaxen oder weiterer Abklärungsbedarf..."
              minHeight={110}
            />
          </Card>

          <Card style={styles.card}>
            <SectionTitle
              title="Ressourcen, Wünsche und pflegerischer Fokus"
            />

            <Field
              label="Ressourcen"
              value={resources}
              onChangeText={setResources}
              editable={canEdit}
              placeholder="Fähigkeiten und vorhandene Ressourcen der Person..."
              minHeight={105}
            />

            <Field
              label="Wünsche und Gewohnheiten"
              value={wishes}
              onChangeText={setWishes}
              editable={canEdit}
              placeholder="Persönliche Wünsche, Gewohnheiten, Abneigungen und Vorlieben..."
              minHeight={105}
            />

            <Field
              label="Pflegerischer Fokus / Zusammenfassung"
              value={nursingFocus}
              onChangeText={setNursingFocus}
              editable={canEdit}
              placeholder="Wesentliche pflegerische Schwerpunkte zusammenfassen..."
              minHeight={120}
            />
          </Card>

          {(meta.updated_at ||
            meta.created_by_name) && (
            <Card style={styles.metaCard}>
              <Text style={styles.metaTitle}>
                Dokumentinformation
              </Text>

              {meta.created_by_name ? (
                <Text style={styles.metaText}>
                  Bearbeitet von:{" "}
                  {meta.created_by_name}
                </Text>
              ) : null}

              {meta.updated_at ? (
                <Text style={styles.metaText}>
                  Letzte Änderung:{" "}
                  {meta.updated_at}
                </Text>
              ) : null}
            </Card>
          )}

          {canEdit ? (
            <View style={styles.actionArea}>
              <Pressable
                disabled={saving}
                onPress={() =>
                  void saveSis("draft")
                }
                style={[
                  styles.secondaryButton,
                  saving &&
                    styles.buttonDisabled,
                ]}
              >
                <Ionicons
                  name="save-outline"
                  size={20}
                  color={colors.brandPrimary}
                />

                <Text
                  style={
                    styles.secondaryButtonText
                  }
                >
                  Als Entwurf speichern
                </Text>
              </Pressable>

              <Pressable
                disabled={saving}
                onPress={() =>
                  void saveSis("completed")
                }
                style={[
                  styles.primaryButton,
                  saving &&
                    styles.buttonDisabled,
                ]}
              >
                {saving ? (
                  <ActivityIndicator
                    color="#FFFFFF"
                  />
                ) : (
                  <Ionicons
                    name="checkmark-circle-outline"
                    size={21}
                    color="#FFFFFF"
                  />
                )}

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  SIS abschließen
                </Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },
  flexOne: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerButton: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    color: colors.onSurface,
    fontSize: 21,
    fontWeight: "800",
  },
  headerSubtitle: {
    marginTop: 2,
    color: colors.onSurfaceSecondary,
    fontSize: 13,
  },
  loadingBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  loadingText: {
    color: colors.onSurfaceSecondary,
    fontSize: 14,
  },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  heroCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  heroIcon: {
    width: 54,
    height: 54,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroEyebrow: {
    color: "#DCEBFF",
    fontSize: 10,
    fontWeight: "800",
  },
  heroName: {
    marginTop: 3,
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "800",
  },
  heroStatus: {
    marginTop: 3,
    color: "#EAF4FF",
    fontSize: 12,
  },
  readOnlyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  readOnlyText: {
    flex: 1,
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  card: {
    gap: spacing.md,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
  },
  sectionNumber: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSecondary,
  },
  sectionNumberText: {
    color: colors.brandPrimary,
    fontSize: 16,
    fontWeight: "900",
  },
  sectionTitle: {
    color: colors.onSurface,
    fontSize: font.lg,
    fontWeight: "800",
  },
  sectionSubtitle: {
    marginTop: 3,
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    lineHeight: 17,
  },
  fieldWrap: {
    gap: 7,
  },
  fieldLabel: {
    color: colors.onSurface,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  textArea: {
    width: "100%",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    color: colors.onSurface,
    fontSize: 14,
    lineHeight: 21,
  },
  textAreaDisabled: {
    opacity: 0.75,
  },
  riskRow: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  riskLabel: {
    flex: 1,
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "600",
  },
  metaCard: {
    backgroundColor: colors.surfaceSecondary,
  },
  metaTitle: {
    color: colors.onSurface,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 5,
  },
  metaText: {
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  actionArea: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  secondaryButton: {
    minHeight: 54,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    backgroundColor: colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  secondaryButtonText: {
    color: colors.brandPrimary,
    fontSize: 15,
    fontWeight: "800",
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
  },
  emptyTitle: {
    marginTop: spacing.lg,
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyText: {
    marginTop: spacing.sm,
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  backMain: {
    minWidth: 160,
    minHeight: 50,
    marginTop: spacing.xl,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  backMainText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
