import { storage } from "@/src/utils/storage";

const BASE_URL = (
  process.env.EXPO_PUBLIC_BACKEND_URL || ""
).replace(/\/$/, "");

const SESSION_TOKEN_KEY =
  "vylnax_session_token";

const ACCESS_TOKEN_KEY =
  "vylnax_access_token";

export type ApiOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  auth?: boolean;
};

export async function getToken():
  Promise<string | null> {
  const token = await storage.secureGet(
    SESSION_TOKEN_KEY,
    ""
  );

  return token || null;
}

export async function setToken(
  token: string
): Promise<void> {
  await storage.secureSet(
    SESSION_TOKEN_KEY,
    token
  );
}

export async function clearToken():
  Promise<void> {
  await storage.secureRemove(
    SESSION_TOKEN_KEY
  );
}

async function getAccessToken():
  Promise<string | null> {
  const token = await storage.secureGet(
    ACCESS_TOKEN_KEY,
    ""
  );

  return token || null;
}

export function todayStr(
  value?: Date | string | number
): string {
  const currentDate =
    value instanceof Date
      ? value
      : value !== undefined
        ? new Date(value)
        : new Date();

  if (Number.isNaN(currentDate.getTime())) {
    throw new Error("INVALID_DATE");
  }

  const year =
    currentDate.getFullYear();

  const month = String(
    currentDate.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    currentDate.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export async function api<T = any>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  if (!BASE_URL) {
    throw new Error(
      "BACKEND_URL_MISSING"
    );
  }

  const {
    method = "GET",
    body,
    headers: customHeaders = {},
    timeoutMs = 15000,
    auth = true,
  } = options;

  const [
    sessionToken,
    accessToken,
  ] = await Promise.all([
    auth
      ? getToken()
      : Promise.resolve(null),

    auth
      ? getAccessToken()
      : Promise.resolve(null),
  ]);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  if (auth && sessionToken) {
    headers.Authorization =
      `Bearer ${sessionToken}`;
  }

  if (auth && accessToken) {
    headers["X-Access-Token"] =
      accessToken;
  }

  const controller =
    new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(
      `${BASE_URL}/api${path}`,
      {
        method,
        headers,
        body:
          body === undefined
            ? undefined
            : JSON.stringify(body),
        signal: controller.signal,
      }
    );

    const responseText =
      await response.text();

    let responseData: any = null;

    if (responseText) {
      try {
        responseData =
          JSON.parse(responseText);
      } catch {
        responseData =
          responseText;
      }
    }

    if (!response.ok) {
      const detail =
        typeof responseData?.detail ===
        "string"
          ? responseData.detail
          : typeof responseData ===
              "string"
            ? responseData
            : `HTTP_${response.status}`;

      console.error(
        "API request failed:",
        {
          path,
          status:
            response.status,
          detail,
          hasSessionToken:
            Boolean(sessionToken),
          hasAccessToken:
            Boolean(accessToken),
        }
      );

      throw new Error(detail);
    }

    if (
      response.status === 204 ||
      !responseText
    ) {
      return {} as T;
    }

    return responseData as T;
  } catch (error: any) {
    if (
      error?.name ===
      "AbortError"
    ) {
      throw new Error(
        "BACKEND_TIMEOUT"
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}