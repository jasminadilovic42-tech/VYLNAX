import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors, spacing, radius, font } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";
import { PrimaryButton } from "@/src/components/ui";

function normalizeRole(role?: string | null): string {
  return String(role || "")
    .trim()
    .toLowerCase();
}

export default function AddPerson() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const role = normalizeRole(user?.role);
  const canAddPerson = role === "caregiver";

  const options = [
    {
      title: "Patient",
      description: "Eine betreute Person oder einen Patienten hinzufügen",
      icon: "person",
      route: "/add-patient",
    },
    {
      title: "Angehörige",
      description: "Ein Familienmitglied oder eine Kontaktperson hinzufügen",
      icon: "people",
      route: "/add-relative",
    },
    {
      title: "Pflegekraft",
      description: "Eine Pflegefachkraft oder Betreuungskraft hinzufügen",
      icon: "medkit",
      route: "/add-caregiver",
    },
    {
      title: "Hausarzt",
      description: "Hausarzt oder behandelnde Arztpraxis hinzufügen",
      icon: "medical",
      route: "/add-doctor",
    },
  ] as const;

  if (user && !canAddPerson) {
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
          Nur Pflegekräfte dürfen Patienten, Angehörige, Pflegekräfte oder Ärzte hinzufügen.
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
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={26}
            color={colors.onSurface}
          />
        </Pressable>

        <Text style={styles.title}>Person hinzufügen</Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.intro}>
          Bitte wählen Sie aus, welche Person oder Kontaktstelle Sie hinzufügen
          möchten.
        </Text>

        {options.map((option) => (
          <Pressable
            key={option.title}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
            onPress={() => router.push(option.route)}
          >
            <View style={styles.iconContainer}>
              <Ionicons
                name={option.icon}
                size={30}
                color={colors.brandPrimary}
              />
            </View>

            <View style={styles.textContainer}>
              <Text style={styles.optionTitle}>{option.title}</Text>
              <Text style={styles.optionDescription}>
                {option.description}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={24}
              color={colors.onSurfaceSecondary}
            />
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  backButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.onSurface,
  },

  headerSpacer: {
    width: 42,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },

  intro: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceSecondary,
    marginBottom: spacing.lg,
  },

  card: {
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },

  cardPressed: {
    opacity: 0.75,
  },

  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    marginRight: spacing.md,
  },

  textContainer: {
    flex: 1,
    paddingRight: spacing.sm,
  },

  optionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: 5,
  },

  optionDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.onSurfaceSecondary,
  },
});