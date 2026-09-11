import { decodeOAuthState, encodeOAuthState } from './oauth-state';

describe('oauth-state', () => {
  it('faz roundtrip do tenantSlug e role', () => {
    const encoded = encodeOAuthState({
      tenantSlug: 'escola-exemplo',
      role: 'ALUNO',
    });
    expect(decodeOAuthState(encoded)).toEqual({
      tenantSlug: 'escola-exemplo',
      role: 'ALUNO',
    });
  });

  it('default role é PROFESSOR quando ausente/desconhecido no payload decodificado', () => {
    const raw = Buffer.from(
      JSON.stringify({ tenantSlug: 'escola-exemplo' }),
      'utf8',
    ).toString('base64url');
    expect(decodeOAuthState(raw)).toEqual({
      tenantSlug: 'escola-exemplo',
      role: 'PROFESSOR',
    });
  });

  it('lança erro quando state está ausente', () => {
    expect(() => decodeOAuthState(undefined)).toThrow(/ausente/);
  });

  it('lança erro quando state é inválido', () => {
    expect(() => decodeOAuthState('não-é-base64-json-válido')).toThrow(
      /inválido/,
    );
  });
});
