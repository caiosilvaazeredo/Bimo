import { TenantContext } from '../tenant/tenant-context';
import { MatriculaService } from './matricula.service';

function buildRepositoryMock() {
  const store: any[] = [];
  let counter = 0;
  return {
    create: jest.fn((data: any) => ({ id: `matricula-${++counter}`, ...data })),
    save: jest.fn(async (entity: any) => {
      store.push(entity);
      return entity;
    }),
    findOne: jest.fn(
      async ({ where }: any) =>
        store.find(
          (m) =>
            m.tenantId === where.tenantId &&
            m.alunoId === where.alunoId &&
            m.turmaEspelhadaId === where.turmaEspelhadaId,
        ) ?? null,
    ),
    count: jest.fn(
      async ({ where }: any) =>
        store.filter(
          (m) =>
            m.tenantId === where.tenantId &&
            m.alunoId === where.alunoId &&
            m.turmaEspelhadaId === where.turmaEspelhadaId,
        ).length,
    ),
    find: jest.fn(async ({ where }: any) =>
      store.filter(
        (m) =>
          m.tenantId === where.tenantId &&
          (where.alunoId === undefined || m.alunoId === where.alunoId) &&
          (where.turmaEspelhadaId === undefined ||
            m.turmaEspelhadaId === where.turmaEspelhadaId),
      ),
    ),
    _store: store,
  };
}

describe('MatriculaService', () => {
  const TENANT = 'tenant-1';
  let repository: ReturnType<typeof buildRepositoryMock>;
  let service: MatriculaService;

  beforeEach(() => {
    repository = buildRepositoryMock();
    service = new MatriculaService(repository as any);
  });

  const withTenant = <T>(fn: () => Promise<T>) =>
    TenantContext.run({ tenantId: TENANT }, fn);

  it('matricula é idempotente', async () => {
    await withTenant(() => service.enroll('aluno-1', 'turma-1'));
    await withTenant(() => service.enroll('aluno-1', 'turma-1'));

    expect(repository._store).toHaveLength(1);
  });

  it('isEnrolled reflete matrícula existente', async () => {
    expect(
      await withTenant(() => service.isEnrolled('aluno-1', 'turma-1')),
    ).toBe(false);

    await withTenant(() => service.enroll('aluno-1', 'turma-1'));

    expect(
      await withTenant(() => service.isEnrolled('aluno-1', 'turma-1')),
    ).toBe(true);
  });

  it('lista turmas do aluno e alunos da turma corretamente', async () => {
    await withTenant(() => service.enroll('aluno-1', 'turma-1'));
    await withTenant(() => service.enroll('aluno-1', 'turma-2'));
    await withTenant(() => service.enroll('aluno-2', 'turma-1'));

    expect(
      await withTenant(() => service.listTurmaIdsByAluno('aluno-1')),
    ).toEqual(['turma-1', 'turma-2']);
    expect(
      await withTenant(() => service.listAlunoIdsByTurma('turma-1')),
    ).toEqual(['aluno-1', 'aluno-2']);
  });
});
