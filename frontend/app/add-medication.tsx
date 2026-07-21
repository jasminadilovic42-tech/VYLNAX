import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import {
  colors,
  font,
  MED_COLORS,
  MED_FORMS,
  radius,
  shadow,
  spacing,
  WEEKDAYS_FULL,
} from "@/src/theme";
import { api } from "@/src/api";
import { PrimaryButton } from "@/src/components/ui";
import { useAuth } from "@/src/context/AuthContext";

const TIME_PRESETS = [
  "08:00",
  "12:00",
  "16:00",
  "20:00",
];

const FREQUENCIES = [
  "Täglich",
  "Jeden 2. Tag",
  "Wöchentlich",
  "Nach Bedarf",
];

type MedicationSearchResult = {
  name?: string;
  dosage?: string;
  form?: string;
  category?: string;
};

type MedicationCheck = {
  safe?: boolean;
  duplicate?: boolean;
  allergy_conflicts?: Array<{
    message?: string;
  }>;
  interactions?: Array<{
    risk?: "high" | "medium" | "low" | string;
    with?: string;
    message?: string;
  }>;
};

function normalizeRole(role?: string | null): string {
  return String(role || "")
    .trim()
    .toLowerCase();
}

export default function AddMedication() {
  const params = useLocalSearchParams<{
    patientId?: string;
    pName?: string;
    pDosage?: string;
    pForm?: string;
    pFreq?: string;
    pPrescriber?: string;
    pNote?: string;
  }>();

  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const patientId = Array.isArray(params.patientId)
    ? params.patientId[0]
    : params.patientId;

  const role = normalizeRole(user?.role);

  const canEditTherapy =
    role === "caregiver" || role === "doctor";

  const permissionAlertShown = useRef(false);
  const suppress = useRef(!!params.pName);

  const [name, setName] = useState(
    params.pName || ""
  );

  const [dosage, setDosage] = useState(
    params.pDosage || ""
  );

  const [form, setForm] = useState(
    params.pForm && MED_FORMS.includes(params.pForm)
      ? params.pForm
      : "Tablette"
  );

  const [color, setColor] = useState(
    MED_COLORS[0]
  );

  const [times, setTimes] = useState<string[]>([
    "08:00",
  ]);

  const [days, setDays] = useState<number[]>([
    0, 1, 2, 3, 4, 5, 6,
  ]);

  const [customTime, setCustomTime] =
    useState("");

  const [frequency, setFrequency] = useState(
    params.pFreq || "Täglich"
  );

  const [prescriber, setPrescriber] = useState(
    params.pPrescriber || ""
  );

  const [note, setNote] = useState(
    params.pNote || ""
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<
    MedicationSearchResult[]
  >([]);

  const [searching, setSearching] =
    useState(false);

  const [showSuggest, setShowSuggest] =
    useState(false);

  const [check, setCheck] =
    useState<MedicationCheck | null>(null);

  const selectedColor = useMemo(
    () => color || colors.brandPrimary,
    [color]
  );

  const showPermissionDenied = () => {
    Alert.alert(
      "Keine Berechtigung",
      "Medikamente dürfen nur von einer Pflegekraft oder einem Arzt hinzugefügt oder geändert werden."
    );
  };

  useEffect(() => {
    if (
      user &&
      !canEditTherapy &&
      !permissionAlertShown.current
    ) {
      permissionAlertShown.current = true;

      Alert.alert(
        "Keine Berechtigung",
        "Sie haben keinen Zugriff auf die Bearbeitung der Therapie.",
        [
          {
            text: "Zurück",
            onPress: () => router.back(),
          },
        ],
        {
          cancelable: false,
        }
      );
    }
  }, [canEditTherapy, router, user]);

  useEffect(() => {
    if (!canEditTherapy) {
      setResults([]);
      setShowSuggest(false);
      setSearching(false);
      return;
    }

    let active = true;

    if (suppress.current) {
      suppress.current = false;
      return;
    }

    const query = name.trim();

    if (query.length < 2) {
      setResults([]);
      setShowSuggest(false);
      return;
    }

    setSearching(true);

    const timeout = setTimeout(async () => {
      try {
        const response =
          await api<MedicationSearchResult[]>(
            `/med-database?q=${encodeURIComponent(
              query
            )}`
          );

        if (active) {
          const safeResults = Array.isArray(response)
            ? response
            : [];

          setResults(safeResults);
          setShowSuggest(safeResults.length > 0);
        }
      } catch (searchError) {
        console.error(
          "Fehler bei der Medikamentensuche:",
          searchError
        );

        if (active) {
          setResults([]);
          setShowSuggest(false);
        }
      } finally {
        if (active) {
          setSearching(false);
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [canEditTherapy, name]);

  const pickFromDb = (
    medication: MedicationSearchResult
  ) => {
    if (!canEditTherapy) {
      showPermissionDenied();
      return;
    }

    suppress.current = true;
    setName(medication.name || "");
    setDosage(medication.dosage || "");

    if (
      medication.form &&
      MED_FORMS.includes(medication.form)
    ) {
      setForm(medication.form);
    }

    setResults([]);
    setShowSuggest(false);
  };

  const toggleTime = (time: string) => {
    if (!canEditTherapy) {
      showPermissionDenied();
      return;
    }

    setTimes((previous) =>
      previous.includes(time)
        ? previous.filter(
            (current) => current !== time
          )
        : [...previous, time]
    );
  };

  const toggleDay = (day: number) => {
    if (!canEditTherapy) {
      showPermissionDenied();
      return;
    }

    setDays((previous) =>
      previous.includes(day)
        ? previous.filter(
            (current) => current !== day
          )
        : [...previous, day]
    );
  };

  const addCustom = () => {
    if (!canEditTherapy) {
      showPermissionDenied();
      return;
    }

    const match = customTime.match(
      /^(\d{1,2}):(\d{2})$/
    );

    if (!match) {
      setError(
        "Bitte eine gültige Uhrzeit im Format HH:MM eingeben."
      );
      return;
    }

    const hour = Number(match[1]);
    const minute = Number(match[2]);

    if (
      hour < 0 ||
      hour > 23 ||
      minute < 0 ||
      minute > 59
    ) {
      setError(
        "Bitte eine gültige Uhrzeit zwischen 00:00 und 23:59 eingeben."
      );
      return;
    }

    const normalizedTime = `${String(
      hour
    ).padStart(2, "0")}:${String(minute).padStart(
      2,
      "0"
    )}`;

    if (!times.includes(normalizedTime)) {
      setTimes((previous) => [
        ...previous,
        normalizedTime,
      ]);
    }

    setCustomTime("");
    setError("");
  };

  const openScanner = (
    pathname:
      | "/scan-prescription"
      | "/scan-barcode"
  ) => {
    if (!canEditTherapy) {
      showPermissionDenied();
      return;
    }

    if (!patientId) {
      Alert.alert(
        "Kein Patient ausgewählt",
        "Bitte wählen Sie zuerst einen Patienten aus."
      );
      return;
    }

    router.push({
      pathname,
      params: {
        patientId,
      },
    });
  };

  const save = async () => {
    setError("");

    if (!canEditTherapy) {
      showPermissionDenied();
      return;
    }

    if (!patientId) {
      setError(
        "Kein Patient ausgewählt. Bitte gehen Sie zurück und wählen Sie einen Patienten."
      );
      return;
    }

    if (
      !name.trim() ||
      !dosage.trim() ||
      times.length === 0 ||
      days.length === 0
    ) {
      setError(
        "Bitte Name, Dosierung, mindestens eine Zeit und einen Tag angeben."
      );
      return;
    }

    try {
      const response = await api<MedicationCheck>(
        `/patients/${patientId}/check-medication`,
        {
          method: "POST",
          body: {
            name: name.trim(),
            dosage: dosage.trim(),
          },
        }
      );

      if (response && response.safe === false) {
        if (Platform.OS !== "web") {
          await Haptics.notificationAsync(
            Haptics.NotificationFeedbackType
              .Warning
          );
        }

        setCheck(response);
        return;
      }
    } catch (checkError) {
      console.error(
        "Medikamentenprüfung nicht verfügbar:",
        checkError
      );
    }

    await doSave();
  };

  const doSave = async () => {
    setCheck(null);
    setError("");

    if (!canEditTherapy) {
      showPermissionDenied();
      return;
    }

    if (!patientId) {
      setError(
        "Kein Patient ausgewählt. Das Medikament kann nicht gespeichert werden."
      );
      return;
    }

    if (saving) {
      return;
    }

    setSaving(true);

    try {
      await api(
        `/patients/${patientId}/medications`,
        {
          method: "POST",
          body: {
            name: name.trim(),
            dosage: dosage.trim(),
            form,
            color: selectedColor,
            times: [...times].sort(),
            days: [...days].sort(
              (first, second) => first - second
            ),
            frequency,
            prescriber:
              prescriber.trim() || null,
            note: note.trim() || null,
          },
        }
      );

      if (Platform.OS !== "web") {
        await Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        );
      }

      router.back();
    } catch (saveError) {
      console.error(
        "Fehler beim Speichern des Medikaments:",
        saveError
      );

      setError(
        "Speichern fehlgeschlagen. Bitte versuchen Sie es erneut."
      );
    } finally {
      setSaving(false);
    }
  };

  if (user && !canEditTherapy) {
    return (
      <View
        style={[
          styles.deniedContainer,
          {
            paddingTop: insets.top + spacing.xl,
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
          Medikamente dürfen nur von einer
          Pflegekraft oder einem Arzt hinzugefügt
          werden.
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
      style={styles.screen}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : undefined
      }
    >
      <View
        style={[
          styles.header,
          {
            paddingTop:
              insets.top + spacing.sm,
          },
        ]}
      >
        <Pressable
          testID="close-modal"
          onPress={() => router.back()}
          style={styles.closeBtn}
        >
          <Ionicons
            name="close"
            size={24}
            color={colors.onSurface}
          />
        </Pressable>

        <Text style={styles.title}>
          Medikament hinzufügen
        </Text>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.warning}>
          <Ionicons
            name="alert-circle"
            size={20}
            color={colors.warning}
          />

          <Text style={styles.warningText}>
            Medikamentendaten müssen vor der
            Anwendung von medizinischem
            Fachpersonal (Arzt/Apotheker) geprüft
            werden.
          </Text>
        </View>

        <View style={styles.scanRow}>
          <Pressable
            testID="scan-prescription-btn"
            onPress={() =>
              openScanner("/scan-prescription")
            }
            style={styles.scanBtn}
          >
            <Ionicons
              name="document-text"
              size={18}
              color={colors.brand}
            />

            <Text style={styles.scanBtnText}>
              Rezept scannen
            </Text>
          </Pressable>

          <Pressable
            testID="scan-barcode-btn"
            onPress={() =>
              openScanner("/scan-barcode")
            }
            style={styles.scanBtn}
          >
            <Ionicons
              name="barcode"
              size={18}
              color={colors.brand}
            />

            <Text style={styles.scanBtnText}>
              Barcode scannen
            </Text>
          </Pressable>
        </View>

        <Label text="Medikamentenname" />

        <View style={styles.autocompleteWrap}>
          <View style={styles.inputWithIcon}>
            <Ionicons
              name="search"
              size={18}
              color={colors.brandPrimary}
            />

            <TextInput
              testID="med-name-input"
              value={name}
              onChangeText={setName}
              onFocus={() =>
                results.length > 0 &&
                setShowSuggest(true)
              }
              placeholder='Tippen Sie z. B. „Met“…'
              placeholderTextColor={
                colors.borderStrong
              }
              style={styles.autocompleteInput}
              autoCorrect={false}
              editable={!saving}
            />

            {searching && (
              <ActivityIndicator
                size="small"
                color={colors.brandPrimary}
              />
            )}
          </View>

          {showSuggest &&
            results.length > 0 && (
              <View style={styles.suggestDrop}>
                {results
                  .slice(0, 6)
                  .map((medication, index) => (
                    <Pressable
                      key={`${medication.name || "med"}-${index}`}
                      testID={`db-result-${index}`}
                      onPress={() =>
                        pickFromDb(medication)
                      }
                      style={styles.resultRow}
                    >
                      <View
                        style={styles.resultIcon}
                      >
                        <Ionicons
                          name="medical"
                          size={16}
                          color={
                            colors.brandPrimary
                          }
                        />
                      </View>

                      <View style={styles.flexOne}>
                        <Text
                          style={styles.resultName}
                        >
                          {[
                            medication.name,
                            medication.dosage,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        </Text>

                        <Text
                          style={styles.resultMeta}
                        >
                          {[
                            medication.form,
                            medication.category,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </Text>
                      </View>

                      <Ionicons
                        name="add-circle-outline"
                        size={22}
                        color={colors.brandPrimary}
                      />
                    </Pressable>
                  ))}
              </View>
            )}
        </View>

        <Label text="Stärke / Dosierung" />

        <TextInput
          testID="med-dosage-input"
          value={dosage}
          onChangeText={setDosage}
          placeholder="z. B. 500 mg"
          placeholderTextColor={colors.borderStrong}
          style={styles.input}
          editable={!saving}
        />

        <Label text="Form" />

        <View style={styles.wrapRow}>
          {MED_FORMS.map((currentForm) => (
            <Pressable
              key={currentForm}
              testID={`form-${currentForm}`}
              disabled={saving}
              onPress={() =>
                setForm(currentForm)
              }
              style={[
                styles.tag,
                form === currentForm &&
                  styles.tagActive,
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  form === currentForm &&
                    styles.tagTextActive,
                ]}
              >
                {currentForm}
              </Text>
            </Pressable>
          ))}
        </View>

        <Label text="Einnahmezeiten" />

        <View style={styles.wrapRow}>
          {TIME_PRESETS.map((time) => (
            <Pressable
              key={time}
              testID={`time-${time}`}
              disabled={saving}
              onPress={() => toggleTime(time)}
              style={[
                styles.tag,
                times.includes(time) &&
                  styles.tagActive,
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  times.includes(time) &&
                    styles.tagTextActive,
                ]}
              >
                {time}
              </Text>
            </Pressable>
          ))}

          {times
            .filter(
              (time) =>
                !TIME_PRESETS.includes(time)
            )
            .map((time) => (
              <Pressable
                key={time}
                testID={`time-${time}`}
                disabled={saving}
                onPress={() => toggleTime(time)}
                style={[
                  styles.tag,
                  styles.tagActive,
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    styles.tagTextActive,
                  ]}
                >
                  {time}
                </Text>
              </Pressable>
            ))}
        </View>

        <View style={styles.customRow}>
          <TextInput
            testID="custom-time-input"
            value={customTime}
            onChangeText={setCustomTime}
            placeholder="HH:MM"
            placeholderTextColor={
              colors.borderStrong
            }
            style={[
              styles.input,
              styles.customTimeInput,
            ]}
            keyboardType="numbers-and-punctuation"
            editable={!saving}
          />

          <Pressable
            testID="add-custom-time"
            disabled={saving}
            onPress={addCustom}
            style={[
              styles.addTimeBtn,
              saving && styles.disabled,
            ]}
          >
            <Ionicons
              name="add"
              size={22}
              color="#FFFFFF"
            />
          </Pressable>
        </View>

        <Label text="Wochentage" />

        <View style={styles.daysRow}>
          {WEEKDAYS_FULL.map(
            (weekday, index) => (
              <Pressable
                key={`${weekday}-${index}`}
                testID={`weekday-${index}`}
                disabled={saving}
                onPress={() =>
                  toggleDay(index)
                }
                style={[
                  styles.dayCircle,
                  days.includes(index) &&
                    styles.dayActive,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    days.includes(index) &&
                      styles.dayTextActive,
                  ]}
                >
                  {weekday}
                </Text>
              </Pressable>
            )
          )}
        </View>

        <Label text="Farbe" />

        <View style={styles.wrapRow}>
          {MED_COLORS.map(
            (currentColor) => (
              <Pressable
                key={currentColor}
                testID={`color-${currentColor}`}
                disabled={saving}
                onPress={() =>
                  setColor(currentColor)
                }
                style={[
                  styles.colorDot,
                  {
                    backgroundColor:
                      currentColor,
                  },
                  color === currentColor &&
                    styles.colorActive,
                ]}
              >
                {color === currentColor && (
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color="#FFFFFF"
                  />
                )}
              </Pressable>
            )
          )}
        </View>

        <Label text="Häufigkeit" />

        <View style={styles.wrapRow}>
          {FREQUENCIES.map(
            (currentFrequency) => (
              <Pressable
                key={currentFrequency}
                testID={`freq-${currentFrequency}`}
                disabled={saving}
                onPress={() =>
                  setFrequency(
                    currentFrequency
                  )
                }
                style={[
                  styles.tag,
                  frequency ===
                    currentFrequency &&
                    styles.tagActive,
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    frequency ===
                      currentFrequency &&
                      styles.tagTextActive,
                  ]}
                >
                  {currentFrequency}
                </Text>
              </Pressable>
            )
          )}
        </View>

        <Label text="Arzt / Verordner" />

        <TextInput
          testID="med-prescriber-input"
          value={prescriber}
          onChangeText={setPrescriber}
          placeholder="z. B. Dr. Müller"
          placeholderTextColor={colors.borderStrong}
          style={styles.input}
          editable={!saving}
        />

        <Label text="Notizen" />

        <TextInput
          testID="med-note-input"
          value={note}
          onChangeText={setNote}
          placeholder="z. B. Nach dem Essen einnehmen"
          placeholderTextColor={colors.borderStrong}
          style={[
            styles.input,
            styles.noteInput,
          ]}
          multiline
          editable={!saving}
        />

        {error ? (
          <Text style={styles.error}>
            {error}
          </Text>
        ) : null}

        <PrimaryButton
          testID="save-medication"
          label="Medikament speichern"
          icon="checkmark"
          loading={saving}
          onPress={() => void save()}
          style={styles.saveButton}
        />
      </ScrollView>

      <Modal
        visible={!!check}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!saving) {
            setCheck(null);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View
            style={styles.modalCard}
            testID="safety-check-modal"
          >
            <View style={styles.modalIcon}>
              <Ionicons
                name="warning"
                size={32}
                color={colors.error}
              />
            </View>

            <Text style={styles.modalTitle}>
              Sicherheitswarnung
            </Text>

            <ScrollView
              style={styles.conflictScroll}
            >
              {check?.allergy_conflicts?.map(
                (conflict, index) => (
                  <View
                    key={`allergy-${index}`}
                    style={[
                      styles.conflictRow,
                      {
                        borderLeftColor:
                          colors.error,
                      },
                    ]}
                  >
                    <Text
                      style={
                        styles.conflictBadgeHigh
                      }
                    >
                      ALLERGIE
                    </Text>

                    <Text
                      style={styles.conflictText}
                    >
                      {conflict.message ||
                        "Möglicher Allergiekonflikt."}
                    </Text>
                  </View>
                )
              )}

              {check?.interactions?.map(
                (interaction, index) => {
                  const riskColor =
                    interaction.risk === "high"
                      ? colors.error
                      : interaction.risk ===
                          "medium"
                        ? colors.warning
                        : colors.info;

                  const riskLabel =
                    interaction.risk === "high"
                      ? "HOHES"
                      : interaction.risk ===
                          "medium"
                        ? "MITTLERES"
                        : "GERINGES";

                  return (
                    <View
                      key={`interaction-${index}`}
                      style={[
                        styles.conflictRow,
                        {
                          borderLeftColor:
                            riskColor,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.conflictBadge,
                          {
                            color: riskColor,
                          },
                        ]}
                      >
                        {riskLabel} RISIKO
                        {interaction.with
                          ? ` · ${interaction.with}`
                          : ""}
                      </Text>

                      <Text
                        style={
                          styles.conflictText
                        }
                      >
                        {interaction.message ||
                          "Mögliche Wechselwirkung."}
                      </Text>
                    </View>
                  );
                }
              )}

              {check?.duplicate && (
                <View
                  style={[
                    styles.conflictRow,
                    {
                      borderLeftColor:
                        colors.warning,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.conflictBadge,
                      {
                        color:
                          colors.warning,
                      },
                    ]}
                  >
                    DOPPELVERORDNUNG
                  </Text>

                  <Text
                    style={styles.conflictText}
                  >
                    Dieses Medikament ist bereits
                    hinterlegt.
                  </Text>
                </View>
              )}
            </ScrollView>

            <Text
              style={styles.modalDisclaimer}
            >
              Dies ersetzt keine ärztliche
              Beratung.
            </Text>

            <PrimaryButton
              testID="save-anyway"
              label="Trotzdem speichern"
              variant="danger"
              loading={saving}
              onPress={() => void doSave()}
              style={styles.modalSaveButton}
            />

            <Pressable
              testID="cancel-save"
              disabled={saving}
              onPress={() => setCheck(null)}
              style={styles.modalCancel}
            >
              <Text
                style={styles.modalCancelText}
              >
                Abbrechen & Ändern
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function Label({
  text,
}: {
  text: string;
}) {
  return (
    <Text style={styles.label}>
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },

  flexOne: {
    flex: 1,
  },

  deniedContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    backgroundColor: colors.surface,
  },

  deniedTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: spacing.lg,
    textAlign: "center",
  },

  deniedText: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.onSurfaceSecondary,
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
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  closeBtn: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  headerSpacer: {
    width: 40,
  },

  title: {
    fontSize: font.lg,
    fontWeight: "800",
    color: colors.onSurface,
  },

  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 40,
  },

  label: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },

  input: {
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    fontSize: font.lg,
    color: colors.onSurface,
    marginBottom: 4,
  },

  wrapRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  tag: {
    paddingHorizontal: 16,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },

  tagActive: {
    backgroundColor: colors.brandPrimary,
  },

  tagText: {
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },

  tagTextActive: {
    color: "#FFFFFF",
  },

  customRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
    alignItems: "center",
  },

  customTimeInput: {
    flex: 1,
    marginBottom: 0,
  },

  addTimeBtn: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },

  disabled: {
    opacity: 0.55,
  },

  daysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  dayCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTertiary,
    alignItems: "center",
    justifyContent: "center",
  },

  dayActive: {
    backgroundColor: colors.brandPrimary,
  },

  dayText: {
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
    fontSize: 12,
  },

  dayTextActive: {
    color: "#FFFFFF",
  },

  colorDot: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  colorActive: {
    borderWidth: 3,
    borderColor: colors.onSurface,
  },

  warning: {
    flexDirection: "row",
    gap: spacing.sm,
    backgroundColor: "#FDF3E6",
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: "#F6D8A8",
    marginBottom: spacing.sm,
  },

  warningText: {
    flex: 1,
    color: "#92600A",
    fontSize: 12.5,
    lineHeight: 18,
    fontWeight: "600",
  },

  autocompleteWrap: {
    position: "relative",
    zIndex: 10,
  },

  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },

  autocompleteInput: {
    flex: 1,
    fontSize: font.lg,
    color: colors.onSurface,
  },

  suggestDrop: {
    marginTop: spacing.xs,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    ...shadow.card,
  },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },

  resultIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.brandSecondary,
    alignItems: "center",
    justifyContent: "center",
  },

  resultName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.onSurface,
  },

  resultMeta: {
    fontSize: 12,
    color: colors.onSurfaceTertiary,
    marginTop: 2,
  },

  scanRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },

  scanBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 48,
    borderRadius: radius.md,
    backgroundColor: colors.brandSecondary,
    borderWidth: 1,
    borderColor: colors.brandSecondary,
  },

  scanBtnText: {
    color: colors.brand,
    fontWeight: "700",
    fontSize: 13,
  },

  noteInput: {
    height: 80,
    textAlignVertical: "top",
    paddingTop: spacing.md,
  },

  error: {
    color: colors.error,
    marginTop: spacing.md,
    fontWeight: "600",
  },

  saveButton: {
    marginTop: spacing.xl,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(10,25,41,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },

  modalCard: {
    width: "100%",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xl,
    alignItems: "center",
  },

  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FDECEC",
    alignItems: "center",
    justifyContent: "center",
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: colors.onSurface,
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },

  conflictScroll: {
    maxHeight: 300,
    width: "100%",
  },

  conflictRow: {
    borderLeftWidth: 4,
    backgroundColor: colors.surfaceSecondary,
    borderRadius: radius.sm,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },

  conflictBadge: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
  },

  conflictBadgeHigh: {
    fontSize: 11,
    fontWeight: "800",
    marginBottom: 4,
    color: colors.error,
  },

  conflictText: {
    fontSize: 14,
    color: colors.onSurfaceSecondary,
    lineHeight: 20,
  },

  modalDisclaimer: {
    fontSize: 12,
    color: colors.onSurfaceTertiary,
    marginTop: spacing.sm,
    fontStyle: "italic",
  },

  modalSaveButton: {
    marginTop: spacing.md,
    alignSelf: "stretch",
  },

  modalCancel: {
    paddingVertical: spacing.md,
  },

  modalCancelText: {
    color: colors.brandPrimary,
    fontWeight: "700",
    fontSize: font.base,
  },
});