import {
  BadRequestException,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import { encodeOAuthState } from '../oauth-state';

/**
 * Injeta o tenant (slug recebido em ?tenant=) no parâmetro `state` do
 * fluxo OAuth, para que o callback consiga resolver o tenant mesmo sem
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
      return { state: encodeOAuthState({ tenantSlug }) };
    }
  }
  return OAuthInitGuard;
}

export class GoogleAuthGuard extends buildOAuthInitGuard('google') {}
export class MicrosoftAuthGuard extends buildOAuthInitGuard('microsoft') {}
