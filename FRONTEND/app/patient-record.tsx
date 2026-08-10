import React, { useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, font, radius, spacing } from "@/src/theme";
import { useApp } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import { Card } from "@/src/components/ui";

type RowProps = {
  label: string;
  value: React.ReactNode;
};

function normalizeRole(role?: string | null): string {
  return String(role || "").trim().toLowerCase();
}

function textValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Nicht hinterlegt";
  }

  if (typeof value === "boolean") {
    return value ? "Ja" : "Nein";
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return "Nicht hinterlegt";
    }

    return value
      .map((item) =>
        typeof item === "string"
          ? item
          : JSON.stringify(item)
      )
      .join(", ");
  }

  return String(value);
}

function joinedName(
  firstName?: string | null,
  lastName?: string | null,
  fallback?: string | null
): string {
  const result = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return result || fallback || "Nicht hinterlegt";
}

function FieldRow({ label, value }: RowProps) {
  return (
    <View style={styles.fieldRow}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>
        {textValue(value)}
      </Text>
    </View>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  children: React.ReactNode;
}) {
  return (
    <Card style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionIcon}>
          <Ionicons
            name={icon}
            size={22}
            color={colors.brandPrimary}
          />
        </View>

        <Text style={styles.sectionTitle}>{title}</Text>
      </View>

      <View style={styles.sectionBody}>{children}</View>
    </Card>
  );
}

export default function PatientRecord() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    activePatient,
    relatives,
    caregivers,
    doctors,
  } = useApp();

  const { accessUser, user } = useAuth();

  const role = normalizeRole(
    accessUser?.role || user?.role
  );

  const canAccessWounds =
    role === "caregiver" || role === "doctor";

  const medical =
    activePatient?.medical_information || {};

  const nursing =
    activePatient?.nursing_assessment || {};

  const physical =
    activePatient?.physical_information || {};

  const accommodation =
    activePatient?.accommodation || {};

  const contact =
    activePatient?.contact || {};

  const professionalContacts =
    activePatient?.professional_contacts || {};

  const diagnoses = useMemo(() => {
    return [
      medical?.diagnoses,
      medical?.secondary_diagnoses,
    ]
      .filter(Boolean)
      .join("\n");
  }, [
    medical?.diagnoses,
    medical?.secondary_diagnoses,
  ]);

  const activeConditions = useMemo(() => {
    const conditions = medical?.conditions || {};

    const labels: Record<string, string> = {
      diabetes: "Diabetes",
      epilepsy: "Epilepsie",
      dementia: "Demenz",
      parkinson: "Parkinson",
      copd: "COPD",
      heart_failure: "Herzinsuffizienz",
      kidney_disease: "Nierenerkrankung",
      swallowing_disorder: "Schluckstörung",
      pacemaker: "Herzschrittmacher",
      chronic_pain: "Chronische Schmerzen",
    };

    return Object.entries(conditions)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => labels[key] || key);
  }, [medical?.conditions]);

  const activeRisks = useMemo(() => {
    const risks = nursing?.risks || {};

    const labels: Record<string, string> = {
      fall: "Sturzrisiko",
      pressure_ulcer: "Dekubitusrisiko",
      dehydration: "Dehydratationsrisiko",
      malnutrition: "Mangelernährungsrisiko",
      aspiration: "Aspirationsrisiko",
      wandering: "Weglauftendenz",
      bleeding: "Blutungsrisiko",
    };

    return Object.entries(risks)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => labels[key] || key);
  }, [nursing?.risks]);

  const activeAids = useMemo(() => {
    const aids = nursing?.aids || {};

    const labels: Record<string, string> = {
      hearing_aid: "Hörgerät",
      glasses: "Brille",
      dentures: "Zahnersatz",
      oxygen_therapy: "Sauerstofftherapie",
    };

    return Object.entries(aids)
      .filter(([, value]) => Boolean(value))
      .map(([key]) => labels[key] || key);
  }, [nursing?.aids]);

  if (!activePatient) {
    return (
      <View
        style={[
          styles.emptyContainer,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <Ionicons
          name="folder-open-outline"
          size={58}
          color={colors.onSurfaceTertiary}
        />

        <Text style={styles.emptyTitle}>
          Kein Patient ausgewählt
        </Text>

        <Text style={styles.emptyDescription}>
          Wählen Sie zuerst im Profil einen Patienten aus.
        </Text>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color="#FFFFFF"
          />
          <Text style={styles.backButtonText}>
            Zurück
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + spacing.sm,
          },
        ]}
      >
        <Pressable
          onPress={() => router.back()}
          style={styles.headerBack}
        >
          <Ionicons
            name="arrow-back"
            size={25}
            color={colors.onSurface}
          />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>
            Patientenakte
          </Text>

          <Text
            style={styles.headerSubtitle}
            numberOfLines={1}
          >
            {activePatient.name}
          </Text>
        </View>

        <View style={styles.headerBack} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              insets.bottom + spacing.xl * 2,
          },
        ]}
      >
        <Card style={styles.patientHero}>
          <View style={styles.patientHeroAvatar}>
            {activePatient.photo_data ? (
              <Image
                source={{ uri: activePatient.photo_data }}
                style={styles.patientHeroPhoto}
                contentFit="cover"
                transition={150}
              />
            ) : (
              <Ionicons
                name="person"
                size={32}
                color="#FFFFFF"
              />
            )}
          </View>

          <View style={styles.flexOne}>
            <Text style={styles.heroLabel}>
              AKTIVE PATIENTENAKTE
            </Text>

            <Text style={styles.heroName}>
              {activePatient.name}
            </Text>

            <Text style={styles.heroMeta}>
              {activePatient.room
                ? `Zimmer ${activePatient.room}`
                : "Vollständige Pflege- und Gesundheitsakte"}
            </Text>
          </View>
        </Card>

        <Section
          title="Stammdaten"
          icon="person-outline"
        >
          <FieldRow
            label="Name"
            value={
              joinedName(
                activePatient.first_name,
                activePatient.last_name,
                activePatient.name
              )
            }
          />

          <FieldRow
            label="Geburtsdatum"
            value={activePatient.birth_date}
          />

          <FieldRow
            label="Alter"
            value={activePatient.age}
          />

          <FieldRow
            label="Geschlecht"
            value={activePatient.gender}
          />

          <FieldRow
            label="Pflegegrad"
            value={activePatient.care_grade}
          />

          <FieldRow
            label="Krankenkasse"
            value={activePatient.health_insurance}
          />

          <FieldRow
            label="Versichertennummer"
            value={activePatient.insurance_number}
          />

          <FieldRow
            label="Blutgruppe"
            value={activePatient.blood_group}
          />
        </Section>

        <Section
          title="Diagnosen & medizinische Angaben"
          icon="medical-outline"
        >
          <FieldRow
            label="Diagnosen"
            value={diagnoses}
          />

          <FieldRow
            label="Erkrankungen"
            value={activeConditions}
          />

          <FieldRow
            label="Allergien"
            value={medical?.allergies}
          />

          <FieldRow
            label="Allergie-Hinweise"
            value={medical?.allergy_notes}
          />

          <FieldRow
            label="Blutverdünner"
            value={medical?.anticoagulants}
          />

          <FieldRow
            label="Dosierung Blutverdünner"
            value={medical?.anticoagulant_dose}
          />

          <FieldRow
            label="Hinweise Blutverdünner"
            value={medical?.anticoagulant_notes}
          />
        </Section>

        <Section
          title="Pflegeanamnese"
          icon="clipboard-outline"
        >
          <FieldRow
            label="Mobilität"
            value={nursing?.mobility}
          />

          <FieldRow
            label="Orientierung"
            value={nursing?.orientation}
          />

          <FieldRow
            label="Ernährung"
            value={nursing?.nutrition}
          />

          <FieldRow
            label="Kontinenz"
            value={nursing?.continence}
          />

          <FieldRow
            label="Hilfsmittel"
            value={activeAids}
          />

          <FieldRow
            label="Pflegerelevante Notizen"
            value={activePatient.notes}
          />
        </Section>

        <Section
          title="Risiken"
          icon="warning-outline"
        >
          <FieldRow
            label="Aktive Risiken"
            value={activeRisks}
          />
        </Section>

        <Section
          title="Körperliche Angaben"
          icon="body-outline"
        >
          <FieldRow
            label="Gewicht"
            value={
              physical?.weight_kg != null
                ? `${physical.weight_kg} kg`
                : null
            }
          />

          <FieldRow
            label="Größe"
            value={
              physical?.height_cm != null
                ? `${physical.height_cm} cm`
                : null
            }
          />

          <FieldRow
            label="Trinkziel"
            value={
              physical?.target_fluid_ml != null
                ? `${physical.target_fluid_ml} ml`
                : null
            }
          />
        </Section>

        <Section
          title="Unterbringung"
          icon="home-outline"
        >
          <FieldRow
            label="Wohnsituation"
            value={accommodation?.living_situation}
          />

          <FieldRow
            label="Einrichtung"
            value={accommodation?.facility_name}
          />

          <FieldRow
            label="Wohnbereich / Station"
            value={accommodation?.ward}
          />

          <FieldRow
            label="Zimmer"
            value={
              accommodation?.room ||
              activePatient.room
            }
          />

          <FieldRow
            label="Pflegedienst"
            value={accommodation?.nursing_service}
          />
        </Section>

        <Section
          title="Kontakt & Notfall"
          icon="call-outline"
        >
          <FieldRow
            label="Telefon"
            value={contact?.phone}
          />

          <FieldRow
            label="Mobil"
            value={contact?.mobile}
          />

          <FieldRow
            label="E-Mail"
            value={contact?.email}
          />

          <FieldRow
            label="Adresse"
            value={contact?.address}
          />

          <FieldRow
            label="Notfallkontakt"
            value={
              professionalContacts?.emergency_contact
            }
          />

          <FieldRow
            label="Notfalltelefon"
            value={
              professionalContacts?.emergency_phone
            }
          />

          <FieldRow
            label="Hausarzt"
            value={professionalContacts?.house_doctor}
          />

          <FieldRow
            label="Apotheke"
            value={professionalContacts?.pharmacy}
          />
        </Section>

        <Section
          title="Zugeordnete Kontakte"
          icon="people-outline"
        >
          <FieldRow
            label="Angehörige"
            value={
              relatives.length
                ? relatives
                    .map((item) =>
                      joinedName(
                        item.first_name,
                        item.last_name
                      )
                    )
                    .join(", ")
                : null
            }
          />

          <FieldRow
            label="Pflegekräfte"
            value={
              caregivers.length
                ? caregivers
                    .map((item) =>
                      joinedName(
                        item.first_name,
                        item.last_name
                      )
                    )
                    .join(", ")
                : null
            }
          />

          <FieldRow
            label="Ärzte"
            value={
              doctors.length
                ? doctors
                    .map((item) =>
                      [
                        item.title,
                        item.first_name,
                        item.last_name,
                      ]
                        .filter(Boolean)
                        .join(" ")
                    )
                    .join(", ")
                : null
            }
          />
        </Section>

        <Section
          title="Besondere Hinweise"
          icon="information-circle-outline"
        >
          <FieldRow
            label="Notfall- und Sicherheitsinformationen"
            value={activePatient.special_instructions}
          />

          <FieldRow
            label="Pflegeanamnese / Notizen"
            value={activePatient.notes}
          />
        </Section>

        <Pressable
          onPress={() => router.push("/patient-sis" as any)}
          style={styles.sisButton}
        >
          <View style={styles.sisIcon}>
            <Ionicons
              name="document-text-outline"
              size={26}
              color="#FFFFFF"
            />
          </View>

          <View style={styles.flexOne}>
            <Text style={styles.sisTitle}>
              SIS®
            </Text>

            <Text style={styles.sisText}>
              Strukturierte Informationssammlung für{" "}
              {activePatient.name} öffnen und bearbeiten.
            </Text>
          </View>

          <Ionicons
            name="chevron-forward"
            size={23}
            color="#FFFFFF"
          />
        </Pressable>

        {canAccessWounds && (
          <Pressable
            onPress={() =>
              router.push(
                "/wound-documentation" as any
              )
            }
            style={styles.woundButton}
          >
            <View style={styles.woundIcon}>
              <Ionicons
                name="bandage-outline"
                size={26}
                color="#FFFFFF"
              />
            </View>

            <View style={styles.flexOne}>
              <Text style={styles.woundTitle}>
                Wunddokumentation
              </Text>

              <Text style={styles.woundText}>
                Wunden, Fotos und Verlauf für{" "}
                {activePatient.name} öffnen.
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={23}
              color="#FFFFFF"
            />
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surfaceSecondary,
  },

  flexOne: {
    flex: 1,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },

  headerBack: {
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
    fontSize: 20,
    fontWeight: "800",
    color: colors.onSurface,
  },

  headerSubtitle: {
    marginTop: 2,
    fontSize: 13,
    color: colors.onSurfaceSecondary,
  },

  content: {
    padding: spacing.lg,
    gap: spacing.md,
  },

  patientHero: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },

  patientHeroAvatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  patientHeroPhoto: {
    width: "100%",
    height: "100%",
    borderRadius: 29,
  },

  heroLabel: {
    color: "#DCEBFF",
    fontSize: 11,
    fontWeight: "800",
  },

  heroName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginTop: 2,
  },

  heroMeta: {
    color: "#EAF4FF",
    fontSize: 12,
    marginTop: 3,
  },

  sectionCard: {
    padding: 0,
    overflow: "hidden",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  sectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandSecondary,
  },

  sectionTitle: {
    flex: 1,
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.onSurface,
  },

  sectionBody: {
    paddingHorizontal: spacing.md,
  },

  fieldRow: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceTertiary,
    marginBottom: 5,
  },

  fieldValue: {
    fontSize: 15,
    lineHeight: 21,
    color: colors.onSurface,
    fontWeight: "500",
  },

  sisButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },

  sisIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  sisTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  sisText: {
    color: "#EAF4FF",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },

  woundButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.brandPrimary,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginTop: spacing.sm,
  },

  woundIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },

  woundTitle: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  woundText: {
    color: "#EAF4FF",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
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
    fontSize: 22,
    fontWeight: "800",
    color: colors.onSurface,
  },

  emptyDescription: {
    marginTop: spacing.sm,
    textAlign: "center",
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceSecondary,
  },

  backButton: {
    marginTop: spacing.xl,
    minWidth: 160,
    minHeight: 50,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
});
