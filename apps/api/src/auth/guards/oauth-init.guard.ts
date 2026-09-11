import {
  BadRequestException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { encodeOAuthState } from '../oauth-state';

/**
 * Injeta o tenant (slug recebido em ?tenant=) e o papel pretendido
 * (?role=PROFESSOR|ALUNO, default PROFESSOR) no parâmetro `state` do
 * fluxo OAuth, para que o callback consiga resolver os dois mesmo sem
 * o header x-tenant-slug (que não existe em um redirect de navegador).
 */
function buildOAuthInitGuard(strategyName: string) {
  @Injectable()
  class OAuthInitGuard extends AuthGuard(strategyName) {
    getAuthenticateOptions(context: ExecutionContext) {
      const req = context.switchToHttp().getRequest<Request>();
      const tenantSlug = req.query.tenant as string | undefined;
      if (!tenantSlug) {
        throw new BadRequestException(
          'Parâmetro de query "tenant" é obrigatório para iniciar o login OAuth',
        );
      }
      const role = req.query.role === 'ALUNO' ? 'ALUNO' : 'PROFESSOR';
      return { state: encodeOAuthState({ tenantSlug, role }) };
    }
  }
  return OAuthInitGuard;
}

export class GoogleAuthGuard extends buildOAuthInitGuard('google') {}
export class MicrosoftAuthGuard extends buildOAuthInitGuard('microsoft') {}
