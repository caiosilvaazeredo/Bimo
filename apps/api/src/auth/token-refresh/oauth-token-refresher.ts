import { ExternalProvider } from '../../professor/external-provider.enum';

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string | null;
  expiresAt: Date | null;
}

/**
 * Cada provedor implementa sua própria forma de trocar um refresh_token
 * por um novo access_token, isolada em seu módulo (RNF-ARCH-03) — assim
 * uma mudança na API de um provedor nunca obriga alterar o do outro.
 */
export interface OAuthTokenRefresher {
  readonly provider: ExternalProvider;
  refresh(refreshToken: string): Promise<RefreshedTokens>;
}

export const OAUTH_TOKEN_REFRESHERS = 'OAUTH_TOKEN_REFRESHERS';
