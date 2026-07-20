import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  colors,
  spacing,
  radius,
  font,
  ROLES,
} from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import { Card } from "@/src/components/ui";
import { SectionTitle } from "@/src/components/shared";

type Caregiver = {
  id: string;
  first_name: string;
  last_name: string;
  professional_role?: string | null;
  work_area?: string | null;
  organization?: string | null;
  employee_number?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  is_primary_caregiver?: boolean;
  available_for_emergency?: boolean;
  notes?: string | null;
};

export default function Profile() {
  const { user, logout, setRole } = useAuth();

  const {
    patients,
    activePatient,
    setActivePatient,
    loadPatients,
  } = useApp();

  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [overview, setOverview] = useState<Record<string, any>>({});
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [activeCaregiverId, setActiveCaregiverId] =
    useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    const map: Record<string, any> = {};

    await Promise.all(
      patients.map(async (patient) => {
        try {
          map[patient.id] = await api(
            `/patients/${patient.id}/reports?period=day`
          );
        } catch {
          // Izvještaj nije dostupan za ovog pacijenta.
        }
      })
    );

    setOverview(map);
  }, [patients]);

  const loadCaregivers = useCallback(async () => {
    try {
      const result = await api("/caregivers");

      if (Array.isArray(result)) {
        setCaregivers(result);
      } else {
        setCaregivers([]);
      }
    } catch (error) {
      console.error("Fehler beim Laden der Pflegekräfte:", error);
      setCaregivers([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadPatients().then(loadOverview);
      loadCaregivers();
    }, [loadOverview, loadCaregivers])
  );

  const changeRole = async (role: string) => {
    setBusy(true);

    try {
      await setRole(role);
    } finally {
      setBusy(false);
    }
  };

  const removePatient = async (id: string) => {
    try {
      await api(`/patients/${id}`, {
        method: "DELETE",
      });

      await loadPatients();
    } catch (error) {
      console.error("Fehler beim Löschen der Person:", error);
    }
  };

  const removeCaregiver = async (id: string) => {
    try {
      await api(`/caregivers/${id}`, {
        method: "DELETE",
      });

      if (activeCaregiverId === id) {
        setActiveCaregiverId(null);
      }

      await loadCaregivers();
    } catch (error) {
      console.error("Fehler beim Löschen der Pflegekraft:", error);
    }
  };

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
        <Text style={styles.title}>Profil</Text>
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: 120,
        }}
      >
        <Card style={styles.userCard}>
          {user?.picture ? (
            <Image
              source={{ uri: user.picture }}
              style={styles.avatar}
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInit}>
                {(user?.name || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          )}

          <View style={{ flex: 1 }}>
            <Text style={styles.userName}>
              {user?.name || "VYLNAX Benutzer"}
            </Text>

            <Text style={styles.userEmail}>
              {user?.email || ""}
            </Text>
          </View>
        </Card>

        <SectionTitle title="Meine Rolle" />

        <View style={styles.roleRow}>
          {Object.entries(ROLES).map(([key, label]) => {
            const active = user?.role === key;

            return (
              <Pressable
                key={key}
                testID={`role-${key}`}
                onPress={() => changeRole(key)}
                disabled={busy}
                style={[
                  styles.roleChip,
                  active && styles.roleActive,
                ]}
              >
                <Ionicons
                  name={
                    key === "patient"
                      ? "person"
                      : key === "relative"
                        ? "people"
                        : "medical"
                  }
                  size={18}
                  color={
                    active
                      ? "#FFFFFF"
                      : colors.brandPrimary
                  }
                />

                <Text
                  style={[
                    styles.roleText,
                    active && styles.roleTextActive,
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <SectionTitle
          title="Betreute Personen"
          action="+ Hinzufügen"
          onAction={() => router.push("/add-person")}
        />

        {patients.map((patient) => {
          const patientOverview = overview[patient.id];
          const active = activePatient?.id === patient.id;

          return (
            <Card
              key={patient.id}
              style={[
                styles.patientCard,
                active && styles.selectedCard,
              ]}
            >
              <Pressable
                testID={`select-patient-${patient.id}`}
                onPress={() => setActivePatient(patient)}
                style={styles.patientMain}
              >
                <View style={styles.patientAvatar}>
                  <Ionicons
                    name={
                      patient.is_self
                        ? "person-circle"
                        : "person"
                    }
                    size={28}
                    color={colors.brandPrimary}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={styles.patientName}>
                    {patient.name}
                    {patient.is_self ? " (Ich)" : ""}
                  </Text>

                  <Text style={styles.patientMeta}>
                    {patientOverview
                      ? `${patientOverview.taken} eingenommen · ${patientOverview.missed} vergessen`
                      : "—"}
                  </Text>
                </View>

                {patientOverview && (
                  <View
                    style={[
                      styles.rateBadge,
                      {
                        backgroundColor:
                          patientOverview.adherence >= 80
                            ? "#E7F5EF"
                            : "#FDF3E6",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          patientOverview.adherence >= 80
                            ? colors.success
                            : colors.warning,
                        fontWeight: "800",
                      }}
                    >
                      {patientOverview.adherence}%
                    </Text>
                  </View>
                )}
              </Pressable>

              {!patient.is_self && (
                <Pressable
                  testID={`delete-patient-${patient.id}`}
                  onPress={() => removePatient(patient.id)}
                  style={styles.deleteButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.error}
                  />
                </Pressable>
              )}
            </Card>
          );
        })}

        <SectionTitle
          title="Gespeicherte Pflegekräfte"
          action="+ Hinzufügen"
          onAction={() => router.push("/add-caregiver")}
        />

        {caregivers.length === 0 ? (
          <Text style={styles.emptyText}>
            Noch keine Pflegekraft gespeichert.
          </Text>
        ) : (
          caregivers.map((caregiver) => {
            const active =
              activeCaregiverId === caregiver.id;

            return (
              <Card
                key={caregiver.id}
                style={[
                  styles.caregiverCard,
                  active && styles.selectedCard,
                ]}
              >
                <Pressable
                  testID={`select-caregiver-${caregiver.id}`}
                  onPress={() =>
                    setActiveCaregiverId(caregiver.id)
                  }
                  style={styles.caregiverMain}
                >
                  <View style={styles.caregiverAvatar}>
                    <Ionicons
                      name="medical"
                      size={26}
                      color={colors.brandPrimary}
                    />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={styles.caregiverName}>
                      {caregiver.first_name}{" "}
                      {caregiver.last_name}
                    </Text>

                    <Text style={styles.caregiverMeta}>
                      {caregiver.professional_role ||
                        "Pflegekraft"}
                    </Text>

                    {!!caregiver.organization && (
                      <Text style={styles.caregiverMeta}>
                        {caregiver.organization}
                      </Text>
                    )}

                    {!!caregiver.work_area && (
                      <Text style={styles.caregiverMeta}>
                        {caregiver.work_area}
                      </Text>
                    )}
                  </View>

                  {active && (
                    <Ionicons
                      name="checkmark-circle"
                      size={28}
                      color={colors.success}
                    />
                  )}
                </Pressable>

                <Pressable
                  testID={`delete-caregiver-${caregiver.id}`}
                  onPress={() =>
                    removeCaregiver(caregiver.id)
                  }
                  style={styles.deleteButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.error}
                  />
                </Pressable>
              </Card>
            );
          })
        )}

        <Pressable
          testID="logout-button"
          onPress={logout}
          style={styles.logout}
        >
          <Ionicons
            name="log-out-outline"
            size={20}
            color={colors.error}
          />

          <Text style={styles.logoutText}>
            Abmelden
          </Text>
        </Pressable>

        <Text style={styles.footerBrand}>
          VYLNAX PRO · Intelligent. Sicher. Menschlich.
        </Text>
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
    backgroundColor: colors.surface,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  title: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.onSurface,
    paddingHorizontal: spacing.lg,
  },

  userCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },

  avatarFallback: {
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },

  avatarInit: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
  },

  userName: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.onSurface,
  },

  userEmail: {
    fontSize: 13,
    color: colors.onSurfaceTertiary,
    marginTop: 2,
  },

  roleRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },

  roleChip: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  roleActive: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },

  roleText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.brandPrimary,
    textAlign: "center",
  },

  roleTextActive: {
    color: "#FFFFFF",
  },

  patientCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
  },

  patientMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },

  patientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },

  patientName: {
    fontSize: font.lg,
    fontWeight: "700",
    color: colors.onSurface,
  },

  patientMeta: {
    fontSize: 12,
    color: colors.onSurfaceTertiary,
    marginTop: 2,
  },

  rateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },

  selectedCard: {
    borderColor: colors.brandPrimary,
    borderWidth: 2,
  },

  caregiverCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
  },

  caregiverMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },

  caregiverAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },

  caregiverName: {
    fontSize: font.lg,
    fontWeight: "700",
    color: colors.onSurface,
  },

  caregiverMeta: {
    fontSize: 12,
    color: colors.onSurfaceTertiary,
    marginTop: 2,
  },

  emptyText: {
    fontSize: 14,
    color: colors.onSurfaceTertiary,
    marginBottom: spacing.lg,
  },

  deleteButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },

  logout: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: spacing.xl,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },

  logoutText: {
    color: colors.error,
    fontWeight: "800",
    fontSize: font.lg,
  },

  footerBrand: {
    textAlign: "center",
    color: colors.onSurfaceTertiary,
    fontSize: 12,
    marginTop: spacing.xl,
  },
});