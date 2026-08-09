import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "@/src/api";
import { useAuth } from "@/src/context/AuthContext";

export type Patient = {
  id: string;
  name: string;
  age?: number | null;
  room?: string | null;
  notes?: string | null;
  is_self?: boolean;
  is_demo?: boolean;
  allergies?: string[];
};

type AppState = {
  patients: Patient[];
  activePatient: Patient | null;
  setActivePatient: (p: Patient) => void;
  loadPatients: () => Promise<void>;
  loadingPatients: boolean;
};

const AppContext = createContext<AppState>({} as AppState);
export const useApp = () => useContext(AppContext);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [activePatient, setActivePatient] = useState<Patient | null>(null);
  const [loadingPatients, setLoadingPatients] = useState(false);

  const loadPatients = useCallback(async () => {
    setLoadingPatients(true);
    try {
      const list = await api<Patient[]>("/patients");
      setPatients(list);
      setActivePatient((prev) => {
        if (prev) {
          const found = list.find((p) => p.id === prev.id);
          if (found) return found;
        }
        return list[0] || null;
      });
    } catch {
    } finally {
      setLoadingPatients(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadPatients();
    else {
      setPatients([]);
      setActivePatient(null);
    }
  }, [user, loadPatients]);

  return (
    <AppContext.Provider
      value={{ patients, activePatient, setActivePatient, loadPatients, loadingPatients }}
    >
      {children}
    </AppContext.Provider>
  );
}
