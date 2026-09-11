import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

/**
 * Provisionar um novo tenant é uma ação operacional da equipe Bimo, não
 * um fluxo self-service público — não existe ainda nenhum admin logado
 * na instituição nova para autenticar essa chamada. Protege com um
 * segredo compartilhado (header x-admin-bootstrap-secret) até existir
 * um painel operacional interno de verdade.
 */
@Injectable()
export class BootstrapSecretGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('ADMIN_BOOTSTRAP_SECRET');
    const request = context.switchToHttp().getRequest<Request>();
    const provided = request.header('x-admin-bootstrap-secret');

    if (!expected || provided !== expected) {
      throw new UnauthorizedException(
        'Segredo de bootstrap inválido ou não configurado',
      );
    }
    return true;
  }
}
