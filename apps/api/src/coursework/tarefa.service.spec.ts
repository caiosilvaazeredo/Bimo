import { BadRequestException } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import {
  TarefaService,
  PUBLISH_COURSEWORK_JOB,
  UPDATE_COURSEWORK_JOB,
} from './tarefa.service';
import { SyncStatus } from '../turma-espelhada/sync-status.enum';

function buildRepositoryMock() {
  const store = new Map<string, any>();
  let counter = 0;
  return {
    create: jest.fn((data: any) => ({ id: `tarefa-${++counter}`, ...data })),
    save: jest.fn(async (entity: any) => {
      store.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => store.get(where.id) ?? null),
    find: jest.fn(async ({ where }: any) =>
      [...store.values()].filter(
        (t) => t.turmaEspelhadaId === where.turmaEspelhadaId,
      ),
    ),
    update: jest.fn(async ({ id }: any, patch: any) => {
      const item = store.get(id);
      if (item) Object.assign(item, patch);
    }),
    _store: store,
  };
}

describe('TarefaService', () => {
  const TENANT = 'tenant-1';
  let repository: ReturnType<typeof buildRepositoryMock>;
  let turmaEspelhadaService: any;
  let syncQueueService: any;
  let service: TarefaService;

  beforeEach(() => {
    repository = buildRepositoryMock();
    turmaEspelhadaService = { findById: jest.fn() };
    syncQueueService = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new TarefaService(
      repository as any,
      turmaEspelhadaService,
      syncQueueService,
    );
  });

  const withTenant = <T>(fn: () => Promise<T>) =>
    TenantContext.run({ tenantId: TENANT }, fn);

  it('bloqueia publicar tarefa se a turma não está SYNCED', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({
      id: 'turma-1',
      syncStatus: SyncStatus.SYNCING,
    });

    await expect(
      withTenant(() =>
        service.publish('turma-1', 'prof-1', { title: 'Tarefa 1' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(syncQueueService.enqueue).not.toHaveBeenCalled();
  });

  it('publica a tarefa e enfileira o job (RF-SYNC-01)', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({
      id: 'turma-1',
      syncStatus: SyncStatus.SYNCED,
    });

    const tarefa = await withTenant(() =>
      service.publish('turma-1', 'prof-1', { title: 'Tarefa 1' }),
    );

    expect(tarefa.syncStatus).toBe(SyncStatus.SYNCING);
    expect(syncQueueService.enqueue).toHaveBeenCalledWith(
      TENANT,
      PUBLISH_COURSEWORK_JOB,
      expect.objectContaining({ tarefaId: tarefa.id, professorId: 'prof-1' }),
    );
  });

  it('update enfileira o job de edição preservando os dados existentes (RF-SYNC-02)', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({
      id: 'turma-1',
      syncStatus: SyncStatus.SYNCED,
    });
    const tarefa = await withTenant(() =>
      service.publish('turma-1', 'prof-1', { title: 'Tarefa 1' }),
    );

    await withTenant(() =>
      service.update(tarefa.id, 'prof-1', { title: 'Tarefa 1 (editada)' }),
    );

    const updated = repository._store.get(tarefa.id);
    expect(updated.title).toBe('Tarefa 1 (editada)');
    expect(syncQueueService.enqueue).toHaveBeenCalledWith(
      TENANT,
      UPDATE_COURSEWORK_JOB,
      expect.objectContaining({ tarefaId: tarefa.id }),
    );
  });

  it('markSynced grava os ids externos e limpa erro', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({
      id: 'turma-1',
      syncStatus: SyncStatus.SYNCED,
    });
    const tarefa = await withTenant(() =>
      service.publish('turma-1', 'prof-1', { title: 'Tarefa 1' }),
    );

    await withTenant(() =>
      service.markSynced(tarefa.id, {
        googleCourseWorkId: 'cw1',
        microsoftAssignmentId: 'a1',
      }),
    );

    const updated = repository._store.get(tarefa.id);
    expect(updated.syncStatus).toBe(SyncStatus.SYNCED);
    expect(updated.googleCourseWorkId).toBe('cw1');
    expect(updated.microsoftAssignmentId).toBe('a1');
  });
});
