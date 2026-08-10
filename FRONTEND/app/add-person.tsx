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

import { colors, spacing, radius } from "@/src/theme";
import { useAuth } from "@/src/context/AuthContext";

export default function AddPerson() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    accessUser,
    isCaregiver,
  } = useAuth();

  /*
   * Pflegefachkraft / PFK može dodavati i povezivati osobe.
   *
   * VAŽNO:
   * Aktivna PIN uloga dolazi iz accessUser.role,
   * a ne iz user.role.
   */
  const canAddPerson = isCaregiver;

  const options = [
    {
      title: "Patient",
      description:
        "Kompletna Patientenakte: Stammdaten, Diagnosen, Anamnese, Risiken, Blutverdünner i Pflegeangaben.",
      icon: "person-outline" as const,
      route: "/add-patient" as const,
    },
    {
      title: "Angehörige",
      description:
        "Ime, prezime, odnos s pacijentom, telefon, e-mail, adresa i Notfallkontakt.",
      icon: "people-outline" as const,
      route: "/add-relative" as const,
    },
    {
      title: "Pflegefachkraft",
      description:
        "PFK, funkcija, ustanova, kontakt, odgovorni pacijent i profesionalne kvalifikacije.",
      icon: "medkit-outline" as const,
      route: "/add-caregiver" as const,
    },
    {
      title: "Arzt / Ärztin",
      description:
        "Hausarzt ili Facharzt: Fachrichtung, Praxis, adresa, telefon, e-mail i povezan pacijent.",
      icon: "medical-outline" as const,
      route: "/add-doctor" as const,
    },
  ];

  if (accessUser && !canAddPerson) {
    return (
      <View
        style={[
          styles.denied,
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
          Diese Funktion ist für berechtigte Pflegekräfte vorgesehen.
        </Text>

        <Pressable
          style={styles.backMain}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={20}
            color="#fff"
          />

          <Text style={styles.backMainText}>
            Zurück
          </Text>
        </Pressable>
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
          style={styles.headerButton}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={colors.onSurface}
          />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.title}>
            Person hinzufügen
          </Text>

          <Text style={styles.subtitle}>
            Rolle auswählen
          </Text>
        </View>

        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.infoBox}>
          <Ionicons
            name="information-circle-outline"
            size={22}
            color={colors.brandPrimary}
          />

          <Text style={styles.infoText}>
            Jede Rolle erhält jetzt einen eigenen vollständigen Datensatz.
            Dadurch bleiben Patientenakte, Angehörige, Ärzte und PFK sauber
            getrennt und trotzdem miteinander verknüpft.
          </Text>
        </View>

        {options.map((option) => (
          <Pressable
            key={option.title}
            onPress={() => router.push(option.route as any)}
            style={({ pressed }) => [
              styles.card,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.iconBox}>
              <Ionicons
                name={option.icon}
                size={26}
                color={colors.brandPrimary}
              />
            </View>

            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>
                {option.title}
              </Text>

              <Text style={styles.cardDescription}>
                {option.description}
              </Text>
            </View>

            <Ionicons
              name="chevron-forward"
              size={23}
              color={colors.onSurfaceTertiary}
            />
          </Pressable>
        ))}

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>
            Wichtig
          </Text>

          <Text style={styles.noteText}>
            Medikamente, Wunddokumentation, Ärzte, Angehörige und PFK werden
            später direkt mit dem ausgewählten Patienten verknüpft. Wir
            speichern diese Daten nicht mehr als einfachen Freitext.
          </Text>
        </View>
      </ScrollView>
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
    justifyContent: "space-between",
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  headerButton: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
  },

  headerCenter: {
    alignItems: "center",
    flex: 1,
  },

  title: {
    fontSize: 19,
    fontWeight: "800",
    color: colors.onSurface,
  },

  subtitle: {
    marginTop: 2,
    fontSize: 12,
    color: colors.onSurfaceSecondary,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xl * 2,
    gap: spacing.md,
  },

  infoBox: {
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  infoText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.onSurfaceSecondary,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },

  cardPressed: {
    opacity: 0.78,
  },

  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceSecondary,
  },

  cardText: {
    flex: 1,
  },

  cardTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.onSurface,
  },

  cardDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurfaceSecondary,
  },

  noteBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  noteTitle: {
    fontWeight: "800",
    color: colors.onSurface,
    marginBottom: 5,
  },

  noteText: {
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurfaceSecondary,
  },

  denied: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.surfaceSecondary,
  },

  deniedTitle: {
    marginTop: spacing.lg,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    color: colors.onSurface,
  },

  deniedText: {
    marginTop: spacing.sm,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    color: colors.onSurfaceSecondary,
  },

  backMain: {
    marginTop: spacing.xl,
    minWidth: 160,
    height: 50,
    borderRadius: radius.md,
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.brandPrimary,
  },

  backMainText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
  },
});