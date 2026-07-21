import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "@/src/api";
import { storage } from "@/src/utils/storage";

const ACCESS_TOKEN_KEY = "vylnax_access_token";

export type AccessRole =
  | "patient"
  | "relative"
  | "caregiver"
  | "doctor"
  | "pfk"
  | "angehoerige"
  | string;

export type AccessUser = {
  id: string;
  owner_id?: string;
  name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role: AccessRole;
  patient_id?: string | null;
  active?: boolean;
  biometric_enabled?: boolean;
  created_at?: string;
  updated_at?: string;
};

type AccessLoginResponse = {
  access_token: string;
  expires_at: string;
  patient_id: string | null;
  access_user: AccessUser;
};

type AccessSessionResponse = {
  access_user?: AccessUser;
  user?: AccessUser;
  patient_id?: string | null;
  expires_at?: string;

  session?: {
    access_token?: string;
    patient_id?: string | null;
    expires_at?: string;
  };
};

type AccessContextValue = {
  accessUser: AccessUser | null;
  accessUsers: AccessUser[];
  accessToken: string | null;
  activePatientId: string | null;
  expiresAt: string | null;

  loading: boolean;
  signingIn: boolean;
  loadingUsers: boolean;

  isAccessAuthenticated: boolean;
  canEdit: boolean;
  isReadOnly: boolean;

  loadAccessUsers: () => Promise<void>;

  loginAccess: (
    accessUserId: string,
    pin?: string,
    patientId?: string | null
  ) => Promise<void>;

  logoutAccess: () => Promise<void>;
  refreshAccessSession: () => Promise<void>;
  setActivePatient: (patientId: string) => Promise<void>;
};

const AccessContext =
  createContext<AccessContextValue | null>(null);

function getAccessUserName(user: AccessUser): string {
  if (user.name?.trim()) {
    return user.name.trim();
  }

  return [user.first_name, user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
}

function normalizeRole(role?: string): string {
  return String(role || "")
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue");
}

function roleCanEdit(role?: string): boolean {
  const normalizedRole = normalizeRole(role);

  return [
    "doctor",
    "arzt",
    "hausarzt",
    "caregiver",
    "pflegekraft",
    "pfk",
    "admin",
    "administrator",
  ].includes(normalizedRole);
}

async function getStoredAccessToken(): Promise<string | null> {
  const token = await storage.secureGet(
    ACCESS_TOKEN_KEY,
    ""
  );

  return token || null;
}

async function saveAccessToken(
  token: string
): Promise<void> {
  await storage.secureSet(
    ACCESS_TOKEN_KEY,
    token
  );
}

async function removeAccessToken(): Promise<void> {
  await storage.secureRemove(
    ACCESS_TOKEN_KEY
  );
}

export function AccessProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [accessUser, setAccessUser] =
    useState<AccessUser | null>(null);

  const [accessUsers, setAccessUsers] =
    useState<AccessUser[]>([]);

  const [
    accessToken,
    setAccessTokenState,
  ] = useState<string | null>(null);

  const [
    activePatientId,
    setActivePatientId,
  ] = useState<string | null>(null);

  const [expiresAt, setExpiresAt] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [signingIn, setSigningIn] =
    useState(false);

  const [loadingUsers, setLoadingUsers] =
    useState(false);

  const clearAccessState =
    useCallback(async () => {
      await removeAccessToken();

      setAccessTokenState(null);
      setAccessUser(null);
      setActivePatientId(null);
      setExpiresAt(null);
    }, []);

  const refreshAccessSession =
    useCallback(async () => {
      const storedToken =
        await getStoredAccessToken();

      if (!storedToken) {
        setAccessTokenState(null);
        setAccessUser(null);
        setActivePatientId(null);
        setExpiresAt(null);
        return;
      }

      try {
        /*
         * api.ts šalje:
         *
         * Authorization: Bearer ...
         * X-Access-Token: ...
         *
         * Backend za /access/me zahtijeva oba tokena.
         */
        const response =
          await api<AccessSessionResponse>(
            "/access/me"
          );

        const returnedAccessUser =
          response.access_user ||
          response.user;

        const returnedPatientId =
          response.patient_id ??
          response.session?.patient_id ??
          returnedAccessUser?.patient_id ??
          null;

        const returnedExpiresAt =
          response.expires_at ??
          response.session?.expires_at ??
          null;

        if (!returnedAccessUser) {
          throw new Error(
            "ACCESS_SESSION_INVALID"
          );
        }

        setAccessTokenState(storedToken);
        setAccessUser(returnedAccessUser);
        setActivePatientId(
          returnedPatientId
        );
        setExpiresAt(returnedExpiresAt);
      } catch (error) {
        console.error(
          "Access session could not be restored:",
          error
        );

        await clearAccessState();
      }
    }, [clearAccessState]);

  /*
   * Pri pokretanju aplikacije provjerava se
   * postojeća Access/PIN sesija.
   *
   * Token se više ne briše automatski.
   */
  useEffect(() => {
    let mounted = true;

    const initializeAccess = async () => {
      try {
        await refreshAccessSession();
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void initializeAccess();

    return () => {
      mounted = false;
    };
  }, [refreshAccessSession]);

  const loadAccessUsers =
    useCallback(async () => {
      setLoadingUsers(true);

      try {
        const response =
          await api<any>("/access-users");

        const list: AccessUser[] =
          Array.isArray(response)
            ? response
            : Array.isArray(response?.items)
              ? response.items
              : Array.isArray(
                    response?.access_users
                  )
                ? response.access_users
                : [];

        const activeUsers = list
          .filter(
            (item) =>
              item.active !== false
          )
          .map((item) => ({
            ...item,
            name: getAccessUserName(item),
          }));

        setAccessUsers(activeUsers);
      } finally {
        setLoadingUsers(false);
      }
    }, []);

  const loginAccess = useCallback(
    async (
      accessUserId: string,
      pin = "0000",
      patientId?: string | null
    ) => {
      if (!accessUserId.trim()) {
        throw new Error(
          "ACCESS_USER_REQUIRED"
        );
      }

      if (!/^\d{4,6}$/.test(pin)) {
        throw new Error(
          "PIN_MUST_HAVE_4_TO_6_DIGITS"
        );
      }

      setSigningIn(true);

      try {
        const response =
          await api<AccessLoginResponse>(
            "/access/login",
            {
              method: "POST",
              body: {
                access_user_id:
                  accessUserId,
                pin,
                patient_id:
                  patientId || undefined,
              },
            }
          );

        if (
          !response.access_token ||
          !response.access_user
        ) {
          throw new Error(
            "ACCESS_LOGIN_RESPONSE_INVALID"
          );
        }

        await saveAccessToken(
          response.access_token
        );

        setAccessTokenState(
          response.access_token
        );

        setAccessUser(
          response.access_user
        );

        setActivePatientId(
          response.patient_id ??
            response.access_user.patient_id ??
            null
        );

        setExpiresAt(
          response.expires_at ?? null
        );
      } finally {
        setSigningIn(false);
      }
    },
    []
  );

  const logoutAccess =
    useCallback(async () => {
      try {
        const token =
          await getStoredAccessToken();

        if (token) {
          /*
           * Zajednički api.ts automatski šalje
           * osnovni i Access token.
           */
          await api("/access/logout", {
            method: "POST",
          });
        }
      } catch (error) {
        console.error(
          "Access logout backend error:",
          error
        );

        /*
         * Lokalna odjava mora raditi čak
         * i kada backend nije dostupan.
         */
      } finally {
        await clearAccessState();
      }
    }, [clearAccessState]);

  const setActivePatient =
    useCallback(
      async (patientId: string) => {
        if (!patientId.trim()) {
          throw new Error(
            "PATIENT_ID_REQUIRED"
          );
        }

        await api(
          "/access/active-patient",
          {
            method: "PUT",
            body: {
              patient_id: patientId,
            },
          }
        );

        setActivePatientId(patientId);
      },
      []
    );

  const canEdit = roleCanEdit(
    accessUser?.role
  );

  const isAccessAuthenticated =
    Boolean(accessToken && accessUser);

  const isReadOnly =
    isAccessAuthenticated && !canEdit;

  const value =
    useMemo<AccessContextValue>(
      () => ({
        accessUser,
        accessUsers,
        accessToken,
        activePatientId,
        expiresAt,

        loading,
        signingIn,
        loadingUsers,

        isAccessAuthenticated,
        canEdit,
        isReadOnly,

        loadAccessUsers,
        loginAccess,
        logoutAccess,
        refreshAccessSession,
        setActivePatient,
      }),
      [
        accessUser,
        accessUsers,
        accessToken,
        activePatientId,
        expiresAt,
        loading,
        signingIn,
        loadingUsers,
        isAccessAuthenticated,
        canEdit,
        isReadOnly,
        loadAccessUsers,
        loginAccess,
        logoutAccess,
        refreshAccessSession,
        setActivePatient,
      ]
    );

  return (
    <AccessContext.Provider value={value}>
      {children}
    </AccessContext.Provider>
  );
}

export function useAccess(): AccessContextValue {
  const context =
    useContext(AccessContext);

  if (!context) {
    throw new Error(
      "useAccess must be used inside AccessProvider"
    );
  }

  return context;
}