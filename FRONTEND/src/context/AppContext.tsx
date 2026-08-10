import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";

export type Patient = {
  id: string;
  name: string;
  photo_data?: string | null;

  first_name?: string | null;
  last_name?: string | null;
  birth_date?: string | null;
  gender?: string | null;
  age?: number | null;

  insurance_number?: string | null;
  health_insurance?: string | null;
  care_grade?: string | null;
  blood_group?: string | null;

  contact?: Record<string, any> | null;
  accommodation?: Record<string, any> | null;
  medical_information?: Record<string, any> | null;
  nursing_assessment?: Record<string, any> | null;
  physical_information?: Record<string, any> | null;
  professional_contacts?: Record<string, any> | null;

  special_instructions?: string | null;
  room?: string | null;
  notes?: string | null;

  is_self?: boolean;
  is_demo?: boolean;
  allergies?: string[];

  created_at?: string;
  updated_at?: string;
};

export type Relative = {
  id?: string;
  _id?: string;

  patient_id?: string | null;

  first_name?: string;
  last_name?: string;
  birth_date?: string | null;
  gender?: string | null;
  relationship?: string | null;

  phone?: string | null;
  mobile?: string | null;
  email?: string | null;
  address?: string | null;

  is_emergency_contact?: boolean;
  emergency_priority?: number | null;

  permissions?: Record<string, boolean> | null;
  notifications?: Record<string, boolean> | null;

  notes?: string | null;

  created_at?: string;
  updated_at?: string;
};

export type Caregiver = {
  id?: string;
  _id?: string;

  patient_id?: string | null;

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

  permissions?: Record<string, boolean> | null;
  notifications?: Record<string, boolean> | null;

  notes?: string | null;

  created_at?: string;
  updated_at?: string;
};

export type Doctor = {
  id?: string;
  _id?: string;

  patient_id?: string | null;

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

  permissions?: Record<string, boolean> | null;
  notifications?: Record<string, boolean> | null;

  notes?: string | null;

  created_at?: string;
  updated_at?: string;
};

type AppState = {
  patients: Patient[];
  activePatient: Patient | null;

  relatives: Relative[];
  caregivers: Caregiver[];
  doctors: Doctor[];

  loadingPatients: boolean;
  loadingPatientContacts: boolean;
  switchingPatient: boolean;

  loadPatients: () => Promise<void>;
  loadPatientContacts: (patientId?: string) => Promise<void>;

  selectPatient: (patient: Patient) => Promise<void>;

  /*
   * Ostavljeno zbog kompatibilnosti sa starijim ekranima.
   * Za novi PFK workflow koristi selectPatient().
   */
  setActivePatient: React.Dispatch<
    React.SetStateAction<Patient | null>
  >;

  refreshActivePatient: () => Promise<void>;
};

const AppContext = createContext<AppState>({} as AppState);

export const useApp = () => useContext(AppContext);

export function AppProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const {
    user,
    accessUser,
  } = useAuth();

  const [patients, setPatients] = useState<Patient[]>([]);
  const [activePatient, setActivePatient] =
    useState<Patient | null>(null);

  const [relatives, setRelatives] = useState<Relative[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const [loadingPatients, setLoadingPatients] = useState(false);
  const [
    loadingPatientContacts,
    setLoadingPatientContacts,
  ] = useState(false);

  const [switchingPatient, setSwitchingPatient] =
    useState(false);

  /*
   * =====================================================
   * KONTAKTI AKTIVNOG PACIJENTA
   * =====================================================
   *
   * Backend već podržava:
   *
   * GET /relatives?patient_id=...
   * GET /caregivers?patient_id=...
   * GET /doctors?patient_id=...
   */
  const loadPatientContacts = useCallback(
    async (patientId?: string) => {
      const targetPatientId =
        patientId || activePatient?.id;

      if (!targetPatientId) {
        setRelatives([]);
        setCaregivers([]);
        setDoctors([]);
        return;
      }

      setLoadingPatientContacts(true);

      try {
        const [
          relativeResult,
          caregiverResult,
          doctorResult,
        ] = await Promise.all([
          api<Relative[]>(
            `/relatives?patient_id=${encodeURIComponent(
              targetPatientId
            )}`
          ),
          api<Caregiver[]>(
            `/caregivers?patient_id=${encodeURIComponent(
              targetPatientId
            )}`
          ),
          api<Doctor[]>(
            `/doctors?patient_id=${encodeURIComponent(
              targetPatientId
            )}`
          ),
        ]);

        setRelatives(
          Array.isArray(relativeResult)
            ? relativeResult
            : []
        );

        setCaregivers(
          Array.isArray(caregiverResult)
            ? caregiverResult
            : []
        );

        setDoctors(
          Array.isArray(doctorResult)
            ? doctorResult
            : []
        );
      } catch (error) {
        console.warn(
          "VYLNAX patient contacts konnten nicht geladen werden:",
          error
        );

        setRelatives([]);
        setCaregivers([]);
        setDoctors([]);
      } finally {
        setLoadingPatientContacts(false);
      }
    },
    [activePatient?.id]
  );

  /*
   * =====================================================
   * UČITAVANJE SVIH PACIJENATA
   * =====================================================
   *
   * PFK dobija kompletnu listu pacijenata VYLNAX accounta.
   *
   * Kod prvog učitavanja:
   *
   * 1. Ako trenutno aktivni pacijent još postoji,
   *    zadržavamo njega.
   *
   * 2. Ako accessUser ima patient_id,
   *    pokušavamo njega postaviti kao početnog.
   *
   * 3. Inače uzimamo prvog pacijenta.
   */
  const loadPatients = useCallback(async () => {
    setLoadingPatients(true);

    try {
      const result = await api<Patient[]>("/patients");

      const list = Array.isArray(result)
        ? result
        : [];

      setPatients(list);

      let nextPatient: Patient | null = null;

      setActivePatient((currentPatient) => {
        if (currentPatient?.id) {
          const existingPatient = list.find(
            (patient) =>
              patient.id === currentPatient.id
          );

          if (existingPatient) {
            nextPatient = existingPatient;
            return existingPatient;
          }
        }

        if (accessUser?.patient_id) {
          const assignedPatient = list.find(
            (patient) =>
              patient.id ===
              accessUser.patient_id
          );

          if (assignedPatient) {
            nextPatient = assignedPatient;
            return assignedPatient;
          }
        }

        nextPatient = list[0] || null;

        return nextPatient;
      });

      /*
       * setState callback je sinhron,
       * ali nextPatient nam omogućava da odmah
       * učitamo kontakte za odabrani zapis.
       */
      const selectedPatient = nextPatient as Patient | null;

if (selectedPatient?.id) {
  await loadPatientContacts(selectedPatient.id);
} else {
  setRelatives([]);
  setCaregivers([]);
  setDoctors([]);
}
    } catch (error) {
      console.warn(
        "VYLNAX patients konnten nicht geladen werden:",
        error
      );

      setPatients([]);
      setActivePatient(null);

      setRelatives([]);
      setCaregivers([]);
      setDoctors([]);
    } finally {
      setLoadingPatients(false);
    }
  }, [
    accessUser?.patient_id,
    loadPatientContacts,
  ]);

  /*
   * =====================================================
   * IZBOR AKTIVNOG PACIJENTA
   * =====================================================
   *
   * Ovo je ključna funkcija za PFK workflow.
   *
   * Pflegefachkraft:
   *
   * Patientenliste
   *      ↓
   * izabere pacijenta
   *      ↓
   * PUT /access/active-patient
   *      ↓
   * activePatient se mijenja
   *      ↓
   * učitavaju se njegova rodbina,
   * doktori i Pflegekräfte
   *      ↓
   * cijela aplikacija koristi activePatient.id
   */
  const selectPatient = useCallback(
    async (patient: Patient) => {
      if (!patient?.id) {
        return;
      }

      if (
        switchingPatient ||
        activePatient?.id === patient.id
      ) {
        /*
         * Ako je isti pacijent,
         * ipak možemo osvježiti njegove kontakte.
         */
        if (
          activePatient?.id === patient.id
        ) {
          await loadPatientContacts(patient.id);
        }

        return;
      }

      setSwitchingPatient(true);

      try {
        /*
         * Aktivna PIN sesija mora dobiti informaciju
         * kojeg pacijenta je PFK trenutno izabrao.
         *
         * access: true šalje X-Access-Token.
         */
        if (accessUser) {
          await api(
            "/access/active-patient",
            {
              method: "PUT",
              access: true,
              body: {
                patient_id: patient.id,
              },
            }
          );
        }

        setActivePatient(patient);

        await loadPatientContacts(
          patient.id
        );

        console.log(
          "VYLNAX ACTIVE PATIENT:",
          {
            id: patient.id,
            name: patient.name,
            role: accessUser?.role,
          }
        );
      } catch (error) {
        console.warn(
          "Aktiver Patient konnte nicht gewechselt werden:",
          error
        );

        throw error;
      } finally {
        setSwitchingPatient(false);
      }
    },
    [
      accessUser,
      activePatient?.id,
      loadPatientContacts,
      switchingPatient,
    ]
  );

  /*
   * =====================================================
   * OSVJEŽI AKTIVNOG PACIJENTA
   * =====================================================
   *
   * Koristi se nakon spremanja novih podataka
   * ili nakon povratka na ekran pacijenta.
   */
  const refreshActivePatient =
    useCallback(async () => {
      if (!activePatient?.id) {
        await loadPatients();
        return;
      }

      try {
        const result =
          await api<Patient[]>("/patients");

        const list = Array.isArray(result)
          ? result
          : [];

        setPatients(list);

        const refreshedPatient =
          list.find(
            (patient) =>
              patient.id ===
              activePatient.id
          ) || null;

        if (refreshedPatient) {
          setActivePatient(refreshedPatient);

          await loadPatientContacts(
            refreshedPatient.id
          );
        } else {
          setActivePatient(list[0] || null);

          if (list[0]?.id) {
            await loadPatientContacts(
              list[0].id
            );
          } else {
            setRelatives([]);
            setCaregivers([]);
            setDoctors([]);
          }
        }
      } catch (error) {
        console.warn(
          "Aktiver Patient konnte nicht aktualisiert werden:",
          error
        );
      }
    }, [
      activePatient?.id,
      loadPatientContacts,
      loadPatients,
    ]);

  /*
   * =====================================================
   * START / LOGIN
   * =====================================================
   */
  useEffect(() => {
    if (user) {
      void loadPatients();
    } else {
      setPatients([]);
      setActivePatient(null);

      setRelatives([]);
      setCaregivers([]);
      setDoctors([]);
    }
  }, [
    user,
    loadPatients,
  ]);

  /*
   * Ako se aktivni pacijent promijeni iz nekog
   * starijeg ekrana koji još direktno koristi
   * setActivePatient(), ipak učitaj njegove kontakte.
   */
  useEffect(() => {
    if (activePatient?.id) {
      void loadPatientContacts(
        activePatient.id
      );
    } else {
      setRelatives([]);
      setCaregivers([]);
      setDoctors([]);
    }
  }, [
    activePatient?.id,
    loadPatientContacts,
  ]);

  return (
    <AppContext.Provider
      value={{
        patients,
        activePatient,

        relatives,
        caregivers,
        doctors,

        loadingPatients,
        loadingPatientContacts,
        switchingPatient,

        loadPatients,
        loadPatientContacts,

        selectPatient,

        setActivePatient,

        refreshActivePatient,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
