import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useApp } from "@/src/context/AppContext";
import { useAuth } from "@/src/context/AuthContext";
import { colors, spacing, radius } from "@/src/theme";

type Person = {
  id?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  professional_role?: string;
  specialization?: string;
};

type WoundAiSuggestion = {
  description?: string | null;
  wound_base?: string | null;
  wound_edge?: string | null;
  wound_surrounding_skin?: string | null;
  exudate_visible?: string | null;
  visible_findings?: string | null;
  limitations?: string | null;
};

type WoundRecord = {
  id: string;
  patient_id: string;
  wound_type?: string | null;
  location?: string | null;
  description?: string | null;
  length_cm?: number | null;
  width_cm?: number | null;
  depth_cm?: number | null;
  wound_stage?: string | null;
  wound_base?: string | null;
  wound_edge?: string | null;
  wound_surrounding_skin?: string | null;
  exudate_amount?: string | null;
  exudate_type?: string | null;
  odor?: string | null;
  pain_score?: number | null;
  infection_signs?: string | null;
  treatment?: string | null;
  dressing?: string | null;
  responsible_caregiver?: string | null;
  responsible_doctor?: string | null;
  wound_manager?: string | null;
  photo_data_url?: string | null;
  progress?: string | null;
  next_change?: string | null;
  created_at?: string;
};

const WOUND_TYPES = [
  "Dekubitus",
  "Ulcus cruris",
  "Diabetisches Ulkus",
  "OP-Wunde",
  "Traumatische Wunde",
  "Hautläsion",
  "Verbrennung",
  "Andere",
];

const STAGES = [
  "Nicht zutreffend",
  "Kategorie / Grad 1",
  "Kategorie / Grad 2",
  "Kategorie / Grad 3",
  "Kategorie / Grad 4",
  "Nicht klassifizierbar",
];

const EXUDATE_AMOUNTS = ["Kein", "Gering", "Mittel", "Stark"];
const PROGRESS = ["Neu", "Besser", "Unverändert", "Schlechter"];

function fullName(person: Person, fallback: string) {
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  return name || person.name || fallback;
}

export default function WoundDocumentation() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { activePatient } = useApp();
  const { user } = useAuth();

  const cameraRef = useRef<CameraView | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [takingPhoto, setTakingPhoto] = useState(false);

  const [caregivers, setCaregivers] = useState<Person[]>([]);
  const [doctors, setDoctors] = useState<Person[]>([]);
  const [records, setRecords] = useState<WoundRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [woundType, setWoundType] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [depthCm, setDepthCm] = useState("");
  const [woundStage, setWoundStage] = useState("");
  const [woundBase, setWoundBase] = useState("");
  const [woundEdge, setWoundEdge] = useState("");
  const [surroundingSkin, setSurroundingSkin] = useState("");
  const [exudateAmount, setExudateAmount] = useState("");
  const [exudateType, setExudateType] = useState("");
  const [odor, setOdor] = useState("");
  const [painScore, setPainScore] = useState("");
  const [infectionSigns, setInfectionSigns] = useState("");
  const [treatment, setTreatment] = useState("");
  const [dressing, setDressing] = useState("");
  const [responsibleCaregiver, setResponsibleCaregiver] = useState("");
  const [responsibleDoctor, setResponsibleDoctor] = useState("");
  const [woundManager, setWoundManager] = useState("");
  const [progress, setProgress] = useState("Neu");
  const [nextChange, setNextChange] = useState("");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [descriptionMode, setDescriptionMode] = useState<"ai" | "manual" | null>(null);
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<WoundAiSuggestion | null>(null);

  const load = useCallback(async () => {
    if (!activePatient?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [caregiverData, doctorData, woundData] = await Promise.all([
        api<Person[]>(`/caregivers?patient_id=${encodeURIComponent(activePatient.id)}`).catch(() => []),
        api<Person[]>(`/doctors?patient_id=${encodeURIComponent(activePatient.id)}`).catch(() => []),
        api<WoundRecord[]>(`/patients/${activePatient.id}/wounds`).catch(() => []),
      ]);

      setCaregivers(caregiverData);
      setDoctors(doctorData);
      setRecords(woundData);

      if (!responsibleCaregiver && user?.name) {
        setResponsibleCaregiver(String(user.name));
      }
    } finally {
      setLoading(false);
    }
  }, [activePatient?.id, user?.name, responsibleCaregiver]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    if (!responsibleCaregiver && user?.name) {
      setResponsibleCaregiver(String(user.name));
    }
  }, [user?.name, responsibleCaregiver]);

  const openCamera = async () => {
    if (!permission?.granted) {
      const result = await requestPermission();
      if (!result.granted) {
        Alert.alert(
          "Kamerazugriff erforderlich",
          "Bitte erlauben Sie den Kamerazugriff, um eine Wundaufnahme zu dokumentieren."
        );
        return;
      }
    }
    setCameraOpen(true);
  };

  const takePhoto = async () => {
    if (!cameraRef.current || takingPhoto) return;
    setTakingPhoto(true);
    try {
      const picture = await cameraRef.current.takePictureAsync({
        quality: 0.45,
        base64: true,
        skipProcessing: false,
      });

      if (picture?.base64) {
        setPhotoDataUrl(`data:image/jpeg;base64,${picture.base64}`);
        setDescriptionMode(null);
        setAiSuggestion(null);
        setCameraOpen(false);
      }
    } catch (error) {
      Alert.alert("Foto fehlgeschlagen", "Die Wundaufnahme konnte nicht erstellt werden.");
    } finally {
      setTakingPhoto(false);
    }
  };

  const analyzeWoundPhoto = async () => {
    if (!activePatient?.id) {
      Alert.alert("Kein Patient", "Bitte zuerst einen Patienten auswählen.");
      return;
    }

    if (!photoDataUrl) {
      Alert.alert("Kein Foto", "Bitte zuerst ein Wundfoto aufnehmen.");
      return;
    }

    setDescriptionMode("ai");
    setAiAnalyzing(true);
    setAiSuggestion(null);

    try {
      const result = await api<WoundAiSuggestion>(
        `/patients/${activePatient.id}/wounds/analyze-photo`,
        {
          method: "POST",
          body: {
            photo_data_url: photoDataUrl,
            wound_type: woundType || null,
            location: location.trim() || null,
          },
        }
      );

      setAiSuggestion(result);
    } catch (error: any) {
      Alert.alert(
        "KI-Analyse nicht möglich",
        String(
          error?.message ||
            "Das Foto konnte momentan nicht mit KI beschrieben werden."
        )
      );
    } finally {
      setAiAnalyzing(false);
    }
  };

  const applyAiSuggestion = () => {
    if (!aiSuggestion) return;

    if (aiSuggestion.description) {
      setDescription(aiSuggestion.description);
    }
    if (aiSuggestion.wound_base) {
      setWoundBase(aiSuggestion.wound_base);
    }
    if (aiSuggestion.wound_edge) {
      setWoundEdge(aiSuggestion.wound_edge);
    }
    if (aiSuggestion.wound_surrounding_skin) {
      setSurroundingSkin(aiSuggestion.wound_surrounding_skin);
    }
    if (aiSuggestion.exudate_visible) {
      setExudateType(aiSuggestion.exudate_visible);
    }

    setDescriptionMode("manual");
    Alert.alert(
      "KI-Vorschlag übernommen",
      "Bitte alle übernommenen Angaben fachlich prüfen, bei Bedarf bearbeiten und erst danach speichern."
    );
  };

  const discardAiSuggestion = () => {
    setAiSuggestion(null);
    setDescriptionMode("manual");
  };

  const resetForm = () => {
    setWoundType("");
    setLocation("");
    setDescription("");
    setLengthCm("");
    setWidthCm("");
    setDepthCm("");
    setWoundStage("");
    setWoundBase("");
    setWoundEdge("");
    setSurroundingSkin("");
    setExudateAmount("");
    setExudateType("");
    setOdor("");
    setPainScore("");
    setInfectionSigns("");
    setTreatment("");
    setDressing("");
    setResponsibleDoctor("");
    setWoundManager("");
    setProgress("Neu");
    setNextChange("");
    setPhotoDataUrl(null);
    setDescriptionMode(null);
    setAiSuggestion(null);
    setAiAnalyzing(false);
  };

  const save = async () => {
    if (!activePatient?.id) {
      Alert.alert("Kein Patient", "Bitte zuerst einen Patienten auswählen.");
      return;
    }
    if (!woundType) {
      Alert.alert("Wundart fehlt", "Bitte eine Wundart auswählen.");
      return;
    }
    if (!location.trim()) {
      Alert.alert("Lokalisation fehlt", "Bitte die Lokalisation der Wunde eintragen.");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Beschreibung fehlt", "Bitte die Wunde beschreiben.");
      return;
    }

    setSaving(true);
    try {
      await api(`/patients/${activePatient.id}/wounds`, {
        method: "POST",
        body: {
          wound_type: woundType,
          location: location.trim(),
          description: description.trim(),
          length_cm: lengthCm ? Number(lengthCm.replace(",", ".")) : null,
          width_cm: widthCm ? Number(widthCm.replace(",", ".")) : null,
          depth_cm: depthCm ? Number(depthCm.replace(",", ".")) : null,
          wound_stage: woundStage || null,
          wound_base: woundBase.trim() || null,
          wound_edge: woundEdge.trim() || null,
          wound_surrounding_skin: surroundingSkin.trim() || null,
          exudate_amount: exudateAmount || null,
          exudate_type: exudateType.trim() || null,
          odor: odor.trim() || null,
          pain_score: painScore ? Math.max(0, Math.min(10, Number(painScore))) : null,
          infection_signs: infectionSigns.trim() || null,
          treatment: treatment.trim() || null,
          dressing: dressing.trim() || null,
          responsible_caregiver: responsibleCaregiver.trim() || null,
          responsible_doctor: responsibleDoctor.trim() || null,
          wound_manager: woundManager.trim() || null,
          photo_data_url: photoDataUrl,
          progress,
          next_change: nextChange.trim() || null,
        },
      });

      Alert.alert("Gespeichert", "Die Wunddokumentation wurde gespeichert.");
      resetForm();
      await load();
    } catch (error: any) {
      Alert.alert(
        "Speichern fehlgeschlagen",
        String(error?.message || "Die Wunddokumentation konnte nicht gespeichert werden.")
      );
    } finally {
      setSaving(false);
    }
  };

  if (cameraOpen) {
    return (
      <View style={styles.cameraScreen}>
        <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />

        <View style={[styles.cameraTop, { paddingTop: insets.top + 10 }]}>
          <Pressable style={styles.cameraClose} onPress={() => setCameraOpen(false)}>
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
          <Text style={styles.cameraTitle}>Wundfoto aufnehmen</Text>
          <View style={styles.cameraClose} />
        </View>

        <View style={[styles.cameraBottom, { paddingBottom: insets.bottom + 24 }]}>
          <Pressable
            disabled={takingPhoto}
            onPress={() => void takePhoto()}
            style={styles.shutterOuter}
          >
            {takingPhoto ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <View style={styles.shutterInner} />
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={25} color={colors.onSurface} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Wunddokumentation</Text>
          <Text style={styles.headerSubtitle}>
            {activePatient?.name || "Kein Patient ausgewählt"}
          </Text>
        </View>

        <View style={styles.headerButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {!activePatient?.id ? (
          <View style={styles.warningBox}>
            <Ionicons name="warning-outline" size={24} color="#8A5A00" />
            <Text style={styles.warningText}>
              Bitte zuerst einen Patienten auswählen.
            </Text>
          </View>
        ) : null}

        <Section title="Wunde" icon="bandage-outline" />

        <Text style={styles.label}>Wundart *</Text>
        <View style={styles.chips}>
          {WOUND_TYPES.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={woundType === item}
              onPress={() => setWoundType(item)}
            />
          ))}
        </View>

        <Field
          label="Lokalisation *"
          value={location}
          onChangeText={setLocation}
          placeholder="z. B. rechter Außenknöchel, Sakralbereich"
        />

        <Field
          label="Beschreibung *"
          value={description}
          onChangeText={setDescription}
          placeholder="Wundzustand, Ursache, Besonderheiten"
          multiline
        />

        <Section title="Wundmaße" icon="resize-outline" />

        <View style={styles.triple}>
          <SmallField label="Länge cm" value={lengthCm} onChangeText={setLengthCm} />
          <SmallField label="Breite cm" value={widthCm} onChangeText={setWidthCm} />
          <SmallField label="Tiefe cm" value={depthCm} onChangeText={setDepthCm} />
        </View>

        <Text style={styles.label}>Kategorie / Grad</Text>
        <View style={styles.chips}>
          {STAGES.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={woundStage === item}
              onPress={() => setWoundStage(item)}
            />
          ))}
        </View>

        <Section title="Wundbeurteilung" icon="search-outline" />

        <Field
          label="Wundgrund"
          value={woundBase}
          onChangeText={setWoundBase}
          placeholder="Granulation, Fibrin, Nekrose ..."
          multiline
        />

        <Field
          label="Wundrand"
          value={woundEdge}
          onChangeText={setWoundEdge}
          placeholder="Unauffällig, mazeriert, gerötet ..."
          multiline
        />

        <Field
          label="Wundumgebung"
          value={surroundingSkin}
          onChangeText={setSurroundingSkin}
          placeholder="Hautzustand der Umgebung"
          multiline
        />

        <Text style={styles.label}>Exsudatmenge</Text>
        <View style={styles.chips}>
          {EXUDATE_AMOUNTS.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={exudateAmount === item}
              onPress={() => setExudateAmount(item)}
            />
          ))}
        </View>

        <Field
          label="Exsudat – Art / Farbe"
          value={exudateType}
          onChangeText={setExudateType}
          placeholder="Serös, blutig, eitrig ..."
        />

        <Field
          label="Geruch"
          value={odor}
          onChangeText={setOdor}
          placeholder="Kein / auffällig / Beschreibung"
        />

        <Field
          label="Schmerz 0–10"
          value={painScore}
          onChangeText={setPainScore}
          placeholder="0 bis 10"
          keyboardType="number-pad"
        />

        <Field
          label="Infektionszeichen"
          value={infectionSigns}
          onChangeText={setInfectionSigns}
          placeholder="Rötung, Überwärmung, Schwellung, Sekretion, Fieber ..."
          multiline
        />

        <Section title="Therapie und Verband" icon="medkit-outline" />

        <Field
          label="Wundbehandlung / Therapie"
          value={treatment}
          onChangeText={setTreatment}
          placeholder="Reinigung, Spülung, ärztliche Anordnung ..."
          multiline
        />

        <Field
          label="Verband / Material"
          value={dressing}
          onChangeText={setDressing}
          placeholder="Verwendetes Verbandmaterial"
          multiline
        />

        <Field
          label="Nächster Verbandwechsel"
          value={nextChange}
          onChangeText={setNextChange}
          placeholder="z. B. 10.08.2026 08:00"
        />

        <Section title="Verantwortliche Personen" icon="people-outline" />

        <Text style={styles.label}>Zuständige PFK</Text>
        <View style={styles.chips}>
          {caregivers.map((person, index) => {
            const name = fullName(person, `PFK ${index + 1}`);
            return (
              <Chip
                key={person.id || `${name}-${index}`}
                label={name}
                selected={responsibleCaregiver === name}
                onPress={() => setResponsibleCaregiver(name)}
              />
            );
          })}
        </View>
        <Field
          label="PFK – Freitext"
          value={responsibleCaregiver}
          onChangeText={setResponsibleCaregiver}
          placeholder="Name der zuständigen Pflegefachkraft"
        />

        <Text style={styles.label}>Zuständiger Arzt</Text>
        <View style={styles.chips}>
          {doctors.map((person, index) => {
            const name = fullName(person, `Arzt ${index + 1}`);
            return (
              <Chip
                key={person.id || `${name}-${index}`}
                label={name}
                selected={responsibleDoctor === name}
                onPress={() => setResponsibleDoctor(name)}
              />
            );
          })}
        </View>
        <Field
          label="Arzt – Freitext"
          value={responsibleDoctor}
          onChangeText={setResponsibleDoctor}
          placeholder="Name des behandelnden Arztes"
        />

        <Field
          label="Wundmanager / Wundexperte"
          value={woundManager}
          onChangeText={setWoundManager}
          placeholder="Name des Wundmanagers"
        />

        <Section title="Foto" icon="camera-outline" />

        {photoDataUrl ? (
          <View style={styles.photoCard}>
            <Image source={{ uri: photoDataUrl }} style={styles.photo} />

            <View style={styles.photoActions}>
              <Pressable
                style={styles.secondaryButton}
                onPress={() => void openCamera()}
              >
                <Ionicons
                  name="camera-outline"
                  size={19}
                  color={colors.brandPrimary}
                />
                <Text style={styles.secondaryButtonText}>Neu aufnehmen</Text>
              </Pressable>

              <Pressable
                style={styles.deletePhoto}
                onPress={() => {
                  setPhotoDataUrl(null);
                  setDescriptionMode(null);
                  setAiSuggestion(null);
                }}
              >
                <Ionicons name="trash-outline" size={20} color={colors.error} />
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable style={styles.photoButton} onPress={() => void openCamera()}>
            <Ionicons name="camera" size={28} color="#fff" />
            <Text style={styles.photoButtonText}>Wundfoto aufnehmen</Text>
          </Pressable>
        )}

        <Text style={styles.photoHint}>
          Foto nur mit entsprechender Einwilligung und gemäß den Datenschutzvorgaben
          der Einrichtung verwenden.
        </Text>

        {photoDataUrl ? (
          <View style={styles.descriptionChoiceCard}>
            <Text style={styles.descriptionChoiceTitle}>
              Wie soll die Wunde beschrieben werden?
            </Text>

            <Text style={styles.descriptionChoiceText}>
              Die KI erstellt nur einen prüfpflichtigen Vorschlag. Die fachliche
              Bewertung und Freigabe bleibt bei PFK, Wundexperte/Wundmanager oder Arzt.
            </Text>

            <View style={styles.descriptionChoiceRow}>
              <Pressable
                disabled={aiAnalyzing}
                onPress={() => void analyzeWoundPhoto()}
                style={[
                  styles.aiChoiceButton,
                  descriptionMode === "ai" && styles.aiChoiceButtonActive,
                  aiAnalyzing && { opacity: 0.6 },
                ]}
              >
                {aiAnalyzing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Ionicons name="sparkles" size={22} color="#fff" />
                )}
                <Text style={styles.aiChoiceButtonText}>
                  {aiAnalyzing ? "KI analysiert…" : "Mit KI beschreiben"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setDescriptionMode("manual");
                  setAiSuggestion(null);
                }}
                style={[
                  styles.manualChoiceButton,
                  descriptionMode === "manual" && styles.manualChoiceButtonActive,
                ]}
              >
                <Ionicons
                  name="create-outline"
                  size={22}
                  color={
                    descriptionMode === "manual"
                      ? "#fff"
                      : colors.brandPrimary
                  }
                />
                <Text
                  style={[
                    styles.manualChoiceButtonText,
                    descriptionMode === "manual" && { color: "#fff" },
                  ]}
                >
                  Selbst beschreiben
                </Text>
              </Pressable>
            </View>

            {aiSuggestion ? (
              <View style={styles.aiSuggestionCard}>
                <View style={styles.aiSuggestionHeader}>
                  <Ionicons
                    name="sparkles"
                    size={22}
                    color={colors.brandPrimary}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.aiSuggestionTitle}>KI-Vorschlag</Text>
                    <Text style={styles.aiSuggestionSub}>
                      Noch nicht gespeichert · bitte fachlich prüfen
                    </Text>
                  </View>
                </View>

                {!!aiSuggestion.description && (
                  <AiSuggestionLine
                    label="Beschreibung"
                    value={aiSuggestion.description}
                  />
                )}

                {!!aiSuggestion.wound_base && (
                  <AiSuggestionLine
                    label="Wundgrund"
                    value={aiSuggestion.wound_base}
                  />
                )}

                {!!aiSuggestion.wound_edge && (
                  <AiSuggestionLine
                    label="Wundrand"
                    value={aiSuggestion.wound_edge}
                  />
                )}

                {!!aiSuggestion.wound_surrounding_skin && (
                  <AiSuggestionLine
                    label="Wundumgebung"
                    value={aiSuggestion.wound_surrounding_skin}
                  />
                )}

                {!!aiSuggestion.exudate_visible && (
                  <AiSuggestionLine
                    label="Sichtbares Exsudat"
                    value={aiSuggestion.exudate_visible}
                  />
                )}

                {!!aiSuggestion.visible_findings && (
                  <AiSuggestionLine
                    label="Weitere sichtbare Merkmale"
                    value={aiSuggestion.visible_findings}
                  />
                )}

                {!!aiSuggestion.limitations && (
                  <View style={styles.aiLimitBox}>
                    <Ionicons
                      name="information-circle-outline"
                      size={18}
                      color="#7A5B00"
                    />
                    <Text style={styles.aiLimitText}>
                      {aiSuggestion.limitations}
                    </Text>
                  </View>
                )}

                <View style={styles.aiActions}>
                  <Pressable
                    onPress={applyAiSuggestion}
                    style={styles.applyAiButton}
                  >
                    <Ionicons name="checkmark" size={20} color="#fff" />
                    <Text style={styles.applyAiButtonText}>
                      KI-Vorschlag übernehmen
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={discardAiSuggestion}
                    style={styles.discardAiButton}
                  >
                    <Text style={styles.discardAiButtonText}>Verwerfen</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {descriptionMode === "manual" ? (
              <View style={styles.manualInfo}>
                <Ionicons
                  name="create-outline"
                  size={19}
                  color={colors.brandPrimary}
                />
                <Text style={styles.manualInfoText}>
                  Selbstbeschreibung aktiv. Die Felder Beschreibung, Wundgrund,
                  Wundrand und Wundumgebung können oben frei bearbeitet werden.
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        <Section title="Verlauf" icon="trending-up-outline" />

        <View style={styles.chips}>
          {PROGRESS.map((item) => (
            <Chip
              key={item}
              label={item}
              selected={progress === item}
              onPress={() => setProgress(item)}
            />
          ))}
        </View>

        <Pressable
          disabled={saving || !activePatient?.id}
          onPress={() => void save()}
          style={[
            styles.saveButton,
            (saving || !activePatient?.id) && { opacity: 0.5 },
          ]}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
              <Text style={styles.saveButtonText}>Wunddokumentation speichern</Text>
            </>
          )}
        </Pressable>

        <Section title="Bisheriger Wundverlauf" icon="time-outline" />

        {loading ? (
          <ActivityIndicator color={colors.brandPrimary} />
        ) : records.length === 0 ? (
          <Text style={styles.emptyText}>Noch keine Wunddokumentation vorhanden.</Text>
        ) : (
          records.map((record) => (
            <View key={record.id} style={styles.recordCard}>
              <View style={styles.recordTop}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recordTitle}>
                    {record.wound_type || "Wunde"} · {record.location || "ohne Lokalisation"}
                  </Text>
                  <Text style={styles.recordDate}>
                    {record.created_at
                      ? new Date(record.created_at).toLocaleString("de-DE")
                      : ""}
                  </Text>
                </View>
                <View style={styles.progressBadge}>
                  <Text style={styles.progressBadgeText}>
                    {record.progress || "Dokumentiert"}
                  </Text>
                </View>
              </View>

              {record.photo_data_url ? (
                <Image source={{ uri: record.photo_data_url }} style={styles.recordPhoto} />
              ) : null}

              <Text style={styles.recordText}>{record.description}</Text>

              {(record.length_cm || record.width_cm || record.depth_cm) ? (
                <Text style={styles.recordMeta}>
                  Maße: {record.length_cm ?? "–"} × {record.width_cm ?? "–"} ×{" "}
                  {record.depth_cm ?? "–"} cm
                </Text>
              ) : null}

              {record.responsible_caregiver ? (
                <Text style={styles.recordMeta}>PFK: {record.responsible_caregiver}</Text>
              ) : null}
              {record.responsible_doctor ? (
                <Text style={styles.recordMeta}>Arzt: {record.responsible_doctor}</Text>
              ) : null}
              {record.wound_manager ? (
                <Text style={styles.recordMeta}>Wundmanager: {record.wound_manager}</Text>
              ) : null}
            </View>
          ))
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function AiSuggestionLine({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.aiSuggestionLine}>
      <Text style={styles.aiSuggestionLabel}>{label}</Text>
      <Text style={styles.aiSuggestionValue}>{value}</Text>
    </View>
  );
}

function Section({
  title,
  icon,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={styles.section}>
      <Ionicons name={icon} size={21} color={colors.brandPrimary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  multiline?: boolean;
  keyboardType?: React.ComponentProps<typeof TextInput>["keyboardType"];
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.onSurfaceTertiary}
        multiline={multiline}
        keyboardType={keyboardType}
        textAlignVertical={multiline ? "top" : "center"}
        style={[styles.input, multiline && styles.multiline]}
      />
    </>
  );
}

function SmallField({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.smallLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={colors.onSurfaceTertiary}
        style={styles.smallInput}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surfaceSecondary },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  headerButton: { width: 42, height: 42, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { fontSize: 19, fontWeight: "800", color: colors.onSurface },
  headerSubtitle: { marginTop: 2, fontSize: 12, color: colors.onSurfaceSecondary },
  content: { padding: spacing.lg, paddingBottom: 60 },
  warningBox: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#FFF5DE",
    marginBottom: 12,
  },
  warningText: { flex: 1, color: "#714B00", fontWeight: "700" },
  section: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 19, fontWeight: "800", color: colors.onSurface },
  label: {
    marginTop: 12,
    marginBottom: 7,
    fontSize: 14,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  input: {
    minHeight: 52,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    fontSize: 15,
    color: colors.onSurface,
  },
  multiline: { minHeight: 100, paddingTop: 13 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: {
    backgroundColor: colors.brandPrimary,
    borderColor: colors.brandPrimary,
  },
  chipText: { fontSize: 13, fontWeight: "700", color: colors.onSurfaceSecondary },
  chipTextSelected: { color: "#fff" },
  triple: { flexDirection: "row", gap: 8 },
  smallLabel: {
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "700",
    color: colors.onSurfaceSecondary,
  },
  smallInput: {
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontSize: 15,
    color: colors.onSurface,
  },
  descriptionChoiceCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  descriptionChoiceTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.onSurface,
  },
  descriptionChoiceText: {
    marginTop: 5,
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceSecondary,
  },
  descriptionChoiceRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  aiChoiceButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 13,
    backgroundColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  aiChoiceButtonActive: {
    opacity: 0.9,
  },
  aiChoiceButtonText: {
    flexShrink: 1,
    color: "#fff",
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  manualChoiceButton: {
    flex: 1,
    minHeight: 58,
    borderRadius: 13,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
  },
  manualChoiceButtonActive: {
    backgroundColor: colors.brandPrimary,
  },
  manualChoiceButtonText: {
    flexShrink: 1,
    color: colors.brandPrimary,
    fontSize: 13,
    fontWeight: "800",
    textAlign: "center",
  },
  aiSuggestionCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  aiSuggestionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 4,
  },
  aiSuggestionTitle: {
    color: colors.onSurface,
    fontWeight: "800",
    fontSize: 16,
  },
  aiSuggestionSub: {
    marginTop: 2,
    color: colors.onSurfaceTertiary,
    fontSize: 11,
  },
  aiSuggestionLine: {
    marginTop: 11,
  },
  aiSuggestionLabel: {
    color: colors.brandPrimary,
    fontSize: 12,
    fontWeight: "800",
  },
  aiSuggestionValue: {
    marginTop: 3,
    color: colors.onSurfaceSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  aiLimitBox: {
    marginTop: 12,
    flexDirection: "row",
    gap: 7,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#FFF5D9",
  },
  aiLimitText: {
    flex: 1,
    color: "#6B5300",
    fontSize: 12,
    lineHeight: 18,
  },
  aiActions: {
    marginTop: 14,
    gap: 8,
  },
  applyAiButton: {
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  applyAiButtonText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
  },
  discardAiButton: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  discardAiButtonText: {
    color: colors.onSurfaceSecondary,
    fontWeight: "800",
  },
  manualInfo: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  manualInfoText: {
    flex: 1,
    color: colors.onSurfaceSecondary,
    fontSize: 12,
    lineHeight: 18,
  },
  photoButton: {
    height: 58,
    borderRadius: 14,
    backgroundColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  photoButtonText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  photoHint: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 18,
    color: colors.onSurfaceTertiary,
  },
  photoCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    overflow: "hidden",
  },
  photo: { width: "100%", height: 300, resizeMode: "cover" },
  photoActions: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryButtonText: { color: colors.brandPrimary, fontWeight: "800" },
  deletePhoto: {
    width: 44,
    height: 44,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF1F1",
  },
  saveButton: {
    marginTop: 26,
    minHeight: 58,
    borderRadius: 14,
    backgroundColor: colors.brandPrimary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  saveButtonText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  emptyText: {
    padding: 18,
    textAlign: "center",
    color: colors.onSurfaceSecondary,
    backgroundColor: colors.surface,
    borderRadius: 14,
  },
  recordCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  recordTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  recordTitle: { fontSize: 15, fontWeight: "800", color: colors.onSurface },
  recordDate: { marginTop: 3, fontSize: 12, color: colors.onSurfaceTertiary },
  progressBadge: {
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  progressBadgeText: { fontSize: 11, fontWeight: "800", color: colors.brandPrimary },
  recordPhoto: { width: "100%", height: 210, borderRadius: 12, marginTop: 12 },
  recordText: { marginTop: 10, color: colors.onSurfaceSecondary, lineHeight: 20 },
  recordMeta: { marginTop: 5, fontSize: 12, color: colors.onSurfaceTertiary },
  cameraScreen: { flex: 1, backgroundColor: "#000" },
  cameraTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  cameraClose: { width: 48, height: 48, alignItems: "center", justifyContent: "center" },
  cameraTitle: { flex: 1, textAlign: "center", color: "#fff", fontSize: 17, fontWeight: "800" },
  cameraBottom: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  shutterOuter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 5,
    borderColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#fff" },
});
