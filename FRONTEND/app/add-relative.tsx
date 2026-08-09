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

const RELATIONSHIPS = [
  "Ehepartner/in",
  "Sohn",
  "Tochter",
  "Mutter",
  "Vater",
  "Bruder",
  "Schwester",
  "Betreuer/in",
  "Andere",
];

const GENDERS = ["Weiblich", "Männlich", "Divers"];

function normalizeRole(role?: string | null): string {
  return String(role || "")
    .trim()
    .toLowerCase();
}

export default function AddRelative() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { activePatient } = useApp();

  const role = normalizeRole(user?.role);
  const canManageRelatives = role === "caregiver";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [relationship, setRelationship] = useState("");

  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [isEmergencyContact, setIsEmergencyContact] = useState(true);
  const [emergencyPriority, setEmergencyPriority] = useState("1");

  const [canViewMedication, setCanViewMedication] = useState(true);
  const [canReceiveAlerts, setCanReceiveAlerts] = useState(true);
  const [canControlDevice, setCanControlDevice] = useState(false);
  const [canViewReports, setCanViewReports] = useState(true);
  const [canUseAiChat, setCanUseAiChat] = useState(false);
  const [canUseVideoCall, setCanUseVideoCall] = useState(false);

  const [pushNotifications, setPushNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(false);

  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");

    if (!activePatient?.id) {
      setError("Bitte wählen Sie zuerst eine betreute Person aus.");
      return;
    }

    if (!canManageRelatives) {
      setError(
        "Keine Berechtigung. Nur Pflegekräfte dürfen Angehörige anlegen oder bearbeiten."
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

    if (!relationship) {
      setError("Bitte wählen Sie die Beziehung zum Patienten.");
      return;
    }

    if (!phone.trim() && !mobile.trim()) {
      setError(
        "Bitte geben Sie mindestens eine Telefonnummer oder Mobilnummer ein."
      );
      return;
    }

    if (saving) {
      return;
    }

    setSaving(true);

    try {
      await api("/relatives", {
        method: "POST",
        body: {
          patient_id: activePatient.id,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_date: birthDate.trim() || null,
          gender: gender || null,
          relationship,

          phone: phone.trim() || null,
          mobile: mobile.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,

          is_emergency_contact: isEmergencyContact,
          emergency_priority: isEmergencyContact
            ? Number(emergencyPriority)
            : null,

          permissions: {
            view_medication: canViewMedication,
            receive_alerts: canReceiveAlerts,
            control_device: canControlDevice,
            view_reports: canViewReports,
            use_ai_chat: canUseAiChat,
            use_video_call: canUseVideoCall,
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
      console.log("Relative save error:", err);
      setError(
        "Speichern fehlgeschlagen. Bitte prüfen Sie die Verbindung und versuchen Sie es erneut."
      );
    } finally {
      setSaving(false);
    }
  };

  if (user && !canManageRelatives) {
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
          Angehörige dürfen nur von einer Pflegekraft angelegt oder bearbeitet werden.
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
          testID="close-relative-form"
          onPress={() => router.back()}
          style={styles.headerButton}
        >
          <Ionicons
            name="close"
            size={26}
            color={colors.onSurface}
          />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Angehörige hinzufügen</Text>
          <Text style={styles.headerSubtitle}>
            Kontaktperson und Zugriffsrechte
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
          placeholder="z. B. Maria"
          autoCapitalize="words"
        />

        <Field
          label="Nachname *"
          value={lastName}
          onChangeText={setLastName}
          placeholder="z. B. Schmidt"
          autoCapitalize="words"
        />

        <Field
          label="Geburtsdatum"
          value={birthDate}
          onChangeText={setBirthDate}
          placeholder="TT.MM.JJJJ"
          keyboardType="numbers-and-punctuation"
        />

        <Text style={styles.label}>Geschlecht</Text>

        <View style={styles.chipContainer}>
          {GENDERS.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={gender === item}
              onPress={() => setGender(item)}
            />
          ))}
        </View>

        <Text style={styles.label}>
          Beziehung zum Patienten *
        </Text>

        <View style={styles.chipContainer}>
          {RELATIONSHIPS.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={relationship === item}
              onPress={() => setRelationship(item)}
            />
          ))}
        </View>

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
          placeholder="z. B. maria@example.de"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <Field
          label="Adresse"
          value={address}
          onChangeText={setAddress}
          placeholder="Straße, Hausnummer, PLZ und Ort"
          multiline
        />

        <SectionHeader
          icon="alert-circle-outline"
          title="Notfallkontakt"
        />

        <ToggleRow
          title="Als Notfallkontakt festlegen"
          description="Diese Person wird bei einem Notfall priorisiert informiert."
          value={isEmergencyContact}
          onValueChange={setIsEmergencyContact}
        />

        {isEmergencyContact && (
          <>
            <Text style={styles.label}>
              Priorität des Notfallkontakts
            </Text>

            <View style={styles.priorityRow}>
              {["1", "2", "3"].map((priority) => (
                <Pressable
                  key={priority}
                  onPress={() => setEmergencyPriority(priority)}
                  style={[
                    styles.priorityButton,
                    emergencyPriority === priority &&
                      styles.priorityButtonSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.priorityText,
                      emergencyPriority === priority &&
                        styles.priorityTextSelected,
                    ]}
                  >
                    Priorität {priority}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

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
          title="Alarme und Erinnerungen erhalten"
          description="Benachrichtigung bei vergessenen oder verspäteten Medikamenten."
          value={canReceiveAlerts}
          onValueChange={setCanReceiveAlerts}
        />

        <ToggleRow
          title="VYLNAX-Gerät steuern"
          description="Bestätigungen und freigegebene Gerätefunktionen bedienen."
          value={canControlDevice}
          onValueChange={setCanControlDevice}
        />

        <ToggleRow
          title="Berichte ansehen"
          description="Tages-, Wochen- und Therapieberichte einsehen."
          value={canViewReports}
          onValueChange={setCanViewReports}
        />

        <ToggleRow
          title="AI-Chat verwenden"
          description="Zugriff auf den VYLNAX AI-Assistenten erhalten."
          value={canUseAiChat}
          onValueChange={setCanUseAiChat}
        />

        <ToggleRow
          title="Videoanrufe verwenden"
          description="Videoverbindung mit Patient oder Pflegepersonal nutzen."
          value={canUseVideoCall}
          onValueChange={setCanUseVideoCall}
        />

        <SectionHeader
          icon="notifications-outline"
          title="Benachrichtigungen"
        />

        <ToggleRow
          title="Push-Benachrichtigungen"
          description="Benachrichtigungen direkt über die VYLNAX-App."
          value={pushNotifications}
          onValueChange={setPushNotifications}
        />

        <ToggleRow
          title="SMS"
          description="Wichtige Warnungen zusätzlich per SMS erhalten."
          value={smsNotifications}
          onValueChange={setSmsNotifications}
        />

        <ToggleRow
          title="E-Mail"
          description="Berichte und ausgewählte Warnungen per E-Mail erhalten."
          value={emailNotifications}
          onValueChange={setEmailNotifications}
        />

        <SectionHeader
          icon="document-text-outline"
          title="Zusätzliche Informationen"
        />

        <Text style={styles.label}>Notizen</Text>

        <TextInput
          testID="relative-notes-input"
          value={notes}
          onChangeText={setNotes}
          placeholder="Wichtige Hinweise, Erreichbarkeit oder besondere Vereinbarungen"
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
          testID="save-relative"
          label="Angehörigen speichern"
          icon="checkmark-circle-outline"
          loading={saving}
          onPress={() => void save()}
          style={styles.saveButton}
        />

        <Text style={styles.requiredInfo}>
          * Pflichtfelder
        </Text>
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
    | "call-outline"
    | "alert-circle-outline"
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

  priorityRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  priorityButton: {
    flex: 1,
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: 12,
    backgroundColor: colors.surfaceSecondary,
  },

  priorityButtonSelected: {
    borderColor: colors.brandPrimary,
    backgroundColor: colors.brandPrimary,
  },

  priorityText: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    fontWeight: "700",
  },

  priorityTextSelected: {
    color: "#FFFFFF",
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