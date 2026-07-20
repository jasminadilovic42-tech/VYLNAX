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

const GENDERS = ["Weiblich", "Männlich", "Divers"];

const CARE_GRADES = [
  "Kein Pflegegrad",
  "Pflegegrad 1",
  "Pflegegrad 2",
  "Pflegegrad 3",
  "Pflegegrad 4",
  "Pflegegrad 5",
  "Beantragt",
];

const LIVING_SITUATIONS = [
  "Eigene Wohnung",
  "Bei Angehörigen",
  "Betreutes Wohnen",
  "Pflegeheim",
  "Krankenhaus",
  "Kurzzeitpflege",
  "Tagespflege",
  "Andere",
];

const BLOOD_GROUPS = [
  "Unbekannt",
  "A+",
  "A−",
  "B+",
  "B−",
  "AB+",
  "AB−",
  "0+",
  "0−",
];

const ALLERGY_TYPES = [
  "Keine bekannt",
  "Medikamente",
  "Penicillin",
  "Antibiotika",
  "Schmerzmittel",
  "Kontrastmittel",
  "Latex",
  "Pflaster / Klebstoff",
  "Nahrungsmittel",
  "Insektenstiche",
  "Pollen",
  "Hausstaub",
  "Andere",
];

const ANTICOAGULANTS = [
  "Keine",
  "ASS / Acetylsalicylsäure",
  "Clopidogrel",
  "Phenprocoumon / Marcumar",
  "Warfarin",
  "Apixaban / Eliquis",
  "Rivaroxaban / Xarelto",
  "Edoxaban / Lixiana",
  "Dabigatran / Pradaxa",
  "Heparin",
  "Andere",
];

const MOBILITY_LEVELS = [
  "Selbstständig",
  "Mit Gehstock",
  "Mit Rollator",
  "Mit Rollstuhl",
  "Teilweise Unterstützung",
  "Vollständige Unterstützung",
  "Bettlägerig",
];

const ORIENTATION_LEVELS = [
  "Voll orientiert",
  "Zeitlich eingeschränkt",
  "Örtlich eingeschränkt",
  "Situativ eingeschränkt",
  "Zur Person eingeschränkt",
  "Desorientiert",
];

const NUTRITION_TYPES = [
  "Normalkost",
  "Diabeteskost",
  "Leichte Vollkost",
  "Vegetarisch",
  "Pürierte Kost",
  "Passierte Kost",
  "Andickungsmittel",
  "Sondennahrung",
  "PEG",
  "Parenterale Ernährung",
];

const CONTINENCE_TYPES = [
  "Kontinent",
  "Harninkontinent",
  "Stuhlinkontinent",
  "Doppelte Inkontinenz",
  "Dauerkatheter",
  "Suprapubischer Katheter",
  "Urostoma",
  "Colostoma / Ileostoma",
];

export default function AddPatient() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [healthInsurance, setHealthInsurance] = useState("");
  const [careGrade, setCareGrade] = useState("");
  const [bloodGroup, setBloodGroup] = useState("Unbekannt");

  const [phone, setPhone] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");

  const [livingSituation, setLivingSituation] = useState("");
  const [facilityName, setFacilityName] = useState("");
  const [ward, setWard] = useState("");
  const [room, setRoom] = useState("");
  const [nursingService, setNursingService] = useState("");

  const [diagnoses, setDiagnoses] = useState("");
  const [secondaryDiagnoses, setSecondaryDiagnoses] = useState("");
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [allergyNotes, setAllergyNotes] = useState("");

  const [selectedAnticoagulants, setSelectedAnticoagulants] = useState<
    string[]
  >([]);
  const [anticoagulantDose, setAnticoagulantDose] = useState("");
  const [anticoagulantNotes, setAnticoagulantNotes] = useState("");

  const [hasDiabetes, setHasDiabetes] = useState(false);
  const [hasEpilepsy, setHasEpilepsy] = useState(false);
  const [hasDementia, setHasDementia] = useState(false);
  const [hasParkinson, setHasParkinson] = useState(false);
  const [hasCopd, setHasCopd] = useState(false);
  const [hasHeartFailure, setHasHeartFailure] = useState(false);
  const [hasKidneyDisease, setHasKidneyDisease] = useState(false);
  const [hasSwallowingDisorder, setHasSwallowingDisorder] =
    useState(false);
  const [hasPacemaker, setHasPacemaker] = useState(false);
  const [hasPain, setHasPain] = useState(false);

  const [fallRisk, setFallRisk] = useState(false);
  const [pressureUlcerRisk, setPressureUlcerRisk] = useState(false);
  const [dehydrationRisk, setDehydrationRisk] = useState(false);
  const [malnutritionRisk, setMalnutritionRisk] = useState(false);
  const [aspirationRisk, setAspirationRisk] = useState(false);
  const [wanderingRisk, setWanderingRisk] = useState(false);
  const [bleedingRisk, setBleedingRisk] = useState(false);

  const [mobility, setMobility] = useState("");
  const [orientation, setOrientation] = useState("");
  const [nutrition, setNutrition] = useState<string[]>([]);
  const [continence, setContinence] = useState<string[]>([]);

  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [targetFluid, setTargetFluid] = useState("");

  const [hearingAid, setHearingAid] = useState(false);
  const [glasses, setGlasses] = useState(false);
  const [dentures, setDentures] = useState(false);
  const [oxygenTherapy, setOxygenTherapy] = useState(false);

  const [houseDoctor, setHouseDoctor] = useState("");
  const [pharmacy, setPharmacy] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");

  const [specialInstructions, setSpecialInstructions] = useState("");
  const [careNotes, setCareNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggleListValue = (
    value: string,
    values: string[],
    setValues: React.Dispatch<React.SetStateAction<string[]>>
  ) => {
    setValues((current) => {
      if (current.includes(value)) {
        return current.filter((item) => item !== value);
      }

      return [...current, value];
    });
  };

  const save = async () => {
    setError("");

    if (!firstName.trim()) {
      setError("Bitte geben Sie den Vornamen ein.");
      return;
    }

    if (!lastName.trim()) {
      setError("Bitte geben Sie den Nachnamen ein.");
      return;
    }

    if (!birthDate.trim()) {
      setError("Bitte geben Sie das Geburtsdatum ein.");
      return;
    }

    if (!careGrade) {
      setError("Bitte wählen Sie den Pflegegrad.");
      return;
    }

    setSaving(true);

    try {
      await api("/patients", {
        method: "POST",
        body: {
          name: `${firstName.trim()} ${lastName.trim()}`,
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          birth_date: birthDate.trim(),
          gender: gender || null,

          insurance_number: insuranceNumber.trim() || null,
          health_insurance: healthInsurance.trim() || null,
          care_grade: careGrade,
          blood_group: bloodGroup,

          contact: {
            phone: phone.trim() || null,
            mobile: mobile.trim() || null,
            email: email.trim() || null,
            address: address.trim() || null,
          },

          accommodation: {
            living_situation: livingSituation || null,
            facility_name: facilityName.trim() || null,
            ward: ward.trim() || null,
            room: room.trim() || null,
            nursing_service: nursingService.trim() || null,
          },

          medical_information: {
            diagnoses: diagnoses.trim() || null,
            secondary_diagnoses:
              secondaryDiagnoses.trim() || null,

            allergies: selectedAllergies,
            allergy_notes: allergyNotes.trim() || null,

            anticoagulants: selectedAnticoagulants,
            anticoagulant_dose:
              anticoagulantDose.trim() || null,
            anticoagulant_notes:
              anticoagulantNotes.trim() || null,

            conditions: {
              diabetes: hasDiabetes,
              epilepsy: hasEpilepsy,
              dementia: hasDementia,
              parkinson: hasParkinson,
              copd: hasCopd,
              heart_failure: hasHeartFailure,
              kidney_disease: hasKidneyDisease,
              swallowing_disorder: hasSwallowingDisorder,
              pacemaker: hasPacemaker,
              chronic_pain: hasPain,
            },
          },

          nursing_assessment: {
            risks: {
              fall: fallRisk,
              pressure_ulcer: pressureUlcerRisk,
              dehydration: dehydrationRisk,
              malnutrition: malnutritionRisk,
              aspiration: aspirationRisk,
              wandering: wanderingRisk,
              bleeding: bleedingRisk,
            },

            mobility: mobility || null,
            orientation: orientation || null,
            nutrition,
            continence,

            aids: {
              hearing_aid: hearingAid,
              glasses,
              dentures,
              oxygen_therapy: oxygenTherapy,
            },
          },

          physical_information: {
            weight_kg: weight ? Number(weight.replace(",", ".")) : null,
            height_cm: height ? Number(height.replace(",", ".")) : null,
            target_fluid_ml: targetFluid
              ? Number(targetFluid)
              : null,
          },

          professional_contacts: {
            house_doctor: houseDoctor.trim() || null,
            pharmacy: pharmacy.trim() || null,
            emergency_contact:
              emergencyContact.trim() || null,
            emergency_phone: emergencyPhone.trim() || null,
          },

          special_instructions:
            specialInstructions.trim() || null,
          notes: careNotes.trim() || null,

          room: room.trim() || null,
        },
      });

      router.back();
    } catch (err) {
      console.log("Patient save error:", err);

      setError(
        "Speichern fehlgeschlagen. Bitte prüfen Sie die Verbindung und versuchen Sie es erneut."
      );
    } finally {
      setSaving(false);
    }
  };

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
          testID="close-patient-form"
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
          <Text style={styles.headerTitle}>
            Patient hinzufügen
          </Text>

          <Text style={styles.headerSubtitle}>
            Pflege- und Gesundheitsdaten
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
          label="Geburtsdatum *"
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

        <Text style={styles.label}>Pflegegrad *</Text>

        <View style={styles.chipContainer}>
          {CARE_GRADES.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={careGrade === item}
              onPress={() => setCareGrade(item)}
            />
          ))}
        </View>

        <Field
          label="Krankenkasse"
          value={healthInsurance}
          onChangeText={setHealthInsurance}
          placeholder="z. B. AOK, KKH, TK"
          autoCapitalize="words"
        />

        <Field
          label="Versichertennummer"
          value={insuranceNumber}
          onChangeText={setInsuranceNumber}
          placeholder="Versichertennummer"
          autoCapitalize="characters"
        />

        <Text style={styles.label}>Blutgruppe</Text>

        <View style={styles.chipContainer}>
          {BLOOD_GROUPS.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={bloodGroup === item}
              onPress={() => setBloodGroup(item)}
            />
          ))}
        </View>

        <SectionHeader
          icon="call-outline"
          title="Kontakt"
        />

        <Field
          label="Telefon"
          value={phone}
          onChangeText={setPhone}
          placeholder="Telefonnummer"
          keyboardType="phone-pad"
        />

        <Field
          label="Mobiltelefon"
          value={mobile}
          onChangeText={setMobile}
          placeholder="Mobilnummer"
          keyboardType="phone-pad"
        />

        <Field
          label="E-Mail"
          value={email}
          onChangeText={setEmail}
          placeholder="E-Mail-Adresse"
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
          icon="home-outline"
          title="Wohn- und Versorgungssituation"
        />

        <Text style={styles.label}>Wohnsituation</Text>

        <View style={styles.chipContainer}>
          {LIVING_SITUATIONS.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={livingSituation === item}
              onPress={() => setLivingSituation(item)}
            />
          ))}
        </View>

        <Field
          label="Einrichtung"
          value={facilityName}
          onChangeText={setFacilityName}
          placeholder="Pflegeheim oder Krankenhaus"
          autoCapitalize="words"
        />

        <Field
          label="Station / Wohnbereich"
          value={ward}
          onChangeText={setWard}
          placeholder="z. B. Station 2"
        />

        <Field
          label="Zimmer"
          value={room}
          onChangeText={setRoom}
          placeholder="z. B. Zimmer 12"
        />

        <Field
          label="Ambulanter Pflegedienst"
          value={nursingService}
          onChangeText={setNursingService}
          placeholder="Name des Pflegedienstes"
          autoCapitalize="words"
        />

        <SectionHeader
          icon="medical-outline"
          title="Diagnosen und Erkrankungen"
        />

        <Field
          label="Hauptdiagnosen"
          value={diagnoses}
          onChangeText={setDiagnoses}
          placeholder="Diagnosen mit Freitext eingeben"
          multiline
        />

        <Field
          label="Nebendiagnosen"
          value={secondaryDiagnoses}
          onChangeText={setSecondaryDiagnoses}
          placeholder="Weitere relevante Diagnosen"
          multiline
        />

        <ToggleRow
          title="Diabetes mellitus"
          description="Diabetesdiagnose oder regelmäßige Blutzuckerkontrolle."
          value={hasDiabetes}
          onValueChange={setHasDiabetes}
        />

        <ToggleRow
          title="Epilepsie"
          description="Bekannte Epilepsie oder Krampfanfälle."
          value={hasEpilepsy}
          onValueChange={setHasEpilepsy}
        />

        <ToggleRow
          title="Demenz"
          description="Kognitive Einschränkung oder Demenzerkrankung."
          value={hasDementia}
          onValueChange={setHasDementia}
        />

        <ToggleRow
          title="Parkinson"
          description="Parkinson-Syndrom oder relevante Bewegungsstörung."
          value={hasParkinson}
          onValueChange={setHasParkinson}
        />

        <ToggleRow
          title="COPD / Atemwegserkrankung"
          description="Chronische Atemwegserkrankung."
          value={hasCopd}
          onValueChange={setHasCopd}
        />

        <ToggleRow
          title="Herzinsuffizienz"
          description="Herzschwäche oder relevante Herzerkrankung."
          value={hasHeartFailure}
          onValueChange={setHasHeartFailure}
        />

        <ToggleRow
          title="Nierenerkrankung"
          description="Niereninsuffizienz oder Dialysepflicht."
          value={hasKidneyDisease}
          onValueChange={setHasKidneyDisease}
        />

        <ToggleRow
          title="Schluckstörung"
          description="Dysphagie oder erhöhte Aspirationsgefahr."
          value={hasSwallowingDisorder}
          onValueChange={setHasSwallowingDisorder}
        />

        <ToggleRow
          title="Herzschrittmacher"
          description="Implantierter Herzschrittmacher oder Defibrillator."
          value={hasPacemaker}
          onValueChange={setHasPacemaker}
        />

        <ToggleRow
          title="Chronische Schmerzen"
          description="Regelmäßiger Schmerz oder Schmerztherapie."
          value={hasPain}
          onValueChange={setHasPain}
        />

        <SectionHeader
          icon="alert-circle-outline"
          title="Allergien und Unverträglichkeiten"
        />

        <Text style={styles.infoText}>
          Bekannte Allergien auswählen. Genaues Medikament oder
          Reaktion zusätzlich im Notizfeld eintragen.
        </Text>

        <View style={styles.chipContainer}>
          {ALLERGY_TYPES.map((item) => (
            <MultiChoiceChip
              key={item}
              label={item}
              selected={selectedAllergies.includes(item)}
              onPress={() =>
                toggleListValue(
                  item,
                  selectedAllergies,
                  setSelectedAllergies
                )
              }
            />
          ))}
        </View>

        <Field
          label="Allergien – Details und Reaktionen"
          value={allergyNotes}
          onChangeText={setAllergyNotes}
          placeholder="z. B. Penicillin: Hautausschlag und Atemnot"
          multiline
        />

        <SectionHeader
          icon="water-outline"
          title="Blutverdünner / Antikoagulation"
        />

        <Text style={styles.infoText}>
          Blutverdünnende Medikamente auswählen. Dosierung und
          Einnahmezeit zusätzlich eintragen.
        </Text>

        <View style={styles.chipContainer}>
          {ANTICOAGULANTS.map((item) => (
            <MultiChoiceChip
              key={item}
              label={item}
              selected={selectedAnticoagulants.includes(item)}
              onPress={() =>
                toggleListValue(
                  item,
                  selectedAnticoagulants,
                  setSelectedAnticoagulants
                )
              }
            />
          ))}
        </View>

        <Field
          label="Dosierung"
          value={anticoagulantDose}
          onChangeText={setAnticoagulantDose}
          placeholder="z. B. Apixaban 5 mg, morgens und abends"
          multiline
        />

        <Field
          label="Hinweise zur Antikoagulation"
          value={anticoagulantNotes}
          onChangeText={setAnticoagulantNotes}
          placeholder="INR-Kontrolle, Blutungszeichen oder ärztliche Vorgaben"
          multiline
        />

        <SectionHeader
          icon="shield-checkmark-outline"
          title="Pflegerelevante Risiken"
        />

        <ToggleRow
          title="Sturzrisiko"
          description="Erhöhte Sturzgefahr oder Sturzereignisse in der Vorgeschichte."
          value={fallRisk}
          onValueChange={setFallRisk}
        />

        <ToggleRow
          title="Dekubitusrisiko"
          description="Erhöhtes Risiko für Druckverletzungen."
          value={pressureUlcerRisk}
          onValueChange={setPressureUlcerRisk}
        />

        <ToggleRow
          title="Exsikkose- / Dehydrationsrisiko"
          description="Erhöhtes Risiko für Flüssigkeitsmangel."
          value={dehydrationRisk}
          onValueChange={setDehydrationRisk}
        />

        <ToggleRow
          title="Mangelernährungsrisiko"
          description="Gewichtsverlust, verminderte Nahrungsaufnahme oder Untergewicht."
          value={malnutritionRisk}
          onValueChange={setMalnutritionRisk}
        />

        <ToggleRow
          title="Aspirationsrisiko"
          description="Risiko des Verschluckens oder Eindringens in die Atemwege."
          value={aspirationRisk}
          onValueChange={setAspirationRisk}
        />

        <ToggleRow
          title="Weglauftendenz"
          description="Unbeaufsichtigtes Verlassen des sicheren Bereichs möglich."
          value={wanderingRisk}
          onValueChange={setWanderingRisk}
        />

        <ToggleRow
          title="Blutungsrisiko"
          description="Erhöhtes Blutungsrisiko, insbesondere bei Antikoagulation."
          value={bleedingRisk}
          onValueChange={setBleedingRisk}
        />

        <SectionHeader
          icon="body-outline"
          title="Mobilität und Orientierung"
        />

        <Text style={styles.label}>Mobilität</Text>

        <View style={styles.chipContainer}>
          {MOBILITY_LEVELS.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={mobility === item}
              onPress={() => setMobility(item)}
            />
          ))}
        </View>

        <Text style={styles.label}>Orientierung</Text>

        <View style={styles.chipContainer}>
          {ORIENTATION_LEVELS.map((item) => (
            <ChoiceChip
              key={item}
              label={item}
              selected={orientation === item}
              onPress={() => setOrientation(item)}
            />
          ))}
        </View>

        <SectionHeader
          icon="nutrition-outline"
          title="Ernährung und Ausscheidung"
        />

        <Text style={styles.label}>Kostform</Text>

        <View style={styles.chipContainer}>
          {NUTRITION_TYPES.map((item) => (
            <MultiChoiceChip
              key={item}
              label={item}
              selected={nutrition.includes(item)}
              onPress={() =>
                toggleListValue(item, nutrition, setNutrition)
              }
            />
          ))}
        </View>

        <Text style={styles.label}>Kontinenz und Ableitung</Text>

        <View style={styles.chipContainer}>
          {CONTINENCE_TYPES.map((item) => (
            <MultiChoiceChip
              key={item}
              label={item}
              selected={continence.includes(item)}
              onPress={() =>
                toggleListValue(item, continence, setContinence)
              }
            />
          ))}
        </View>

        <Field
          label="Gewicht in kg"
          value={weight}
          onChangeText={setWeight}
          placeholder="z. B. 75"
          keyboardType="decimal-pad"
        />

        <Field
          label="Körpergröße in cm"
          value={height}
          onChangeText={setHeight}
          placeholder="z. B. 170"
          keyboardType="numeric"
        />

        <Field
          label="Trinkziel pro Tag in ml"
          value={targetFluid}
          onChangeText={setTargetFluid}
          placeholder="z. B. 1500"
          keyboardType="numeric"
        />

        <SectionHeader
          icon="eye-outline"
          title="Hilfsmittel"
        />

        <ToggleRow
          title="Brille"
          description="Brille oder Sehhilfe vorhanden."
          value={glasses}
          onValueChange={setGlasses}
        />

        <ToggleRow
          title="Hörgerät"
          description="Hörgerät oder andere Hörhilfe vorhanden."
          value={hearingAid}
          onValueChange={setHearingAid}
        />

        <ToggleRow
          title="Zahnersatz"
          description="Voll- oder Teilprothese vorhanden."
          value={dentures}
          onValueChange={setDentures}
        />

        <ToggleRow
          title="Sauerstofftherapie"
          description="Regelmäßige oder bedarfsweise Sauerstoffversorgung."
          value={oxygenTherapy}
          onValueChange={setOxygenTherapy}
        />

        <SectionHeader
          icon="people-outline"
          title="Wichtige Kontakte"
        />

        <Field
          label="Hausarzt"
          value={houseDoctor}
          onChangeText={setHouseDoctor}
          placeholder="Name der Hausarztpraxis"
          autoCapitalize="words"
        />

        <Field
          label="Stammapotheke"
          value={pharmacy}
          onChangeText={setPharmacy}
          placeholder="Name der Apotheke"
          autoCapitalize="words"
        />

        <Field
          label="Notfallkontakt"
          value={emergencyContact}
          onChangeText={setEmergencyContact}
          placeholder="Name der Kontaktperson"
          autoCapitalize="words"
        />

        <Field
          label="Telefon des Notfallkontakts"
          value={emergencyPhone}
          onChangeText={setEmergencyPhone}
          placeholder="Telefonnummer"
          keyboardType="phone-pad"
        />

        <SectionHeader
          icon="document-text-outline"
          title="Besondere Hinweise"
        />

        <Field
          label="Notfall- und Sicherheitsinformationen"
          value={specialInstructions}
          onChangeText={setSpecialInstructions}
          placeholder="Wichtige Informationen für Pflegekräfte und Angehörige"
          multiline
        />

        <Field
          label="Pflegeanamnese / Notizen"
          value={careNotes}
          onChangeText={setCareNotes}
          placeholder="Gewohnheiten, Ressourcen, Wünsche und weitere pflegerelevante Hinweise"
          multiline
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
          testID="save-patient"
          label="Patient speichern"
          icon="checkmark-circle-outline"
          loading={saving}
          onPress={save}
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
  keyboardType?: React.ComponentProps<
    typeof TextInput
  >["keyboardType"];
  autoCapitalize?: React.ComponentProps<
    typeof TextInput
  >["autoCapitalize"];
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
  icon: React.ComponentProps<typeof Ionicons>["name"];
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

function MultiChoiceChip({
  label,
  selected,
  onPress,
}: ChoiceChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        selected && styles.multiChipSelected,
      ]}
    >
      {selected ? (
        <Ionicons
          name="checkmark"
          size={16}
          color="#FFFFFF"
          style={styles.chipCheck}
        />
      ) : null}

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
    marginTop: spacing.xl,
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

  infoText: {
    color: colors.onSurfaceSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.md,
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
    minHeight: 96,
    paddingTop: spacing.md,
  },

  chipContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },

  chip: {
    flexDirection: "row",
    alignItems: "center",
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

  multiChipSelected: {
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

  chipCheck: {
    marginRight: 5,
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