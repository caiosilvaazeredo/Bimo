/** Formato comum devolvido pelas strategies antes de virar sessão Bimo. */
export interface OAuthProfile {
  tenantSlug: string;
  role: 'PROFESSOR' | 'ALUNO';
  email: string;
  displayName: string;
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date | null;
}
