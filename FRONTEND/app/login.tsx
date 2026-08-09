import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Alert,
} from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth, AccessUser } from "@/src/context/AuthContext";
import { api } from "@/src/api";
import { VLogo } from "@/src/components/ui";

const labels: Record<AccessUser["role"], string> = {
  patient: "Patient",
  doctor: "Arzt / Ärztin",
  caregiver: "Pflegefachkraft",
  relative: "Angehörige/r",
};

function readableError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error || "Unbekannter Fehler");
  try {
    const parsed = JSON.parse(raw);
    return parsed.detail || parsed.message || raw;
  } catch {
    return raw;
  }
}

export default function Login() {
  const {
    user,
    accessUser,
    accessUsers,
    loading,
    signingIn,
    login,
    loginWithPin,
    refreshAccessUsers,
  } = useAuth();
  const [selected, setSelected] = useState<AccessUser | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [creatingDemo, setCreatingDemo] = useState(false);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!loading && !user) {
      login().catch((error) => Alert.alert("Fehler", readableError(error)));
    }
  }, [loading, user, login]);

  useEffect(() => {
    if (accessUser) router.replace("/(tabs)");
  }, [accessUser, router]);

  const reloadProfiles = useCallback(async () => {
    if (!user) return;
    setRefreshing(true);
    try {
      await refreshAccessUsers();
    } catch (error) {
      console.warn("Profile konnten nicht geladen werden:", readableError(error));
    } finally {
      setRefreshing(false);
    }
  }, [user, refreshAccessUsers]);

  // Važno: nakon povratka sa ekrana „Person hinzufügen“ lista se ponovo učitava.
  useFocusEffect(
    useCallback(() => {
      reloadProfiles();
    }, [reloadProfiles])
  );

  useEffect(() => {
    if (selected && !accessUsers.some((profile) => profile.id === selected.id)) {
      setSelected(null);
      setPin("");
    }
  }, [accessUsers, selected]);

  const createDemoProfiles = async () => {
  setCreatingDemo(true);

  try {
    const patients = await api<any[]>("/patients");

    let patient =
      patients.find((item) => item.is_demo) ||
      patients.find((item) =>
        String(item.name || "")
          .toLowerCase()
          .includes("musterpatient")
      );

    if (!patient) {
      patient = await api<any>("/patients", {
        method: "POST",
        body: {
          name: "Musterpatient",
          age: 76,
          room: "Demo",
          notes: "VYLNAX Musterpatient",
          is_demo: true,
        },
      });
    }

    let profiles = await api<AccessUser[]>("/access-users");

    const patientProfileExists = profiles.some(
      (profile) =>
        profile.role === "patient" &&
        (
          profile.patient_id === patient.id ||
          profile.name.toLowerCase().includes("musterpatient")
        )
    );

    if (!patientProfileExists) {
      await api("/access-users", {
        method: "POST",
        body: {
          name: "Musterpatient",
          role: "patient",
          pin: "0000",
          source_id: patient.id,
          patient_id: patient.id,
          active: true,
        },
      });
    }

    profiles = await api<AccessUser[]>("/access-users");

    const jasminProfileExists = profiles.some(
      (profile) =>
        profile.role === "caregiver" &&
        profile.name.toLowerCase().includes("jasmin")
    );

    if (!jasminProfileExists) {
      const caregivers = await api<any[]>("/caregivers");

      let jasmin = caregivers.find((person) =>
        `${person.first_name || ""} ${person.last_name || ""}`
          .toLowerCase()
          .includes("jasmin")
      );

      if (!jasmin) {
        jasmin = await api<any>("/caregivers", {
          method: "POST",
          body: {
            patient_id: patient.id,
            first_name: "Jasmin",
            last_name: "Adilovic",
            professional_role: "PFK",
          },
        });
      }

      await api("/access-users", {
        method: "POST",
        body: {
          name: "Jasmin Adilovic",
          role: "caregiver",
          pin: "2222",
          source_id: jasmin.id,
          patient_id: patient.id,
          active: true,
        },
      });
    }

    await refreshAccessUsers();

    Alert.alert(
      "Fertig",
      "Musterpatient und Jasmin als PFK wurden eingerichtet."
    );
  } catch (error) {
    Alert.alert("Fehler", readableError(error));
  } finally {
    setCreatingDemo(false);
  }
};

  const signIn = async () => {
    if (!selected || pin.length !== 4) return;
    setBusy(true);
    try {
      await loginWithPin(selected, pin);
      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("Anmeldung fehlgeschlagen", readableError(error));
      setPin("");
    } finally {
      setBusy(false);
    }
  };

  const pageBusy = signingIn || loading || refreshing;

  return (
    <View style={[styles.container, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 20 }]}>
      <VLogo size={68} />
      <Text style={styles.brand}>
        VYLNAX <Text style={{ color: "#4DA6E8" }}>PRO</Text>
      </Text>
      <Text style={styles.heading}>Wer meldet sich an?</Text>

      {pageBusy ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#fff" size="large" />
          <Text style={styles.loadingText}>Profile werden geladen…</Text>
        </View>
      ) : (
        <>
          <ScrollView style={{ width: "100%" }} contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
            {accessUsers.map((profile) => (
              <Pressable
                key={profile.id}
                onPress={() => {
                  setSelected(profile);
                  setPin("");
                }}
                style={[styles.profile, selected?.id === profile.id && styles.activeProfile]}
              >
                <Ionicons
                  name={
                    profile.role === "patient"
                      ? "person"
                      : profile.role === "relative"
                        ? "people"
                        : profile.role === "doctor"
                          ? "medical"
                          : "medkit"
                  }
                  size={24}
                  color={selected?.id === profile.id ? "#fff" : "#4DA6E8"}
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{profile.name}</Text>
                  <Text style={styles.role}>
                    {labels[profile.role]} · Start-PIN {profile.role === "patient" ? "0000" : profile.role === "doctor" ? "1111" : profile.role === "caregiver" ? "2222" : "3333"}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="#B9CCE0" />
              </Pressable>
            ))}

            {accessUsers.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Noch keine Person gespeichert</Text>
                <Text style={styles.emptyText}>Du kannst die Startprofile laden oder Benutzer einzeln hinzufügen.</Text>
                <Pressable
                  disabled={creatingDemo}
                  onPress={createDemoProfiles}
                  style={[styles.demoButton, creatingDemo && { opacity: 0.55 }]}
                >
                  {creatingDemo ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.demoButtonText}>Musterpatient + Jasmin als PFK laden</Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>

          <Pressable onPress={() => router.push("/add-person")} style={styles.addButton}>
            <Ionicons name="person-add" size={21} color="#fff" />
            <Text style={styles.addButtonText}>Neuen Benutzer hinzufügen</Text>
          </Pressable>

          {selected && (
            <View style={styles.pinBox}>
              <Text style={styles.pinLabel}>PIN für {selected.name}</Text>
              <TextInput
                value={pin}
                onChangeText={setPin}
                keyboardType="number-pad"
                secureTextEntry
                maxLength={4}
                autoFocus
                style={styles.pinInput}
                placeholder="••••"
                placeholderTextColor="#7C93A8"
              />
              <Pressable
                onPress={signIn}
                disabled={busy || pin.length !== 4}
                style={[styles.loginButton, (busy || pin.length !== 4) && { opacity: 0.5 }]}
              >
                {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.loginButtonText}>Anmelden</Text>}
              </Pressable>
            </View>
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0A1929", alignItems: "center", paddingHorizontal: 20 },
  brand: { color: "#fff", fontSize: 25, fontWeight: "900", marginTop: 10 },
  heading: { color: "#fff", fontSize: 25, fontWeight: "800", alignSelf: "flex-start", marginVertical: 24 },
  loadingBox: { alignItems: "center", gap: 12, marginTop: 28 },
  loadingText: { color: "#B9CCE0", fontWeight: "600" },
  profile: { width: "100%", backgroundColor: "#112B43", borderWidth: 1, borderColor: "#24445F", borderRadius: 14, padding: 15, flexDirection: "row", alignItems: "center", gap: 14 },
  activeProfile: { backgroundColor: "#1A65A9", borderColor: "#4DA6E8" },
  name: { color: "#fff", fontSize: 17, fontWeight: "800" },
  role: { color: "#B9CCE0", marginTop: 2, fontSize: 12 },
  empty: { padding: 18, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "#4A6680", alignItems: "center" },
  emptyTitle: { color: "#fff", fontWeight: "800", fontSize: 17 },
  emptyText: { color: "#B9CCE0", marginTop: 7, textAlign: "center", lineHeight: 21 },
  demoButton: { marginTop: 16, minHeight: 58, width: "100%", borderRadius: 12, backgroundColor: "#2374BC", justifyContent: "center", alignItems: "center", paddingHorizontal: 14 },
  demoButtonText: { color: "#fff", fontWeight: "900", fontSize: 16, textAlign: "center" },
  addButton: { width: "100%", minHeight: 54, borderRadius: 13, borderWidth: 1, borderColor: "#4DA6E8", backgroundColor: "#123A5C", flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 },
  addButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  pinBox: { width: "100%", marginTop: 16 },
  pinLabel: { color: "#DCE9F5", fontWeight: "700", marginBottom: 8 },
  pinInput: { height: 58, backgroundColor: "#fff", borderRadius: 12, textAlign: "center", fontSize: 28, letterSpacing: 12, color: "#12263A" },
  loginButton: { height: 54, borderRadius: 12, backgroundColor: "#1A65A9", alignItems: "center", justifyContent: "center", marginTop: 12 },
  loginButtonText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});
