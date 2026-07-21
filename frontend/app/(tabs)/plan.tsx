import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { colors, spacing, radius, font } from "@/src/theme";
import { api, todayStr } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import {
  Card,
  StatusBadge,
  PrimaryButton,
} from "@/src/components/ui";
import { PatientSwitcher } from "@/src/components/shared";

const DAY_NAMES = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

type AccessRole =
  | "patient"
  | "relative"
  | "caregiver"
  | "doctor"
  | string;

type ScheduleItem = {
  medication_id: string;
  time: string;
  name: string;
  dosage?: string;
  form?: string;
  color?: string;
  status?: string;
};

type ScheduleResponse = {
  items?: ScheduleItem[];
};

function weekDates(offset: number): Date[] {
  const now = new Date();
  const monday = new Date(now);
  const day = (now.getDay() + 6) % 7;

  monday.setDate(now.getDate() - day + offset * 7);

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return date;
  });
}

function normalizeRole(role?: string | null): AccessRole {
  return String(role || "")
    .trim()
    .toLowerCase();
}

export default function Plan() {
  const { activePatient } = useApp();
  const { user } = useAuth();

  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [selected, setSelected] = useState(new Date());
  const [items, setItems] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionKey, setActionKey] = useState<string | null>(
    null
  );
  const [weekOffset] = useState(0);

  const dates = useMemo(
    () => weekDates(weekOffset),
    [weekOffset]
  );

  const role = normalizeRole(user?.role);

  const canEditTherapy =
    role === "caregiver" || role === "doctor";

  const canRecordIntake =
    role === "patient" ||
    role === "caregiver" ||
    role === "doctor";

  const isReadOnly = role === "relative";

  const load = useCallback(async () => {
    if (!activePatient) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const response = await api<ScheduleResponse>(
        `/patients/${activePatient.id}/schedule?date_str=${todayStr(
          selected
        )}`
      );

      setItems(
        Array.isArray(response?.items)
          ? response.items
          : []
      );
    } catch (error) {
      console.error(
        "Fehler beim Laden des Medikamentenplans:",
        error
      );
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activePatient, selected]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      void load();
    }, [load])
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const showNoIntakePermission = () => {
    Alert.alert(
      "Keine Berechtigung",
      "Angehörige dürfen den Medikamentenplan nur ansehen. Einnahmen können nur vom Patienten, von einer Pflegekraft oder von einem Arzt dokumentiert werden."
    );
  };

  const showNoTherapyPermission = () => {
    Alert.alert(
      "Keine Berechtigung",
      "Medikamente dürfen nur von einer Pflegekraft oder einem Arzt hinzugefügt oder geändert werden."
    );
  };

  const act = async (
    item: ScheduleItem,
    status: "taken" | "missed"
  ) => {
    if (!activePatient) {
      Alert.alert(
        "Kein Patient ausgewählt",
        "Bitte wählen Sie zuerst einen Patienten aus."
      );
      return;
    }

    if (!canRecordIntake) {
      showNoIntakePermission();
      return;
    }

    const key = `${item.medication_id}-${item.time}-${status}`;

    if (actionKey) {
      return;
    }

    try {
      setActionKey(key);

      if (Platform.OS !== "web") {
        await Haptics.selectionAsync();
      }

      await api("/intake", {
        method: "POST",
        body: {
          patient_id: activePatient.id,
          medication_id: item.medication_id,
          scheduled_date: todayStr(selected),
          scheduled_time: item.time,
          status,
        },
      });

      await load();
    } catch (error) {
      console.error(
        "Fehler beim Speichern der Einnahme:",
        error
      );

      Alert.alert(
        "Speichern nicht möglich",
        "Die Einnahme konnte nicht gespeichert werden. Bitte versuchen Sie es erneut."
      );
    } finally {
      setActionKey(null);
    }
  };

  const openAddMedication = () => {
    if (!activePatient) {
      Alert.alert(
        "Kein Patient ausgewählt",
        "Bitte wählen Sie zuerst einen Patienten aus."
      );
      return;
    }

    if (!canEditTherapy) {
      showNoTherapyPermission();
      return;
    }

    router.push({
      pathname: "/add-medication",
      params: {
        patientId: activePatient.id,
      },
    });
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
        <Text style={styles.title}>
          Medikamentenplan
        </Text>

        <PatientSwitcher />

        <View style={styles.weekRow}>
          {dates.map((date, index) => {
            const active =
              todayStr(date) === todayStr(selected);

            const isToday =
              todayStr(date) === todayStr();

            return (
              <Pressable
                key={todayStr(date)}
                testID={`day-${index}`}
                onPress={() => setSelected(date)}
                style={[
                  styles.dayCol,
                  active && styles.dayColActive,
                ]}
              >
                <Text
                  style={[
                    styles.dayName,
                    active && styles.activeDayText,
                  ]}
                >
                  {DAY_NAMES[index]}
                </Text>

                <Text
                  style={[
                    styles.dayNum,
                    active && styles.activeDayText,
                    isToday &&
                      !active &&
                      styles.todayText,
                  ]}
                >
                  {date.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: canEditTherapy
              ? 150
              : 110,
          },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
          />
        }
      >
        {isReadOnly && (
          <Card style={styles.permissionCard}>
            <Ionicons
              name="eye-outline"
              size={22}
              color={colors.brandPrimary}
            />

            <View style={styles.permissionTextWrap}>
              <Text style={styles.permissionTitle}>
                Nur Lesezugriff
              </Text>

              <Text style={styles.permissionText}>
                Als Angehörige/r können Sie den
                Medikamentenplan ansehen, aber keine
                Einnahmen oder Therapieänderungen
                speichern.
              </Text>
            </View>
          </Card>
        )}

        {loading ? (
          <ActivityIndicator
            color={colors.brandPrimary}
            style={styles.loader}
          />
        ) : items.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Ionicons
              name="calendar-clear-outline"
              size={40}
              color={colors.borderStrong}
            />

            <Text style={styles.emptyT}>
              Keine Einnahmen an diesem Tag
            </Text>
          </Card>
        ) : (
          items.map((item) => {
            const takenKey = `${item.medication_id}-${item.time}-taken`;
            const missedKey = `${item.medication_id}-${item.time}-missed`;
            const isSaving =
              actionKey === takenKey ||
              actionKey === missedKey;

            return (
              <View
                key={`${item.medication_id}-${item.time}`}
                style={styles.tlRow}
              >
                <View style={styles.tlLeft}>
                  <Text style={styles.tlTime}>
                    {item.time}
                  </Text>

                  <View
                    style={[
                      styles.tlDot,
                      {
                        backgroundColor:
                          item.color ||
                          colors.brandPrimary,
                      },
                    ]}
                  />
                </View>

                <Card style={styles.tlCard}>
                  <View style={styles.medicationContent}>
                    <Text style={styles.medName}>
                      {item.name}
                    </Text>

                    <Text style={styles.medDose}>
                      {[item.dosage, item.form]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>

                    <View style={styles.statusWrap}>
                    <StatusBadge
  status={
    item.status === "taken"
      ? "taken"
      : item.status === "missed"
        ? "missed"
        : "pending"
  }
/>  
                    </View>
                  </View>

                  {item.status !== "taken" &&
                    canRecordIntake && (
                      <View style={styles.actionColumn}>
                        <Pressable
                          testID={`take-${item.medication_id}-${item.time}`}
                          disabled={isSaving}
                          onPress={() =>
                            void act(item, "taken")
                          }
                          style={[
                            styles.smallBtn,
                            styles.takenButton,
                            isSaving &&
                              styles.disabledButton,
                          ]}
                        >
                          {actionKey === takenKey ? (
                            <ActivityIndicator
                              size="small"
                              color="#FFFFFF"
                            />
                          ) : (
                            <Ionicons
                              name="checkmark"
                              size={20}
                              color="#FFFFFF"
                            />
                          )}
                        </Pressable>

                        <Pressable
                          testID={`miss-${item.medication_id}-${item.time}`}
                          disabled={isSaving}
                          onPress={() =>
                            void act(item, "missed")
                          }
                          style={[
                            styles.smallBtn,
                            styles.missedButton,
                            isSaving &&
                              styles.disabledButton,
                          ]}
                        >
                          {actionKey === missedKey ? (
                            <ActivityIndicator
                              size="small"
                              color={colors.error}
                            />
                          ) : (
                            <Ionicons
                              name="close"
                              size={20}
                              color={colors.error}
                            />
                          )}
                        </Pressable>
                      </View>
                    )}
                </Card>
              </View>
            );
          })
        )}
      </ScrollView>

      {canEditTherapy && (
        <View
          style={[
            styles.footer,
            {
              paddingBottom:
                insets.bottom + 76,
            },
          ]}
        >
          <PrimaryButton
            testID="add-medication-button"
            label="Medikament hinzufügen"
            icon="add"
            onPress={openAddMedication}
          />
        </View>
      )}
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
    marginBottom: spacing.sm,
  },

  weekRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    gap: 4,
  },

  dayCol: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: radius.md,
  },

  dayColActive: {
    backgroundColor: colors.brandPrimary,
  },

  dayName: {
    fontSize: 12,
    color: colors.onSurfaceTertiary,
    fontWeight: "600",
  },

  dayNum: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: 2,
  },

  activeDayText: {
    color: "#FFFFFF",
  },

  todayText: {
    color: colors.brandPrimary,
  },

  scrollContent: {
    padding: spacing.lg,
  },

  permissionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
  },

  permissionTextWrap: {
    flex: 1,
  },

  permissionTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.onSurface,
  },

  permissionText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceTertiary,
    marginTop: 3,
  },

  loader: {
    marginTop: 60,
  },

  emptyCard: {
    alignItems: "center",
    paddingVertical: spacing["2xl"],
  },

  emptyT: {
    color: colors.onSurfaceSecondary,
    fontWeight: "600",
    marginTop: spacing.sm,
  },

  tlRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },

  tlLeft: {
    alignItems: "center",
    width: 52,
  },

  tlTime: {
    fontSize: 14,
    fontWeight: "800",
    color: colors.brand,
  },

  tlDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginTop: 6,
  },

  tlCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },

  medicationContent: {
    flex: 1,
  },

  medName: {
    fontSize: font.lg,
    fontWeight: "700",
    color: colors.onSurface,
  },

  medDose: {
    fontSize: 13,
    color: colors.onSurfaceTertiary,
    marginTop: 2,
  },

  statusWrap: {
    marginTop: spacing.sm,
  },

  actionColumn: {
    gap: 8,
  },

  smallBtn: {
    width: 44,
    height: 40,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },

  takenButton: {
    backgroundColor: colors.success,
  },

  missedButton: {
    backgroundColor: colors.surfaceTertiary,
  },

  disabledButton: {
    opacity: 0.55,
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});