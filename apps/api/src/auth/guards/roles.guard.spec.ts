import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { ProfessorRole } from '../../professor/professor-role.enum';

function buildContext(
  user: { role: ProfessorRole } | undefined,
): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('RolesGuard', () => {
  it('permite acesso quando a rota não exige papel específico', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(buildContext({ role: ProfessorRole.PROFESSOR })),
    ).toBe(true);
  });

  it('permite acesso quando o papel do usuário está na lista exigida', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([ProfessorRole.INSTITUTIONAL_ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(
      guard.canActivate(
        buildContext({ role: ProfessorRole.INSTITUTIONAL_ADMIN }),
      ),
    ).toBe(true);
  });

  it('bloqueia acesso quando o papel do usuário não está na lista exigida', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue([ProfessorRole.NETWORK_ADMIN]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() =>
      guard.canActivate(buildContext({ role: ProfessorRole.PROFESSOR })),
    ).toThrow(ForbiddenException);
  });

  it('bloqueia acesso quando não há usuário autenticado', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue([ProfessorRole.PROFESSOR]),
    } as unknown as Reflector;
    const guard = new RolesGuard(reflector);

    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
