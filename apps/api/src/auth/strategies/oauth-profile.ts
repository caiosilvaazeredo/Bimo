/** Formato comum devolvido pelas strategies antes de virar sessão Bimo. */
export interface OAuthProfile {
  tenantSlug: string;
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date | null;
}
