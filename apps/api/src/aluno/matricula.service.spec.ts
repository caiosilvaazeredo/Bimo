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

  it('preenche os ids externos ao matricular pela primeira vez', async () => {
    const matricula = await withTenant(() =>
      service.enroll('aluno-1', 'turma-1', {
        googleUserId: 'g-1',
        microsoftUserId: null,
      }),
    );

    expect(matricula.googleUserId).toBe('g-1');
    expect(matricula.microsoftUserId).toBeNull();
  });

  it('atualiza os ids externos quando já matriculado e um novo id chega (RF-INT-03)', async () => {
    await withTenant(() => service.enroll('aluno-1', 'turma-1'));

    const updated = await withTenant(() =>
      service.enroll('aluno-1', 'turma-1', { microsoftUserId: 'm-1' }),
    );

    expect(updated.microsoftUserId).toBe('m-1');
  });

  it('não regrava quando já matriculado e nenhum id externo é informado', async () => {
    const first = await withTenant(() => service.enroll('aluno-1', 'turma-1'));

    const second = await withTenant(() => service.enroll('aluno-1', 'turma-1'));

    expect(second).toBe(first);
  });

  it('findByAlunoAndTurma retorna a matrícula ou null', async () => {
    expect(
      await withTenant(() => service.findByAlunoAndTurma('aluno-1', 'turma-1')),
    ).toBeNull();

    await withTenant(() => service.enroll('aluno-1', 'turma-1'));

    expect(
      await withTenant(() => service.findByAlunoAndTurma('aluno-1', 'turma-1')),
    ).not.toBeNull();
  });

  it('listByTurma lista as matrículas da turma', async () => {
    await withTenant(() => service.enroll('aluno-1', 'turma-1'));
    await withTenant(() => service.enroll('aluno-2', 'turma-1'));

    const list = await withTenant(() => service.listByTurma('turma-1'));

    expect(list).toHaveLength(2);
  });
});
