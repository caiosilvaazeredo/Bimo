import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionJwtPayload } from '../bimo-jwt-payload';

/**
 * Defesa em profundidade: garante que um token de Aluno nunca acesse
 * rota de Professor e vice-versa, mesmo que ambos compartilhem o mesmo
 * JwtStrategy/segredo (RNF-SEC-03).
 */
function buildKindGuard(expectedKind: 'PROFESSOR' | 'ALUNO') {
  @Injectable()
  class KindGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      const request = context
        .switchToHttp()
        .getRequest<Request & { user?: SessionJwtPayload }>();
      if (request.user?.kind !== expectedKind) {
        throw new ForbiddenException(
          `Este recurso é exclusivo para sessões de ${expectedKind}`,
        );
      }
      return true;
    }
  }
  return KindGuard;
}

export class ProfessorOnlyGuard extends buildKindGuard('PROFESSOR') {}
export class AlunoOnlyGuard extends buildKindGuard('ALUNO') {}
