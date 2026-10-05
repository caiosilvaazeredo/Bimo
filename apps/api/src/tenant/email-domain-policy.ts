import { ForbiddenException } from '@nestjs/common';
import { Tenant } from './tenant.entity';

/**
 * RF-AUTH-03/RNF-SEC: só deixa passar e-mails dos domínios institucionais
 * configurados pro tenant (ex: uva.br, veigadealmeida.edu.br). Lista vazia
 * em Tenant.allowedEmailDomains = sem restrição. Usado tanto no login do
 * professor quanto no do aluno — essa é a validação real, já que o app
 * registration do provedor OAuth sozinho não garante isso de forma
 * confiável (Conditional Access por domínio é recurso pago no Entra ID).
 */
export function assertEmailDomainAllowed(tenant: Tenant, email: string): void {
  if (!tenant.allowedEmailDomains || tenant.allowedEmailDomains.length === 0) {
    return;
  }
  const emailDomain = email.split('@')[1]?.toLowerCase();
  const allowed = tenant.allowedEmailDomains.some(
    (domain) => emailDomain === domain.toLowerCase(),
  );
  if (!allowed) {
    throw new ForbiddenException(
      `O domínio de e-mail "${emailDomain ?? email}" não está autorizado a acessar esta instituição.`,
    );
  }
}
