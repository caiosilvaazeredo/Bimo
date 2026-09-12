import { getToken } from "./session";

export function getApiBaseUrl(): string {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";
}

export interface TurmaEspelhada {
  id: string;
  name: string;
  academicPeriod: string | null;
  syncStatus: "SYNCING" | "SYNCED" | "CONFLICT" | "ERROR";
  googleCourseId: string | null;
  microsoftTeamId: string | null;
  googleCourseUrl: string | null;
  microsoftTeamUrl: string | null;
  lastError: string | null;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ message: response.statusText }));
    throw new ApiError(response.status, body.message ?? "Erro inesperado ao falar com o Bimo");
  }

  return response.json() as Promise<T>;
}

export function listTurmasEspelhadas(): Promise<TurmaEspelhada[]> {
  return apiFetch<TurmaEspelhada[]>("/turmas-espelhadas");
}

export function createTurmaEspelhada(input: { name: string; academicPeriod?: string }): Promise<TurmaEspelhada> {
  return apiFetch<TurmaEspelhada>("/turmas-espelhadas", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export interface ConsentText {
  region: string;
  version: string;
  text: string;
}

/** RNF-PRIV-02: sem sessão — o tenant é resolvido pelo slug na própria URL. */
export async function getConsentText(tenantSlug: string): Promise<ConsentText> {
  const response = await fetch(
    `${getApiBaseUrl()}/tenants/${encodeURIComponent(tenantSlug)}/consent-text`,
  );
  if (!response.ok) {
    throw new ApiError(response.status, "Não foi possível carregar o texto de consentimento.");
  }
  return response.json() as Promise<ConsentText>;
}
