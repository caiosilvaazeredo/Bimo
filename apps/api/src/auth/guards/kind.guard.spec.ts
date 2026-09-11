import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AlunoOnlyGuard, ProfessorOnlyGuard } from './kind.guard';

function buildContext(user: any): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('kind guards', () => {
  it('ProfessorOnlyGuard permite kind PROFESSOR', () => {
    const guard = new ProfessorOnlyGuard();
    expect(guard.canActivate(buildContext({ kind: 'PROFESSOR' }))).toBe(true);
  });

  it('ProfessorOnlyGuard bloqueia kind ALUNO', () => {
    const guard = new ProfessorOnlyGuard();
    expect(() => guard.canActivate(buildContext({ kind: 'ALUNO' }))).toThrow(
      ForbiddenException,
    );
  });

  it('AlunoOnlyGuard permite kind ALUNO e bloqueia PROFESSOR', () => {
    const guard = new AlunoOnlyGuard();
    expect(guard.canActivate(buildContext({ kind: 'ALUNO' }))).toBe(true);
    expect(() =>
      guard.canActivate(buildContext({ kind: 'PROFESSOR' })),
    ).toThrow(ForbiddenException);
  });

  it('bloqueia quando não há usuário no request', () => {
    const guard = new ProfessorOnlyGuard();
    expect(() => guard.canActivate(buildContext(undefined))).toThrow(
      ForbiddenException,
    );
  });
});
