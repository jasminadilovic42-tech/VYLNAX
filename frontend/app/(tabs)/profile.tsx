import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  colors,
  font,
  radius,
  spacing,
} from "@/src/theme";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";
import { useApp } from "@/src/context/AppContext";
import {
  AccessUser,
  useAccess,
} from "@/src/context/AccessContext";
import { Card } from "@/src/components/ui";
import { SectionTitle } from "@/src/components/shared";

type BaseRecord = {
  id?: string;
  _id?: string;
};

type Relative = BaseRecord & {
  patient_id?: string;
  first_name?: string;
  last_name?: string;
  birth_date?: string | null;
  gender?: string | null;
  relationship?: string | null;
  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;
  is_primary_contact?: boolean;
  available_for_emergency?: boolean;
  notes?: string | null;
};

type Caregiver = BaseRecord & {
  patient_id?: string;
  first_name?: string;
  last_name?: string;
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

type Doctor = BaseRecord & {
  patient_id?: string;
  title?: string | null;
  first_name?: string;
  last_name?: string;
  specialization?: string | null;
  contact_type?: string | null;
  practice_name?: string | null;
  practice_address?: string | null;
  phone?: string | null;
  emergency_phone?: string | null;
  fax?: string | null;
  email?: string | null;
  website?: string | null;
  opening_hours?: string | null;
  consultation_notes?: string | null;
  is_primary_doctor?: boolean;
  available_for_emergency?: boolean;
  notes?: string | null;
};

type SelectedProfile =
  | {
      type: "patient";
      id: string;
    }
  | {
      type: "relative";
      id: string;
    }
  | {
      type: "caregiver";
      id: string;
    }
  | {
      type: "doctor";
      id: string;
    }
  | null;

function recordId(
  record: BaseRecord,
  fallback: string
): string {
  return String(record.id ?? record._id ?? fallback);
}

function serverRecordId(
  record: BaseRecord
): string | null {
  const value = record.id ?? record._id;

  return value ? String(value) : null;
}

function fullName(
  firstName?: string,
  lastName?: string,
  fallback = "Ohne Namen"
): string {
  const value = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return value || fallback;
}

function accessRoleLabel(role?: string): string {
  switch (String(role || "").toLowerCase()) {
    case "patient":
      return "Patient";
    case "relative":
      return "Angehörige/r";
    case "caregiver":
      return "Pflegekraft";
    case "doctor":
      return "Arzt";
    default:
      return role || "Benutzer";
  }
}

function accessUserName(accessUser: AccessUser): string {
  const value = String(
    accessUser.name ||
      [accessUser.first_name, accessUser.last_name]
        .filter(Boolean)
        .join(" ")
  ).trim();

  return value || "VYLNAX Benutzer";
}

function normalizeRole(role?: string | null): string {
  return String(role || "")
    .trim()
    .toLowerCase();
}

function profileRoleLabel(role?: string | null): string {
  switch (normalizeRole(role)) {
    case "patient":
      return "Patient:in";
    case "relative":
      return "Angehörige:r";
    case "caregiver":
      return "Pflegekraft";
    case "doctor":
      return "Hausarzt";
    default:
      return "Benutzer";
  }
}

function profileRoleIcon(
  role?: string | null
): keyof typeof Ionicons.glyphMap {
  switch (normalizeRole(role)) {
    case "patient":
      return "person";
    case "relative":
      return "people";
    case "doctor":
      return "medkit";
    case "caregiver":
      return "medical";
    default:
      return "person-circle";
  }
}

export default function Profile() {
  const { user, logout } = useAuth();

  const role = normalizeRole(user?.role);
  const canManageProfiles = role === "caregiver";

  const {
    patients,
    activePatient,
    setActivePatient,
    loadPatients,
  } = useApp();

  const {
    accessUsers,
    loadAccessUsers,
  } = useAccess();

  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [overview, setOverview] = useState<
    Record<string, any>
  >({});

  const [relatives, setRelatives] = useState<Relative[]>(
    []
  );

  const [caregivers, setCaregivers] = useState<
    Caregiver[]
  >([]);

  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const [selectedProfile, setSelectedProfile] =
    useState<SelectedProfile>(null);

  const [accessBusy, setAccessBusy] = useState(false);

  const loadOverview = useCallback(async () => {
    const map: Record<string, any> = {};

    await Promise.all(
      patients.map(async (patient) => {
        try {
          map[patient.id] = await api(
            `/patients/${patient.id}/reports?period=day`
          );
        } catch {
          // Za ovog pacijenta trenutno nema izvještaja.
        }
      })
    );

    setOverview(map);
  }, [patients]);

  const loadRelatives = useCallback(async () => {
    try {
      if (!activePatient?.id) {
        setRelatives([]);
        return;
      }

      const result = await api(
        `/relatives?patient_id=${encodeURIComponent(activePatient.id)}`
      );

      setRelatives(
        Array.isArray(result) ? result : []
      );
    } catch (error) {
      console.error(
        "Fehler beim Laden der Angehörigen:",
        error
      );
      setRelatives([]);
    }
  }, [activePatient?.id]);

  const loadCaregivers = useCallback(async () => {
    try {
      if (!activePatient?.id) {
        setCaregivers([]);
        return;
      }

      const result = await api(
        `/caregivers?patient_id=${encodeURIComponent(activePatient.id)}`
      );

      setCaregivers(
        Array.isArray(result) ? result : []
      );
    } catch (error) {
      console.error(
        "Fehler beim Laden der Pflegekräfte:",
        error
      );
      setCaregivers([]);
    }
  }, [activePatient?.id]);

  const loadDoctors = useCallback(async () => {
    try {
      if (!activePatient?.id) {
        setDoctors([]);
        return;
      }

      const result = await api(
        `/doctors?patient_id=${encodeURIComponent(activePatient.id)}`
      );

      setDoctors(Array.isArray(result) ? result : []);
    } catch (error) {
      console.error(
        "Fehler beim Laden der Hausärzte:",
        error
      );
      setDoctors([]);
    }
  }, [activePatient?.id]);

  const reloadAllProfiles = useCallback(() => {
    void loadPatients();
    void loadRelatives();
    void loadCaregivers();
    void loadDoctors();

    if (canManageProfiles) {
      void loadAccessUsers();
    }
  }, [
    loadPatients,
    loadRelatives,
    loadCaregivers,
    loadDoctors,
    loadAccessUsers,
    canManageProfiles,
  ]);

  useFocusEffect(
    useCallback(() => {
      reloadAllProfiles();
    }, [reloadAllProfiles])
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const removePatient = async (id: string) => {
    if (!canManageProfiles) {
      return;
    }

    try {
      await api(`/patients/${id}`, {
        method: "DELETE",
      });

      if (
        selectedProfile?.type === "patient" &&
        selectedProfile.id === id
      ) {
        setSelectedProfile(null);
      }

      await loadPatients();
    } catch (error) {
      console.error(
        "Fehler beim Löschen des Patienten:",
        error
      );
    }
  };

  const removeRelative = async (relative: Relative) => {
    if (!canManageProfiles) {
      return;
    }

    const id = serverRecordId(relative);

    if (!id) {
      Alert.alert(
        "Löschen nicht möglich",
        "Für diese Person wurde keine gültige ID geladen."
      );
      return;
    }

    try {
      await api(`/relatives/${id}`, {
        method: "DELETE",
      });

      if (
        selectedProfile?.type === "relative" &&
        selectedProfile.id === id
      ) {
        setSelectedProfile(null);
      }

      await loadRelatives();
    } catch (error) {
      console.error(
        "Fehler beim Löschen des Angehörigen:",
        error
      );
    }
  };

  const removeCaregiver = async (
    caregiver: Caregiver
  ) => {
    if (!canManageProfiles) {
      return;
    }

    const id = serverRecordId(caregiver);

    if (!id) {
      Alert.alert(
        "Löschen nicht möglich",
        "Für diese Pflegekraft wurde keine gültige ID geladen."
      );
      return;
    }

    try {
      await api(`/caregivers/${id}`, {
        method: "DELETE",
      });

      if (
        selectedProfile?.type === "caregiver" &&
        selectedProfile.id === id
      ) {
        setSelectedProfile(null);
      }

      await loadCaregivers();
    } catch (error) {
      console.error(
        "Fehler beim Löschen der Pflegekraft:",
        error
      );
    }
  };

  const removeDoctor = async (doctor: Doctor) => {
    if (!canManageProfiles) {
      return;
    }

    const id = serverRecordId(doctor);

    if (!id) {
      Alert.alert(
        "Löschen nicht möglich",
        "Für diesen Arzt wurde keine gültige ID geladen."
      );
      return;
    }

    try {
      await api(`/doctors/${id}`, {
        method: "DELETE",
      });

      if (
        selectedProfile?.type === "doctor" &&
        selectedProfile.id === id
      ) {
        setSelectedProfile(null);
      }

      await loadDoctors();
    } catch (error) {
      console.error(
        "Fehler beim Löschen des Hausarztes:",
        error
      );
    }
  };

  const selectedAccessData = useCallback(() => {
    if (!selectedProfile) {
      return null;
    }

    if (selectedProfile.type === "patient") {
      const patient = patients.find(
        (item) => item.id === selectedProfile.id
      );

      if (!patient) {
        return null;
      }

      return {
        name: patient.name || "Patient",
        role: "patient",
        source_id: patient.id,
        patient_id: patient.id,
      };
    }

    if (!activePatient?.id) {
      return null;
    }

    if (selectedProfile.type === "relative") {
      const relative = relatives.find(
        (item, index) =>
          recordId(item, `relative-${index}`) ===
          selectedProfile.id
      );

      const sourceId = relative
        ? serverRecordId(relative)
        : null;

      if (!relative || !sourceId) {
        return null;
      }

      return {
        name: fullName(
          relative.first_name,
          relative.last_name,
          "Angehörige Person"
        ),
        role: "relative",
        source_id: sourceId,
        patient_id: activePatient.id,
      };
    }

    if (selectedProfile.type === "caregiver") {
      const caregiver = caregivers.find(
        (item, index) =>
          recordId(item, `caregiver-${index}`) ===
          selectedProfile.id
      );

      const sourceId = caregiver
        ? serverRecordId(caregiver)
        : null;

      if (!caregiver || !sourceId) {
        return null;
      }

      return {
        name: fullName(
          caregiver.first_name,
          caregiver.last_name,
          "Pflegekraft"
        ),
        role: "caregiver",
        source_id: sourceId,
        patient_id: activePatient.id,
      };
    }

    const doctor = doctors.find(
      (item, index) =>
        recordId(item, `doctor-${index}`) ===
        selectedProfile.id
    );

    const sourceId = doctor
      ? serverRecordId(doctor)
      : null;

    if (!doctor || !sourceId) {
      return null;
    }

    return {
      name:
        [
          doctor.title,
          doctor.first_name,
          doctor.last_name,
        ]
          .filter(Boolean)
          .join(" ")
          .trim() || "Hausarzt",
      role: "doctor",
      source_id: sourceId,
      patient_id: activePatient.id,
    };
  }, [
    selectedProfile,
    patients,
    relatives,
    caregivers,
    doctors,
    activePatient,
  ]);

  const createAccessForSelectedProfile = async () => {
    if (!canManageProfiles) {
      return;
    }

    const data = selectedAccessData();

    if (!selectedProfile) {
      Alert.alert(
        "Person auswählen",
        "Wählen Sie zuerst oben einen Patienten, Angehörigen, eine Pflegekraft oder einen Arzt aus."
      );
      return;
    }

    if (!data) {
      Alert.alert(
        "Zugang nicht möglich",
        "Für Angehörige, Pflegekräfte und Ärzte muss zuerst ein aktiver Patient ausgewählt sein. Außerdem wird eine gültige Datensatz-ID benötigt."
      );
      return;
    }

    const duplicate = accessUsers.some(
      (item) =>
        String((item as any).source_id || "") ===
          data.source_id &&
        String(item.role || "").toLowerCase() ===
          data.role
    );

    if (duplicate) {
      Alert.alert(
        "Zugang bereits vorhanden",
        "Für diese Person existiert bereits ein Zugangsprofil."
      );
      return;
    }

    setAccessBusy(true);

    try {
      await api("/access-users", {
        method: "POST",
        body: {
          name: data.name,
          role: data.role,
          pin: "0000",
          source_id: data.source_id,
          patient_id: data.patient_id,
          active: true,
        },
      });

      await loadAccessUsers();

      Alert.alert(
        "Zugang erstellt",
        `${data.name} kann sich jetzt mit dem vorläufigen PIN 0000 anmelden.`
      );
    } catch (error: any) {
      Alert.alert(
        "Zugang konnte nicht erstellt werden",
        error?.message ||
          "Bitte versuchen Sie es erneut."
      );
    } finally {
      setAccessBusy(false);
    }
  };

  const removeAccessUser = async (
    accessUser: AccessUser
  ) => {
    if (!canManageProfiles || !accessUser.id) {
      return;
    }

    setAccessBusy(true);

    try {
      await api(`/access-users/${accessUser.id}`, {
        method: "DELETE",
      });

      await loadAccessUsers();
    } catch (error: any) {
      Alert.alert(
        "Zugang konnte nicht gelöscht werden",
        error?.message ||
          "Bitte versuchen Sie es erneut."
      );
    } finally {
      setAccessBusy(false);
    }
  };

  const confirmDelete = (
    title: string,
    message: string,
    action: () => void
  ) => {
    Alert.alert(title, message, [
      {
        text: "Abbrechen",
        style: "cancel",
      },
      {
        text: "Löschen",
        style: "destructive",
        onPress: action,
      },
    ]);
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
          paddingBottom: 140,
        }}
      >
        <Card style={styles.userCard}>
          {user?.picture ? (
            <Image
              source={{ uri: user.picture }}
              style={styles.avatar}
            />
          ) : (
            <View
              style={[
                styles.avatar,
                styles.avatarFallback,
              ]}
            >
              <Text style={styles.avatarInit}>
                {(user?.name || "V")
                  .charAt(0)
                  .toUpperCase()}
              </Text>
            </View>
          )}

          <View style={styles.flexOne}>
            <Text style={styles.userName}>
              {user?.name || "VYLNAX Benutzer"}
            </Text>

            <Text style={styles.userEmail}>
              {user?.email || ""}
            </Text>
          </View>
        </Card>

        <SectionTitle title="Meine Rolle" />

        <Card style={styles.currentRoleCard}>
          <View style={styles.currentRoleIcon}>
            <Ionicons
              name={profileRoleIcon(user?.role)}
              size={25}
              color={colors.brandPrimary}
            />
          </View>

          <View style={styles.flexOne}>
            <Text style={styles.currentRoleLabel}>
              {profileRoleLabel(user?.role)}
            </Text>

            <Text style={styles.currentRoleInfo}>
              Die Rolle wird durch den persönlichen PIN-Zugang
              festgelegt und kann hier nicht geändert werden.
            </Text>
          </View>

          <Ionicons
            name="lock-closed"
            size={20}
            color={colors.onSurfaceTertiary}
          />
        </Card>

        <SectionTitle
          title="Betreute Personen"
          action={canManageProfiles ? "+ Hinzufügen" : undefined}
          onAction={
            canManageProfiles
              ? () => router.push("/add-person")
              : undefined
          }
        />

        {patients.length === 0 && (
          <Text style={styles.emptyText}>
            Noch keine betreute Person gespeichert.
          </Text>
        )}

        {patients.map((patient) => {
          const patientOverview =
            overview[patient.id];

          const active =
            activePatient?.id === patient.id;

          return (
            <Card
              key={patient.id}
              style={[
                styles.personCard,
                active && styles.selectedCard,
              ]}
            >
              <Pressable
                testID={`select-patient-${patient.id}`}
                onPress={() => {
                  setActivePatient(patient);
                  setSelectedProfile({
                    type: "patient",
                    id: patient.id,
                  });
                }}
                style={styles.personMain}
              >
                <View style={styles.personAvatar}>
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

                <View style={styles.flexOne}>
                  <Text style={styles.personName}>
                    {patient.name}
                    {patient.is_self ? " (Ich)" : ""}
                  </Text>

                  <Text style={styles.personMeta}>
                    {patientOverview
                      ? `${patientOverview.taken} eingenommen · ${patientOverview.missed} vergessen`
                      : "Keine Tagesdaten"}
                  </Text>
                </View>

                {patientOverview && (
                  <View
                    style={[
                      styles.rateBadge,
                      {
                        backgroundColor:
                          patientOverview.adherence >=
                          80
                            ? "#E7F5EF"
                            : "#FDF3E6",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          patientOverview.adherence >=
                          80
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

              {canManageProfiles && !patient.is_self && (
                <Pressable
                  onPress={() =>
                    confirmDelete(
                      "Patient löschen",
                      "Möchten Sie diese betreute Person wirklich löschen?",
                      () =>
                        void removePatient(patient.id)
                    )
                  }
                  style={styles.deleteButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={19}
                    color={colors.error}
                  />
                </Pressable>
              )}
            </Card>
          );
        })}

        <SectionTitle
          title="Gespeicherte Angehörige"
          action={canManageProfiles ? "+ Hinzufügen" : undefined}
          onAction={
            canManageProfiles
              ? () => router.push("/add-relative")
              : undefined
          }
        />

        {relatives.length === 0 && (
          <Text style={styles.emptyText}>
            Noch kein Angehöriger gespeichert.
          </Text>
        )}

        {relatives.map((relative, index) => {
          const id = recordId(
            relative,
            `relative-${index}`
          );

          const active =
            selectedProfile?.type === "relative" &&
            selectedProfile.id === id;

          return (
            <Card
              key={id}
              style={[
                styles.personCard,
                active && styles.selectedCard,
              ]}
            >
              <Pressable
                onPress={() =>
                  setSelectedProfile({
                    type: "relative",
                    id,
                  })
                }
                style={styles.personMain}
              >
                <View style={styles.personAvatar}>
                  <Ionicons
                    name="people"
                    size={27}
                    color={colors.brandPrimary}
                  />
                </View>

                <View style={styles.flexOne}>
                  <Text style={styles.personName}>
                    {fullName(
                      relative.first_name,
                      relative.last_name,
                      "Angehörige Person"
                    )}
                  </Text>

                  <Text style={styles.personMeta}>
                    {relative.relationship ||
                      "Angehörige/r"}
                  </Text>

                  {!!relative.mobile && (
                    <Text style={styles.personMeta}>
                      {relative.mobile}
                    </Text>
                  )}

                  {!!relative.email && (
                    <Text style={styles.personMeta}>
                      {relative.email}
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

              {canManageProfiles && (
                <Pressable
                  onPress={() =>
                    confirmDelete(
                      "Angehörigen löschen",
                      "Möchten Sie diese Kontaktperson wirklich löschen?",
                      () =>
                        void removeRelative(relative)
                    )
                  }
                  style={styles.deleteButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={19}
                    color={colors.error}
                  />
                </Pressable>
              )}
            </Card>
          );
        })}

        <SectionTitle
          title="Gespeicherte Pflegekräfte"
          action={canManageProfiles ? "+ Hinzufügen" : undefined}
          onAction={
            canManageProfiles
              ? () => router.push("/add-caregiver")
              : undefined
          }
        />

        {caregivers.length === 0 && (
          <Text style={styles.emptyText}>
            Noch keine Pflegekraft gespeichert.
          </Text>
        )}

        {caregivers.map((caregiver, index) => {
          const id = recordId(
            caregiver,
            `caregiver-${index}`
          );

          const active =
            selectedProfile?.type === "caregiver" &&
            selectedProfile.id === id;

          return (
            <Card
              key={id}
              style={[
                styles.personCard,
                active && styles.selectedCard,
              ]}
            >
              <Pressable
                onPress={() =>
                  setSelectedProfile({
                    type: "caregiver",
                    id,
                  })
                }
                style={styles.personMain}
              >
                <View style={styles.personAvatar}>
                  <Ionicons
                    name="medical"
                    size={27}
                    color={colors.brandPrimary}
                  />
                </View>

                <View style={styles.flexOne}>
                  <Text style={styles.personName}>
                    {fullName(
                      caregiver.first_name,
                      caregiver.last_name,
                      "Pflegekraft"
                    )}
                  </Text>

                  <Text style={styles.personMeta}>
                    {caregiver.professional_role ||
                      "Pflegekraft"}
                  </Text>

                  {!!caregiver.work_area && (
                    <Text style={styles.personMeta}>
                      {caregiver.work_area}
                    </Text>
                  )}

                  {!!caregiver.organization && (
                    <Text style={styles.personMeta}>
                      {caregiver.organization}
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

              {canManageProfiles && (
                <Pressable
                  onPress={() =>
                    confirmDelete(
                      "Pflegekraft löschen",
                      "Möchten Sie diese Pflegekraft wirklich löschen?",
                      () =>
                        void removeCaregiver(caregiver)
                    )
                  }
                  style={styles.deleteButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={19}
                    color={colors.error}
                  />
                </Pressable>
              )}
            </Card>
          );
        })}

        <SectionTitle
          title="Gespeicherte Hausärzte"
          action={canManageProfiles ? "+ Hinzufügen" : undefined}
          onAction={
            canManageProfiles
              ? () => router.push("/add-doctor")
              : undefined
          }
        />

        {doctors.length === 0 && (
          <Text style={styles.emptyText}>
            Noch kein Hausarzt gespeichert.
          </Text>
        )}

        {doctors.map((doctor, index) => {
          const id = recordId(
            doctor,
            `doctor-${index}`
          );

          const active =
            selectedProfile?.type === "doctor" &&
            selectedProfile.id === id;

          return (
            <Card
              key={id}
              style={[
                styles.personCard,
                active && styles.selectedCard,
              ]}
            >
              <Pressable
                onPress={() =>
                  setSelectedProfile({
                    type: "doctor",
                    id,
                  })
                }
                style={styles.personMain}
              >
                <View style={styles.personAvatar}>
                  <Ionicons
                    name="medkit"
                    size={26}
                    color={colors.brandPrimary}
                  />
                </View>

                <View style={styles.flexOne}>
                  <Text style={styles.personName}>
                    {[
                      doctor.title,
                      doctor.first_name,
                      doctor.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ") || "Hausarzt"}
                  </Text>

                  <Text style={styles.personMeta}>
                    {doctor.specialization ||
                      doctor.contact_type ||
                      "Hausarzt"}
                  </Text>

                  {!!doctor.practice_name && (
                    <Text style={styles.personMeta}>
                      {doctor.practice_name}
                    </Text>
                  )}

                  {!!doctor.phone && (
                    <Text style={styles.personMeta}>
                      {doctor.phone}
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

              {canManageProfiles && (
                <Pressable
                  onPress={() =>
                    confirmDelete(
                      "Hausarzt löschen",
                      "Möchten Sie diesen Arzt wirklich löschen?",
                      () => void removeDoctor(doctor)
                    )
                  }
                  style={styles.deleteButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={19}
                    color={colors.error}
                  />
                </Pressable>
              )}
            </Card>
          );
        })}

        {canManageProfiles && (
          <>
          <SectionTitle title="Zugriffsverwaltung" />

          <Card style={styles.accessManagementCard}>
            <View style={styles.accessHeaderRow}>
              <View style={styles.accessHeaderIcon}>
                <Ionicons
                  name="shield-checkmark"
                  size={25}
                  color={colors.brandPrimary}
                />
              </View>

              <View style={styles.flexOne}>
                <Text style={styles.accessTitle}>
                  Medizinische Zugänge
                </Text>

                <Text style={styles.accessDescription}>
                  Wählen Sie oben eine Person aus und erstellen
                  Sie anschließend einen persönlichen Zugang.
                  Der vorläufige PIN lautet 0000.
                </Text>
              </View>
            </View>

            <Pressable
              onPress={() =>
                void createAccessForSelectedProfile()
              }
              disabled={accessBusy}
              style={[
                styles.createAccessButton,
                accessBusy && styles.disabledButton,
              ]}
            >
              <Ionicons
                name="key-outline"
                size={20}
                color="#FFFFFF"
              />

              <Text style={styles.createAccessText}>
                {selectedProfile
                  ? "Zugang für ausgewählte Person erstellen"
                  : "Zuerst Person auswählen"}
              </Text>
            </Pressable>
          </Card>

          {accessUsers.length === 0 ? (
            <Text style={styles.emptyText}>
              Noch kein Zugangsprofil gespeichert.
            </Text>
          ) : (
            accessUsers.map((accessUser) => (
              <Card
                key={accessUser.id}
                style={styles.accessUserCard}
              >
                <View style={styles.accessUserIcon}>
                  <Ionicons
                    name={
                      accessUser.role === "relative"
                        ? "people"
                        : accessUser.role === "patient"
                          ? "person"
                          : accessUser.role === "doctor"
                            ? "medkit"
                            : "medical"
                    }
                    size={23}
                    color={colors.brandPrimary}
                  />
                </View>

                <View style={styles.flexOne}>
                  <Text style={styles.personName}>
                    {accessUserName(accessUser)}
                  </Text>

                  <Text style={styles.personMeta}>
                    {accessRoleLabel(accessUser.role)}
                    {accessUser.active === false
                      ? " · Deaktiviert"
                      : " · Aktiv"}
                  </Text>

                  <Text style={styles.accessPinInfo}>
                    Anmeldung über persönlichen PIN
                  </Text>
                </View>

                <Pressable
                  onPress={() =>
                    confirmDelete(
                      "Zugang löschen",
                      "Möchten Sie dieses Zugangsprofil wirklich löschen?",
                      () =>
                        void removeAccessUser(accessUser)
                    )
                  }
                  disabled={accessBusy}
                  style={styles.deleteButton}
                >
                  <Ionicons
                    name="trash-outline"
                    size={19}
                    color={colors.error}
                  />
                </Pressable>
              </Card>
            ))
          )}
          </>
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
          VYLNAX PRO · Intelligent. Sicher.
          Menschlich.
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

  flexOne: {
    flex: 1,
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
    backgroundColor: colors.brandPrimary,
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

  currentRoleCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.md,
  },

  currentRoleIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },

  currentRoleLabel: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.onSurface,
  },

  currentRoleInfo: {
    marginTop: 3,
    fontSize: 12,
    lineHeight: 17,
    color: colors.onSurfaceTertiary,
  },

  personCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
  },

  selectedCard: {
    borderColor: colors.brandPrimary,
    borderWidth: 2,
  },

  personMain: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flex: 1,
  },

  personAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },

  personName: {
    fontSize: font.lg,
    fontWeight: "700",
    color: colors.onSurface,
  },

  personMeta: {
    fontSize: 12,
    color: colors.onSurfaceTertiary,
    marginTop: 2,
  },

  rateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
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

  accessManagementCard: {
    marginBottom: spacing.md,
    gap: spacing.md,
  },

  accessHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
  },

  accessHeaderIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },

  accessTitle: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.onSurface,
  },

  accessDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: colors.onSurfaceTertiary,
  },

  createAccessButton: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
  },

  createAccessText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },

  disabledButton: {
    opacity: 0.55,
  },

  accessUserCard: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.md,
    paddingVertical: spacing.md,
  },

  accessUserIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    marginRight: spacing.md,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },

  accessPinInfo: {
    marginTop: 3,
    fontSize: 11,
    color: colors.onSurfaceTertiary,
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