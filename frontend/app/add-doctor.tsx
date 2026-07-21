import React, { useState } from "react";
import {
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
import { colors, spacing, radius, font } from "@/src/theme";
import { PrimaryButton } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";

const SPECIALIZATIONS = [
  "Allgemeinmedizin",
  "Innere Medizin",
  "Kardiologie",
  "Neurologie",
  "Geriatrie",
  "Diabetologie",
  "Psychiatrie",
  "Orthopädie",
  "Pneumologie",
  "Andere",
];

const CONTACT_TYPES = [
  "Hausarzt",
  "Behandelnder Facharzt",
  "Vertretungsarzt",
  "Notfallkontakt",
];

function normalizeRole(role?: string | null): string {
  return String(role || "").trim().toLowerCase();
}

export default function AddDoctor() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { activePatient } = useApp();

  const role = normalizeRole(user?.role);
  const canManageDoctors = role === "caregiver";

  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [specialization, setSpecialization] = useState("");
  const [contactType, setContactType] = useState("Hausarzt");

  const [practiceName, setPracticeName] = useState("");
  const [practiceAddress, setPracticeAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [fax, setFax] = useState("");
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");

  const [openingHours, setOpeningHours] = useState("");
  const [consultationNotes, setConsultationNotes] = useState("");

  const [canViewMedication, setCanViewMedication] = useState(true);
  const [canEditMedication, setCanEditMedication] = useState(true);
  const [canViewReports, setCanViewReports] = useState(true);
  const [canViewVitalSigns, setCanViewVitalSigns] = useState(true);
  const [canReceiveAlerts, setCanReceiveAlerts] = useState(true);
  const [canSendTherapyChanges, setCanSendTherapyChanges] = useState(true);
  const [canUseAiSummary, setCanUseAiSummary] = useState(true);
  const [canContactCaregiver, setCanContactCaregiver] = useState(true);

  const [pushNotifications, setPushNotifications] = useState(false);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);

  const [isPrimaryDoctor, setIsPrimaryDoctor] = useState(true);
  const [availableForEmergency, setAvailableForEmergency] = useState(false);

  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");

    if (!canManageDoctors) {
      setError(
        "Keine Berechtigung. Nur Pflegekräfte dürfen Ärzte anlegen oder bearbeiten."
      );
      return;
    }

    if (!activePatient?.id) {
      setError("Bitte wählen Sie zuerst eine betreute Person aus.");
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

    if (!specialization) {
      setError("Bitte wählen Sie die Fachrichtung.");
      return;
    }

    if (!practiceName.trim()) {
      setError("Bitte geben Sie den Namen der Arztpraxis ein.");
      return;
    }

    if (!phone.trim() && !email.trim()) {
      setError(
        "Bitte geben Sie mindestens eine Telefonnummer oder E-Mail-Adresse ein."
      );
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      await api("/doctors", {
        method: "POST",
        body: {
          patient_id: activePatient.id,

          title: title.trim() || null,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          specialization,
          contact_type: contactType,

          practice_name: practiceName.trim(),
          practice_address: practiceAddress.trim() || null,
          phone: phone.trim() || null,
          emergency_phone: emergencyPhone.trim() || null,
          fax: fax.trim() || null,
          email: email.trim() || null,
          website: website.trim() || null,

          opening_hours: openingHours.trim() || null,
          consultation_notes: consultationNotes.trim() || null,

          is_primary_doctor: isPrimaryDoctor,
          available_for_emergency: availableForEmergency,

          permissions: {
            view_medication: canViewMedication,
            edit_medication: canEditMedication,
            view_reports: canViewReports,
            view_vital_signs: canViewVitalSigns,
            receive_alerts: canReceiveAlerts,
            send_therapy_changes: canSendTherapyChanges,
            use_ai_summary: canUseAiSummary,
            contact_caregiver: canContactCaregiver,
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
    } catch (err: any) {
      console.error("Doctor save error:", err);

      const message =
        err?.message === "Patient not found"
          ? "Die ausgewählte betreute Person wurde nicht gefunden."
          : err?.message === "BACKEND_TIMEOUT"
            ? "Der Server antwortet nicht. Bitte versuchen Sie es erneut."
            : "Speichern fehlgeschlagen. Bitte prüfen Sie die Verbindung und versuchen Sie es erneut.";

      setError(message);
    } finally {
      setSaving(false);
    }
  };

  if (user && !canManageDoctors) {
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
        <Ionicons name="lock-closed" size={52} color={colors.error} />

        <Text style={styles.deniedTitle}>Kein Bearbeitungszugriff</Text>

        <Text style={styles.deniedText}>
          Ärzte dürfen nur von einer berechtigten Pflegekraft angelegt oder
          bearbeitet werden.
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
          testID="close-doctor-form"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons name="close" size={26} color={colors.onSurface} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Hausarzt hinzufügen</Text>
          <Text style={styles.headerSubtitle}>
            {activePatient?.name
              ? `Für: ${activePatient.name}`
              : "Bitte zuerst betreute Person wählen"}
          </Text>
        </View>

        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SectionHeader icon="person-outline" title="Persönliche Daten" />

        <Field
          label="Titel"
          value={title}
          onChangeText={setTitle}
          placeholder="z. B. Dr. med."
          autoCapitalize="words"
        />

        <Field
          label="Vorname *"
          value={firstName}
          onChangeText={setFirstName}
          placeholder="z. B. Michael"
          autoCapitalize="words"
        />

        <Field
          label="Nachname *"
          value={lastName}
          onChangeText={setLastName}
          placeholder="z. B. Schneider"
          autoCapitalize="words"
        />

        <Text style={styles.label}>Fachrichtung *</Text>
        <View style={styles.chipContainer}>
          {SPECIALIZATIONS.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={specialization === item}
              onPress={() => setSpecialization(item)}
            />
          ))}
        </View>

        <Text style={styles.label}>Art des ärztlichen Kontakts</Text>
        <View style={styles.chipContainer}>
          {CONTACT_TYPES.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={contactType === item}
              onPress={() => setContactType(item)}
            />
          ))}
        </View>

        <SectionHeader icon="business-outline" title="Arztpraxis" />

        <Field
          label="Name der Arztpraxis *"
          value={practiceName}
          onChangeText={setPracticeName}
          placeholder="z. B. Hausarztpraxis Schneider"
          autoCapitalize="words"
        />

        <Field
          label="Praxisadresse"
          value={practiceAddress}
          onChangeText={setPracticeAddress}
          placeholder="Straße, Hausnummer, PLZ und Ort"
          multiline
        />

        <Field
          label="Telefon"
          value={phone}
          onChangeText={setPhone}
          placeholder="z. B. 09341 123456"
          keyboardType="phone-pad"
        />

        <Field
          label="Notfallnummer"
          value={emergencyPhone}
          onChangeText={setEmergencyPhone}
          placeholder="z. B. +49 171 1234567"
          keyboardType="phone-pad"
        />

        <Field
          label="Fax"
          value={fax}
          onChangeText={setFax}
          placeholder="z. B. 09341 123457"
          keyboardType="phone-pad"
        />

        <Field
          label="E-Mail"
          value={email}
          onChangeText={setEmail}
          placeholder="z. B. praxis@example.de"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Field
          label="Webseite"
          value={website}
          onChangeText={setWebsite}
          placeholder="z. B. www.hausarztpraxis.de"
          keyboardType="url"
          autoCapitalize="none"
        />

        <Field
          label="Sprechzeiten"
          value={openingHours}
          onChangeText={setOpeningHours}
          placeholder="z. B. Mo–Fr 08:00–12:00 Uhr"
          multiline
        />

        <Field
          label="Hinweise zur Kontaktaufnahme"
          value={consultationNotes}
          onChangeText={setConsultationNotes}
          placeholder="Telefonische Erreichbarkeit, Vertretung oder Terminvereinbarung"
          multiline
        />

        <SectionHeader icon="star-outline" title="Verantwortung" />

        <ToggleRow
          title="Als Hausarzt festlegen"
          description="Dieser Arzt wird als primärer behandelnder Hausarzt geführt."
          value={isPrimaryDoctor}
          onValueChange={setIsPrimaryDoctor}
        />

        <ToggleRow
          title="Für dringende Rückfragen erreichbar"
          description="Der Arzt darf bei medizinisch relevanten Warnungen kontaktiert werden."
          value={availableForEmergency}
          onValueChange={setAvailableForEmergency}
        />

        <SectionHeader
          icon="shield-checkmark-outline"
          title="Zugriffsrechte"
        />

        <ToggleRow
          title="Medikamente ansehen"
          description="Aktuellen Medikamentenplan und Therapiehistorie einsehen."
          value={canViewMedication}
          onValueChange={setCanViewMedication}
        />

        <ToggleRow
          title="Medikamente bearbeiten"
          description="Ärztlich verordnete Therapieänderungen eintragen."
          value={canEditMedication}
          onValueChange={setCanEditMedication}
        />

        <ToggleRow
          title="Berichte ansehen"
          description="Tages-, Wochen- und Therapieberichte einsehen."
          value={canViewReports}
          onValueChange={setCanViewReports}
        />

        <ToggleRow
          title="Vitalwerte ansehen"
          description="Blutdruck, Puls, Temperatur und weitere Gesundheitswerte einsehen."
          value={canViewVitalSigns}
          onValueChange={setCanViewVitalSigns}
        />

        <ToggleRow
          title="Medizinische Warnungen erhalten"
          description="Hinweise bei kritischen Vitalwerten oder Therapieproblemen."
          value={canReceiveAlerts}
          onValueChange={setCanReceiveAlerts}
        />

        <ToggleRow
          title="Therapieänderungen übermitteln"
          description="Neue Verordnungen oder Therapieanpassungen an VYLNAX senden."
          value={canSendTherapyChanges}
          onValueChange={setCanSendTherapyChanges}
        />

        <ToggleRow
          title="AI-Zusammenfassung verwenden"
          description="KI-gestützte Zusammenfassung der Therapie- und Gesundheitsdaten."
          value={canUseAiSummary}
          onValueChange={setCanUseAiSummary}
        />

        <ToggleRow
          title="Pflegekraft kontaktieren"
          description="Direkter Kontakt mit der zuständigen Pflegekraft."
          value={canContactCaregiver}
          onValueChange={setCanContactCaregiver}
        />

        <SectionHeader icon="notifications-outline" title="Benachrichtigungen" />

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
          description="Berichte und medizinische Hinweise per E-Mail erhalten."
          value={emailNotifications}
          onValueChange={setEmailNotifications}
        />

        <SectionHeader
          icon="document-text-outline"
          title="Zusätzliche Informationen"
        />

        <Text style={styles.label}>Notizen</Text>
        <TextInput
          testID="doctor-notes-input"
          value={notes}
          onChangeText={setNotes}
          placeholder="Wichtige medizinische oder organisatorische Hinweise"
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
          testID="save-doctor"
          label="Hausarzt speichern"
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
    | "numbers-and-punctuation"
    | "url";
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
        style={[styles.input, multiline && styles.multilineInput]}
      />
    </>
  );
}

type SectionHeaderProps = {
  icon:
    | "person-outline"
    | "business-outline"
    | "star-outline"
    | "shield-checkmark-outline"
    | "notifications-outline"
    | "document-text-outline";
  title: string;
};

function SectionHeader({ icon, title }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={21} color={colors.brandPrimary} />
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

function ChoiceChip({ label, selected, onPress }: ChoiceChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text
        style={[styles.chipText, selected && styles.chipTextSelected]}
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
        <Text style={styles.toggleDescription}>{description}</Text>
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
    textAlign: "center",
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