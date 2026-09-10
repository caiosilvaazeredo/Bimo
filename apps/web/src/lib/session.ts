const TOKEN_KEY = "bimo.token";

/** Sessão simples baseada no JWT emitido pela API após o login OAuth. */
export function saveToken(token: string): void {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_KEY);
}
