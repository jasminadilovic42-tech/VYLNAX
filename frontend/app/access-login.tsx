import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";

import {
  AccessUser,
  useAccess,
} from "@/src/context/AccessContext";

function normalizeRole(role?: string): string {
  return String(role || "").trim().toLowerCase();
}

function getRoleLabel(role?: string): string {
  const normalized = normalizeRole(role);

  if (
    normalized === "caregiver" ||
    normalized === "pflegekraft" ||
    normalized === "pfk"
  ) {
    return "Pflegekraft";
  }

  if (
    normalized === "doctor" ||
    normalized === "arzt" ||
    normalized === "hausarzt"
  ) {
    return "Arzt";
  }

  if (
    normalized === "relative" ||
    normalized === "angehoerige" ||
    normalized === "angehörige"
  ) {
    return "Angehörige";
  }

  if (normalized === "patient") {
    return "Patient";
  }

  if (normalized === "admin" || normalized === "administrator") {
    return "Administrator";
  }

  return role || "Benutzer";
}

function getRoleIcon(role?: string): string {
  const normalized = normalizeRole(role);

  if (
    normalized === "caregiver" ||
    normalized === "pflegekraft" ||
    normalized === "pfk"
  ) {
    return "👩‍⚕️";
  }

  if (
    normalized === "doctor" ||
    normalized === "arzt" ||
    normalized === "hausarzt"
  ) {
    return "🩺";
  }

  if (
    normalized === "relative" ||
    normalized === "angehoerige" ||
    normalized === "angehörige"
  ) {
    return "👨‍👩‍👧";
  }

  if (normalized === "patient") {
    return "👤";
  }

  return "🔐";
}

function getUserName(user: AccessUser): string {
  if (user.name?.trim()) {
    return user.name.trim();
  }

  const fullName = [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  return fullName || "VYLNAX Benutzer";
}

function getFriendlyError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : "Unbekannter Fehler";

  if (message.includes("Invalid PIN")) {
    return "Der eingegebene PIN ist falsch.";
  }

  if (message.includes("temporarily locked")) {
    return "Dieser Zugang ist vorübergehend gesperrt. Bitte versuchen Sie es später erneut.";
  }

  if (message.includes("ACCESS_UNAUTHORIZED")) {
    return "Die Anmeldung ist nicht mehr gültig.";
  }

  if (message.includes("BACKEND_TIMEOUT")) {
    return "Der VYLNAX-Server antwortet nicht. Bitte prüfen Sie Ihre Internetverbindung.";
  }

  if (message.includes("Access user not found")) {
    return "Dieser Benutzer wurde nicht gefunden.";
  }

  if (message.includes("assigned to another patient")) {
    return "Dieser Zugang ist einem anderen Patienten zugeordnet.";
  }

  return message;
}

export default function AccessLoginScreen() {
  const {
    accessUsers,
    loadAccessUsers,
    loginAccess,
    signingIn,
    loadingUsers,
    isAccessAuthenticated,
  } = useAccess();

  const [selectedUser, setSelectedUser] = useState<AccessUser | null>(null);
  const [pin, setPin] = useState("0000");
  const [showPin, setShowPin] = useState(false);

  useEffect(() => {
    loadAccessUsers().catch((error) => {
      Alert.alert(
        "Benutzer konnten nicht geladen werden",
        getFriendlyError(error)
      );
    });
  }, [loadAccessUsers]);

  useEffect(() => {
    if (isAccessAuthenticated) {
      router.replace("/(tabs)");
    }
  }, [isAccessAuthenticated]);

  const sortedUsers = useMemo(() => {
    return [...accessUsers].sort((a, b) => {
      return getUserName(a).localeCompare(getUserName(b));
    });
  }, [accessUsers]);

  const handleSelectUser = (user: AccessUser) => {
    setSelectedUser(user);
    setPin("0000");
  };

  const handleLogin = async () => {
    if (!selectedUser) {
      Alert.alert(
        "Benutzer auswählen",
        "Bitte wählen Sie zuerst aus, wer VYLNAX verwendet."
      );
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      Alert.alert(
        "Ungültiger PIN",
        "Der PIN muss aus 4 bis 6 Ziffern bestehen."
      );
      return;
    }

    try {
      await loginAccess(
        selectedUser.id,
        pin,
        selectedUser.patient_id || null
      );

      router.replace("/(tabs)");
    } catch (error) {
      Alert.alert("Anmeldung fehlgeschlagen", getFriendlyError(error));
    }
  };

  const handleReload = async () => {
    try {
      await loadAccessUsers();
    } catch (error) {
      Alert.alert(
        "Aktualisierung fehlgeschlagen",
        getFriendlyError(error)
      );
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.page}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.logoCircle}>
          <Text style={styles.logoText}>V</Text>
        </View>

        <Text style={styles.title}>VYLNAX PRO</Text>

        <Text style={styles.subtitle}>
          Wer verwendet die Anwendung?
        </Text>

        <Text style={styles.description}>
          Wählen Sie Ihren persönlichen Zugang aus.
        </Text>

        {loadingUsers ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>
              Benutzer werden geladen …
            </Text>
          </View>
        ) : sortedUsers.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyTitle}>
              Noch keine Zugänge vorhanden
            </Text>

            <Text style={styles.emptyText}>
              Erstellen Sie zuerst im VYLNAX-Profil einen Zugang für
              Patient, Angehörige, Pflegekraft oder Arzt.
            </Text>

            <Pressable
              style={styles.secondaryButton}
              onPress={handleReload}
            >
              <Text style={styles.secondaryButtonText}>
                Erneut laden
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.usersContainer}>
            {sortedUsers.map((user) => {
              const selected = selectedUser?.id === user.id;

              return (
                <Pressable
                  key={user.id}
                  onPress={() => handleSelectUser(user)}
                  style={[
                    styles.userCard,
                    selected && styles.userCardSelected,
                  ]}
                >
                  <View style={styles.iconBox}>
                    <Text style={styles.roleIcon}>
                      {getRoleIcon(user.role)}
                    </Text>
                  </View>

                  <View style={styles.userInfo}>
                    <Text style={styles.userName}>
                      {getUserName(user)}
                    </Text>

                    <Text style={styles.userRole}>
                      {getRoleLabel(user.role)}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.selectionCircle,
                      selected && styles.selectionCircleSelected,
                    ]}
                  >
                    {selected ? (
                      <Text style={styles.checkMark}>✓</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}

        {selectedUser ? (
          <View style={styles.pinSection}>
            <Text style={styles.pinTitle}>
              PIN für {getUserName(selectedUser)}
            </Text>

            <Text style={styles.pinHint}>
              Während der Testphase lautet der Standard-PIN 0000.
            </Text>

            <View style={styles.pinRow}>
              <TextInput
                value={pin}
                onChangeText={(value) => {
                  const digitsOnly = value.replace(/\D/g, "").slice(0, 6);
                  setPin(digitsOnly);
                }}
                placeholder="PIN"
                keyboardType="number-pad"
                secureTextEntry={!showPin}
                maxLength={6}
                style={styles.pinInput}
                textAlign="center"
              />

              <Pressable
                style={styles.showPinButton}
                onPress={() => setShowPin((current) => !current)}
              >
                <Text style={styles.showPinText}>
                  {showPin ? "Verbergen" : "Anzeigen"}
                </Text>
              </Pressable>
            </View>

            <Pressable
              onPress={handleLogin}
              disabled={signingIn}
              style={[
                styles.loginButton,
                signingIn && styles.buttonDisabled,
              ]}
            >
              {signingIn ? (
                <ActivityIndicator />
              ) : (
                <Text style={styles.loginButtonText}>
                  Sicher anmelden
                </Text>
              )}
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.securityText}>
          🔒 Jeder Zugriff und jede Änderung wird sicher protokolliert.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#F4F7FB",
  },

  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 54,
    paddingBottom: 36,
    alignItems: "center",
  },

  logoCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E6BA8",
    marginBottom: 14,
  },

  logoText: {
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
  },

  title: {
    fontSize: 27,
    fontWeight: "800",
    color: "#132238",
    letterSpacing: 1,
  },

  subtitle: {
    marginTop: 24,
    fontSize: 22,
    fontWeight: "700",
    color: "#132238",
    textAlign: "center",
  },

  description: {
    marginTop: 7,
    marginBottom: 22,
    fontSize: 15,
    lineHeight: 21,
    color: "#667085",
    textAlign: "center",
  },

  usersContainer: {
    width: "100%",
    gap: 12,
  },

  userCard: {
    minHeight: 82,
    width: "100%",
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
  },

  userCardSelected: {
    borderWidth: 2,
    borderColor: "#0E6BA8",
    backgroundColor: "#EDF7FD",
  },

  iconBox: {
    width: 52,
    height: 52,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EEF4F8",
  },

  roleIcon: {
    fontSize: 26,
  },

  userInfo: {
    flex: 1,
    marginLeft: 13,
  },

  userName: {
    fontSize: 17,
    fontWeight: "700",
    color: "#182230",
  },

  userRole: {
    marginTop: 4,
    fontSize: 14,
    color: "#667085",
  },

  selectionCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },

  selectionCircleSelected: {
    borderColor: "#0E6BA8",
    backgroundColor: "#0E6BA8",
  },

  checkMark: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  pinSection: {
    width: "100%",
    marginTop: 24,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D9E2EC",
  },

  pinTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#182230",
    textAlign: "center",
  },

  pinHint: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 19,
    color: "#667085",
    textAlign: "center",
  },

  pinRow: {
    marginTop: 17,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  pinInput: {
    flex: 1,
    height: 54,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#B8C5D1",
    backgroundColor: "#F8FAFC",
    fontSize: 23,
    fontWeight: "700",
    letterSpacing: 8,
    color: "#132238",
  },

  showPinButton: {
    height: 54,
    minWidth: 93,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#EAF2F8",
  },

  showPinText: {
    color: "#0E6BA8",
    fontSize: 13,
    fontWeight: "700",
  },

  loginButton: {
    width: "100%",
    height: 56,
    marginTop: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0E6BA8",
  },

  loginButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  loadingBox: {
    width: "100%",
    paddingVertical: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 13,
    color: "#667085",
    fontSize: 15,
  },

  emptyBox: {
    width: "100%",
    padding: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
  },

  emptyTitle: {
    color: "#182230",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },

  emptyText: {
    marginTop: 9,
    color: "#667085",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  secondaryButton: {
    marginTop: 17,
    minHeight: 46,
    paddingHorizontal: 22,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "#EAF2F8",
  },

  secondaryButtonText: {
    color: "#0E6BA8",
    fontWeight: "700",
  },

  securityText: {
    marginTop: 24,
    paddingHorizontal: 10,
    fontSize: 12,
    lineHeight: 18,
    color: "#667085",
    textAlign: "center",
  },
});