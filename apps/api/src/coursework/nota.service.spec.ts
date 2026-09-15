import { TenantContext } from '../tenant/tenant-context';
import { NotaService, SYNC_GRADE_JOB } from './nota.service';
import { SyncStatus } from '../turma-espelhada/sync-status.enum';
import { SubmissionStatus } from './submission-status.enum';

function buildRepositoryMock() {
  const store = new Map<string, any>();
  let counter = 0;
  return {
    create: jest.fn((data: any) => ({ id: `nota-${++counter}`, ...data })),
    save: jest.fn(async (entity: any) => {
      store.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => {
      for (const item of store.values()) {
        if (
          item.tenantId === where.tenantId &&
          (where.id === undefined || item.id === where.id) &&
          (where.tarefaId === undefined || item.tarefaId === where.tarefaId) &&
          (where.alunoId === undefined || item.alunoId === where.alunoId)
        ) {
          return item;
        }
      }
      return null;
    }),
    find: jest.fn(async ({ where }: any) =>
      [...store.values()].filter(
        (n) => n.tenantId === where.tenantId && n.tarefaId === where.tarefaId,
      ),
    ),
    update: jest.fn(async ({ id, tenantId }: any, patch: any) => {
      const item = [...store.values()].find(
        (n) => n.id === id && n.tenantId === tenantId,
      );
      if (item) Object.assign(item, patch);
    }),
    _store: store,
  };
}

describe('NotaService', () => {
  const TENANT = 'tenant-1';
  let repository: ReturnType<typeof buildRepositoryMock>;
  let syncQueueService: any;
  let service: NotaService;

  beforeEach(() => {
    repository = buildRepositoryMock();
    syncQueueService = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new NotaService(repository as any, syncQueueService);
  });

  const withTenant = <T>(fn: () => Promise<T>) =>
    TenantContext.run({ tenantId: TENANT }, fn);

  it('cria a nota e enfileira o job de sincronização (RF-SYNC-04)', async () => {
    const nota = await withTenant(() =>
      service.setGrade('tarefa-1', 'aluno-1', 'prof-1', {
        grade: 8.5,
        status: SubmissionStatus.SUBMITTED,
      }),
    );

    expect(nota.grade).toBe(8.5);
    expect(nota.syncStatus).toBe(SyncStatus.SYNCING);
    expect(syncQueueService.enqueue).toHaveBeenCalledWith(
      TENANT,
      SYNC_GRADE_JOB,
      expect.objectContaining({ notaId: nota.id, professorId: 'prof-1' }),
    );
  });

  it('relançar a nota do mesmo aluno/tarefa atualiza em vez de duplicar', async () => {
    await withTenant(() =>
      service.setGrade('tarefa-1', 'aluno-1', 'prof-1', { grade: 7 }),
    );
    await withTenant(() =>
      service.setGrade('tarefa-1', 'aluno-1', 'prof-1', { grade: 9 }),
    );

    const notas = await withTenant(() => service.listByTarefa('tarefa-1'));
    expect(notas).toHaveLength(1);
    expect(notas[0].grade).toBe(9);
  });

  it('markSynced e markError atualizam o status corretamente', async () => {
    const nota = await withTenant(() =>
      service.setGrade('tarefa-1', 'aluno-1', 'prof-1', { grade: 8 }),
    );

    await withTenant(() => service.markSynced(nota.id));
    expect(repository._store.get(nota.id).syncStatus).toBe(SyncStatus.SYNCED);

    await withTenant(() => service.markError(nota.id, 'falha'));
    expect(repository._store.get(nota.id).syncStatus).toBe(SyncStatus.ERROR);
    expect(repository._store.get(nota.id).lastError).toBe('falha');
  });

  it('findById retorna a nota e lança NotFoundException quando não encontra', async () => {
    const nota = await withTenant(() =>
      service.setGrade('tarefa-1', 'aluno-1', 'prof-1', { grade: 8 }),
    );

    const found = await withTenant(() => service.findById(nota.id));
    expect(found.id).toBe(nota.id);

    await expect(
      withTenant(() => service.findById('inexistente')),
    ).rejects.toThrow('Nota não encontrada');
  });

  it('findByTarefaAndAluno retorna a nota do aluno na tarefa (RF-STU-02)', async () => {
    await withTenant(() =>
      service.setGrade('tarefa-1', 'aluno-1', 'prof-1', { grade: 8 }),
    );

    const found = await withTenant(() =>
      service.findByTarefaAndAluno('tarefa-1', 'aluno-1'),
    );
    const notFound = await withTenant(() =>
      service.findByTarefaAndAluno('tarefa-1', 'aluno-2'),
    );

    expect(found?.grade).toBe(8);
    expect(notFound).toBeNull();
  });
});
