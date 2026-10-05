import { ForbiddenException } from '@nestjs/common';
import { assertEmailDomainAllowed } from './email-domain-policy';

describe('assertEmailDomainAllowed (RF-AUTH-03)', () => {
  it('não lança quando a lista de domínios permitidos está vazia', () => {
    expect(() =>
      assertEmailDomainAllowed(
        { allowedEmailDomains: [] } as any,
        'qualquer@dominio.com',
      ),
    ).not.toThrow();
  });

  it('não lança quando allowedEmailDomains é null/undefined', () => {
    expect(() =>
      assertEmailDomainAllowed(
        { allowedEmailDomains: null } as any,
        'qualquer@dominio.com',
      ),
    ).not.toThrow();
  });

  it('aceita um e-mail cujo domínio está na lista', () => {
    expect(() =>
      assertEmailDomainAllowed(
        { allowedEmailDomains: ['uva.br', 'veigadealmeida.edu.br'] } as any,
        'professor@uva.br',
      ),
    ).not.toThrow();
  });

  it('aceita comparando sem diferenciar maiúsculas/minúsculas', () => {
    expect(() =>
      assertEmailDomainAllowed(
        { allowedEmailDomains: ['UVA.BR'] } as any,
        'professor@uva.br',
      ),
    ).not.toThrow();
  });

  it('rejeita um e-mail fora da lista', () => {
    expect(() =>
      assertEmailDomainAllowed(
        { allowedEmailDomains: ['uva.br', 'veigadealmeida.edu.br'] } as any,
        'alguem@gmail.com',
      ),
    ).toThrow(ForbiddenException);
  });
});
