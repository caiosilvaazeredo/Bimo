import { decodeOAuthState, encodeOAuthState } from './oauth-state';

describe('oauth-state', () => {
  it('faz roundtrip do tenantSlug', () => {
    const encoded = encodeOAuthState({ tenantSlug: 'escola-exemplo' });
    expect(decodeOAuthState(encoded)).toEqual({ tenantSlug: 'escola-exemplo' });
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
