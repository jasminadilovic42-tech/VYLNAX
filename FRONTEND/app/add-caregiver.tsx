import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  Switch,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { colors, spacing, radius, font } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";

const PROFESSIONAL_ROLES = [
  "Pflegefachkraft",
  "Altenpfleger/in",
  "Gesundheits- und Krankenpfleger/in",
  "Pflegehelfer/in",
  "Ambulanter Pflegedienst",
  "Betreuungskraft",
  "Wundexperte/in",
  "Andere",
];

const WORK_AREAS = [
  "Ambulante Pflege",
  "Pflegeheim",
  "Krankenhaus",
  "Tagespflege",
  "Hauswirtschaft",
  "Privatpflege",
  "Andere",
];

function normalizeRole(role?: string | null): string {
  return String(role || "")
    .trim()
    .toLowerCase();
}

export default function AddCaregiver() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { activePatient } = useApp();

  const role = normalizeRole(user?.role);
  const canManageCaregivers = role === "caregiver";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [professionalRole, setProfessionalRole] = useState("");
  const [workArea, setWorkArea] = useState("");

  const [organization, setOrganization] = useState("");
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [canViewMedication, setCanViewMedication] = useState(true);
  const [canEditMedication, setCanEditMedication] = useState(false);
  const [canConfirmMedication, setCanConfirmMedication] = useState(true);
  const [canViewReports, setCanViewReports] = useState(true);
  const [canEnterVitalSigns, setCanEnterVitalSigns] = useState(true);
  const [canControlDevice, setCanControlDevice] = useState(true);
  const [canReceiveAlerts, setCanReceiveAlerts] = useState(true);
  const [canUseAiChat, setCanUseAiChat] = useState(true);
  const [canManagePatients, setCanManagePatients] = useState(false);

  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(false);

  const [isPrimaryCaregiver, setIsPrimaryCaregiver] = useState(false);
  const [availableForEmergency, setAvailableForEmergency] = useState(false);

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");

    if (!activePatient?.id) {
      setError("Bitte wählen Sie zuerst eine betreute Person aus.");
      return;
    }

    if (!canManageCaregivers) {
      setError(
        "Keine Berechtigung. Nur Pflegekräfte dürfen weitere Pflegekräfte anlegen oder bearbeiten."
      );
      return;
    }

    if (!firstName.trim()) {
      setError("Bitte geben Sie den Vornamen ein.");
      return;
    }

    if (!lastName.trim()) {
      setError("Bitte geben Sie den Nachnamen ein.");
      return;
    }

    if (!professionalRole) {
      setError("Bitte wählen Sie die berufliche Funktion.");
      return;
    }

    if (!phone.trim() && !mobile.trim() && !email.trim()) {
      setError(
        "Bitte geben Sie mindestens Telefon, Mobilnummer oder E-Mail ein."
      );
      return;
    }

    if (saving) {
      return;
    }

    setSaving(true);

    try {
      await api("/caregivers", {
        method: "POST",
        body: {
          patient_id: activePatient.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          professional_role: professionalRole,
          work_area: workArea || null,

          organization: organization.trim() || null,
          employee_number: employeeNumber.trim() || null,
          phone: phone.trim() || null,
          mobile: mobile.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,

          is_primary_caregiver: isPrimaryCaregiver,
          available_for_emergency: availableForEmergency,

          permissions: {
            view_medication: canViewMedication,
            edit_medication: canEditMedication,
            confirm_medication: canConfirmMedication,
            view_reports: canViewReports,
            enter_vital_signs: canEnterVitalSigns,
            control_device: canControlDevice,
            receive_alerts: canReceiveAlerts,
            use_ai_chat: canUseAiChat,
            manage_patients: canManagePatients,
          },

          notifications: {
            push: pushNotifications,
            sms: smsNotifications,
            email: emailNotifications,
          },

          notes: notes.trim() || null,
        },
      });

      router.back();
    } catch (err) {
      console.log("Caregiver save error:", err);
      setError(
        "Speichern fehlgeschlagen. Bitte prüfen Sie die Verbindung und versuchen Sie es erneut."
      );
    } finally {
      setSaving(false);
    }
  };

  if (user && !canManageCaregivers) {
    return (
      <View
        style={[
          styles.deniedContainer,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
      >
        <Ionicons
          name="lock-closed"
          size={52}
          color={colors.error}
        />

        <Text style={styles.deniedTitle}>
          Kein Bearbeitungszugriff
        </Text>

        <Text style={styles.deniedText}>
          Pflegekräfte dürfen nur von einer bereits berechtigten Pflegekraft angelegt oder bearbeitet werden.
        </Text>

        <PrimaryButton
          label="Zurück"
          icon="arrow-back"
          onPress={() => router.back()}
          style={styles.deniedButton}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[
        styles.screen,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable
          testID="close-caregiver-form"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Pflegekraft hinzufügen</Text>
          <Text style={styles.headerSubtitle}>
            Berufliche Daten und Zugriffsrechte
          </Text>
        </View>

        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader
          icon="person-outline"
          title="Persönliche Daten"
        />

        <Field
          label="Vorname *"
          value={firstName}
          onChangeText={setFirstName}
          placeholder="z. B. Anna"
          autoCapitalize="words"
        />

        <Field
          label="Nachname *"
          value={lastName}
          onChangeText={setLastName}
          placeholder="z. B. Müller"
          autoCapitalize="words"
        />

        <Text style={styles.label}>Berufliche Funktion *</Text>

        <View style={styles.chipContainer}>
          {PROFESSIONAL_ROLES.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={professionalRole === item}
              onPress={() => setProfessionalRole(item)}
            />
          ))}
        </View>

        <Text style={styles.label}>Arbeitsbereich</Text>

        <View style={styles.chipContainer}>
          {WORK_AREAS.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={workArea === item}
              onPress={() => setWorkArea(item)}
            />
          ))}
        </View>

        <SectionHeader
          icon="business-outline"
          title="Arbeitgeber und Organisation"
        />

        <Field
          label="Pflegedienst / Einrichtung"
          value={organization}
          onChangeText={setOrganization}
          placeholder="z. B. Caritas Sozialstation"
          autoCapitalize="words"
        />

        <Field
          label="Personalnummer"
          value={employeeNumber}
          onChangeText={setEmployeeNumber}
          placeholder="z. B. PFK-1024"
          autoCapitalize="characters"
        />

        <SectionHeader
          icon="call-outline"
          title="Kontaktdaten"
        />

        <Field
          label="Telefon"
          value={phone}
          onChangeText={setPhone}
          placeholder="z. B. 09341 123456"
          keyboardType="phone-pad"
        />

        <Field
          label="Mobiltelefon"
          value={mobile}
          onChangeText={setMobile}
          placeholder="z. B. +49 171 1234567"
          keyboardType="phone-pad"
        />

        <Field
          label="E-Mail"
          value={email}
          onChangeText={setEmail}
          placeholder="z. B. pflege@example.de"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Field
          label="Dienstadresse"
          value={address}
          onChangeText={setAddress}
          placeholder="Straße, Hausnummer, PLZ und Ort"
          multiline
        />

        <SectionHeader
          icon="star-outline"
          title="Verantwortung"
        />

        <ToggleRow
          title="Hauptpflegekraft"
          description="Diese Pflegekraft ist die primäre zuständige Ansprechperson."
          value={isPrimaryCaregiver}
          onValueChange={setIsPrimaryCaregiver}
        />

        <ToggleRow
          title="Für Notfälle erreichbar"
          description="Diese Pflegekraft darf bei dringenden Warnungen kontaktiert werden."
          value={availableForEmergency}
          onValueChange={setAvailableForEmergency}
        />

        <SectionHeader
          icon="shield-checkmark-outline"
          title="Zugriffsrechte"
        />

        <ToggleRow
          title="Medikamente ansehen"
          description="Medikamentenplan und aktuelle Therapie einsehen."
          value={canViewMedication}
          onValueChange={setCanViewMedication}
        />

        <ToggleRow
          title="Medikamente bearbeiten"
          description="Therapieeinträge hinzufügen, ändern oder entfernen."
          value={canEditMedication}
          onValueChange={setCanEditMedication}
        />

        <ToggleRow
          title="Medikamentengabe bestätigen"
          description="Einnahme und Verabreichung dokumentieren."
          value={canConfirmMedication}
          onValueChange={setCanConfirmMedication}
        />

        <ToggleRow
          title="Berichte ansehen"
          description="Tages-, Wochen- und Therapieberichte einsehen."
          value={canViewReports}
          onValueChange={setCanViewReports}
        />

        <ToggleRow
          title="Vitalwerte eintragen"
          description="Blutdruck, Puls, Temperatur und weitere Werte dokumentieren."
          value={canEnterVitalSigns}
          onValueChange={setCanEnterVitalSigns}
        />

        <ToggleRow
          title="VYLNAX-Gerät steuern"
          description="Freigegebene Gerätefunktionen bedienen und bestätigen."
          value={canControlDevice}
          onValueChange={setCanControlDevice}
        />

        <ToggleRow
          title="Alarme erhalten"
          description="Warnungen bei vergessenen Medikamenten oder Geräteproblemen."
          value={canReceiveAlerts}
          onValueChange={setCanReceiveAlerts}
        />

        <ToggleRow
          title="AI-Chat verwenden"
          description="Zugriff auf den VYLNAX AI-Assistenten."
          value={canUseAiChat}
          onValueChange={setCanUseAiChat}
        />

        <ToggleRow
          title="Patienten verwalten"
          description="Patientenprofile hinzufügen und verwalten."
          value={canManagePatients}
          onValueChange={setCanManagePatients}
        />

        <SectionHeader
          icon="notifications-outline"
          title="Benachrichtigungen"
        />

        <ToggleRow
          title="Push-Benachrichtigungen"
          description="Warnungen direkt über die VYLNAX-App."
          value={pushNotifications}
          onValueChange={setPushNotifications}
        />

        <ToggleRow
          title="SMS"
          description="Dringende Meldungen zusätzlich per SMS erhalten."
          value={smsNotifications}
          onValueChange={setSmsNotifications}
        />

        <ToggleRow
          title="E-Mail"
          description="Berichte und Warnungen per E-Mail erhalten."
          value={emailNotifications}
          onValueChange={setEmailNotifications}
        />

        <SectionHeader
          icon="document-text-outline"
          title="Zusätzliche Informationen"
        />

        <Text style={styles.label}>Notizen</Text>

        <TextInput
          testID="caregiver-notes-input"
          value={notes}
          onChangeText={setNotes}
          placeholder="Dienstzeiten, Zuständigkeiten oder wichtige Hinweise"
          placeholderTextColor={colors.borderStrong}
          multiline
          textAlignVertical="top"
          style={[styles.input, styles.notesInput]}
        />

        {error ? (
          <View style={styles.errorBox}>
            <Ionicons
              name="warning-outline"
              size={20}
              color={colors.error}
            />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <PrimaryButton
          testID="save-caregiver"
          label="Pflegekraft speichern"
          icon="checkmark-circle-outline"
          loading={saving}
          onPress={() => void save()}
          style={styles.saveButton}
        />

        <Text style={styles.requiredInfo}>* Pflichtfelder</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  keyboardType?:
    | "default"
    | "phone-pad"
    | "email-address"
    | "numbers-and-punctuation";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  multiline?: boolean;
};

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType = "default",
  autoCapitalize = "sentences",
  multiline = false,
}: FieldProps) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.borderStrong}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        multiline={multiline}
        textAlignVertical={multiline ? "top" : "center"}
        style={[
          styles.input,
          multiline && styles.multilineInput,
        ]}
      />
    </>
  );
}

type SectionHeaderProps = {
  icon:
    | "person-outline"
    | "business-outline"
    | "call-outline"
    | "star-outline"
    | "shield-checkmark-outline"
    | "notifications-outline"
    | "document-text-outline";
  title: string;
};

function SectionHeader({
  icon,
  title,
}: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons
          name={icon}
          size={21}
          color={colors.brandPrimary}
        />
      </View>

      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

type ChoiceChipProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
};

function ChoiceChip({
  label,
  selected,
  onPress,
}: ChoiceChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && styles.chipSelected,
      ]}
    >
      <Text
        style={[
          styles.chipText,
          selected && styles.chipTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

type ToggleRowProps = {
  title: string;
  description: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

function ToggleRow({
  title,
  description,
  value,
  onValueChange,
}: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleTextContainer}>
        <Text style={styles.toggleTitle}>{title}</Text>

        <Text style={styles.toggleDescription}>
          {description}
        </Text>
      </View>

      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{
          false: colors.border,
          true: colors.brandPrimary,
        }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  deniedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surface,
  },

  deniedTitle: {
    color: colors.onSurface,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginTop: spacing.lg,
  },

  deniedText: {
    color: colors.onSurfaceSecondary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: spacing.sm,
  },

  deniedButton: {
    alignSelf: "stretch",
    marginTop: spacing.xl,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: colors.surface,
  },

  headerButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },

  headerCenter: {
    flex: 1,
    alignItems: "center",
  },

  headerTitle: {
    color: colors.onSurface,
    fontSize: font.lg,
    fontWeight: "800",
  },

  headerSubtitle: {
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    marginTop: 2,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },

  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
    marginRight: spacing.sm,
  },

  sectionTitle: {
    color: colors.onSurface,
    fontSize: 18,
    fontWeight: "800",
  },

  label: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    fontWeight: "700",
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },

  input: {
    minHeight: 52,
    color: colors.onSurface,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    fontSize: 15,
  },

  multilineInput: {
    minHeight: 86,
    paddingTop: spacing.md,
  },

  notesInput: {
    minHeight: 120,
    paddingTop: spacing.md,
  },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: colors.surfaceSecondary,
  },

  chipSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimary,
  },

  chipText: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    fontWeight: "700",
  },

  chipTextSelected: {
    color: "#FFFFFF",
  },

  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  toggleTextContainer: {
    flex: 1,
    paddingRight: spacing.md,
  },

  toggleTitle: {
    color: colors.onSurface,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },

  toggleDescription: {
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    lineHeight: 17,
  },

  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    marginTop: spacing.lg,
  },

  errorText: {
    flex: 1,
    color: colors.error,
    fontSize: 13,
    fontWeight: "600",
    marginLeft: spacing.sm,
  },

  saveButton: {
    marginTop: spacing.xl,
  },

  requiredInfo: {
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.md,
  },
});