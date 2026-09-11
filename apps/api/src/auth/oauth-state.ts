/**
 * O callback OAuth do Google/Microsoft chega sem o header x-tenant-slug
 * (é um redirect de navegador vindo do provedor externo), então o tenant
 * precisa viajar no parâmetro `state` do fluxo OAuth, gerado ao iniciar
 * o login e devolvido intacto no callback. O `role` viaja junto para o
 * mesmo endpoint de callback saber se deve emitir uma sessão de
 * Professor ou de Aluno (RF-STU-01), sem precisar de dois redirect URIs
 * diferentes cadastrados no Google/Microsoft.
 */
export interface OAuthState {
  tenantSlug: string;
  role: 'PROFESSOR' | 'ALUNO';
}

export function encodeOAuthState(state: OAuthState): string {
  return Buffer.from(JSON.stringify(state), 'utf8').toString('base64url');
}

export function decodeOAuthState(raw: string | undefined): OAuthState {
  if (!raw) {
    throw new Error('Parâmetro state ausente no callback OAuth');
  }
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'));
    if (!parsed.tenantSlug) {
      throw new Error('state sem tenantSlug');
    }
    return {
      tenantSlug: parsed.tenantSlug,
      role: parsed.role === 'ALUNO' ? 'ALUNO' : 'PROFESSOR',
    };
  } catch {
    throw new Error('Parâmetro state inválido no callback OAuth');
  }
}
