import { BadRequestException } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import {
  TarefaService,
  PUBLISH_COURSEWORK_JOB,
  UPDATE_COURSEWORK_JOB,
  DELETE_COURSEWORK_JOB,
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
    findOne: jest.fn(async ({ where }: any) => {
      if (where.id !== undefined) return store.get(where.id) ?? null;
      for (const item of store.values()) {
        if (
          (where.googleCourseWorkId === undefined ||
            item.googleCourseWorkId === where.googleCourseWorkId) &&
          (where.microsoftAssignmentId === undefined ||
            item.microsoftAssignmentId === where.microsoftAssignmentId)
        ) {
          return item;
        }
      }
      return null;
    }),
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

  describe('requestDeletion / markDeleted (RF-SYNC-06)', () => {
    it('recusa excluir sem confirmação explícita', async () => {
      turmaEspelhadaService.findById.mockResolvedValue({
        id: 'turma-1',
        syncStatus: SyncStatus.SYNCED,
      });
      const tarefa = await withTenant(() =>
        service.publish('turma-1', 'prof-1', { title: 'Tarefa 1' }),
      );

      await expect(
        withTenant(() => service.requestDeletion(tarefa.id, 'prof-1', false)),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(syncQueueService.enqueue).not.toHaveBeenCalledWith(
        TENANT,
        DELETE_COURSEWORK_JOB,
        expect.anything(),
      );
    });

    it('marca DELETING e enfileira o job quando confirmado', async () => {
      turmaEspelhadaService.findById.mockResolvedValue({
        id: 'turma-1',
        syncStatus: SyncStatus.SYNCED,
      });
      const tarefa = await withTenant(() =>
        service.publish('turma-1', 'prof-1', { title: 'Tarefa 1' }),
      );

      const result = await withTenant(() =>
        service.requestDeletion(tarefa.id, 'prof-1', true),
      );

      expect(result.syncStatus).toBe(SyncStatus.DELETING);
      expect(syncQueueService.enqueue).toHaveBeenCalledWith(
        TENANT,
        DELETE_COURSEWORK_JOB,
        expect.objectContaining({ tarefaId: tarefa.id, professorId: 'prof-1' }),
      );
    });

    it('markDeleted marca DELETED e some de listByTurma', async () => {
      turmaEspelhadaService.findById.mockResolvedValue({
        id: 'turma-1',
        syncStatus: SyncStatus.SYNCED,
      });
      const tarefa = await withTenant(() =>
        service.publish('turma-1', 'prof-1', { title: 'Tarefa 1' }),
      );

      await withTenant(() => service.markDeleted(tarefa.id));

      const listed = await withTenant(() => service.listByTurma('turma-1'));
      expect(listed.find((t) => t.id === tarefa.id)).toBeUndefined();
      expect(repository._store.get(tarefa.id).syncStatus).toBe(
        SyncStatus.DELETED,
      );
    });
  });

  it('findById lança NotFoundException quando não encontra a tarefa', async () => {
    await expect(
      withTenant(() => service.findById('inexistente')),
    ).rejects.toThrow('Tarefa não encontrada');
  });

  it('markConflict marca status CONFLICT (RF-SYNC-03)', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({
      id: 'turma-1',
      syncStatus: SyncStatus.SYNCED,
    });
    const tarefa = await withTenant(() =>
      service.publish('turma-1', 'prof-1', { title: 'Tarefa 1' }),
    );

    await withTenant(() => service.markConflict(tarefa.id));

    expect(repository._store.get(tarefa.id).syncStatus).toBe(
      SyncStatus.CONFLICT,
    );
  });

  describe('importFromExternal (RF-MIG-02)', () => {
    it('cria uma tarefa nova quando não há id externo já importado', async () => {
      const tarefa = await withTenant(() =>
        service.importFromExternal({
          turmaEspelhadaId: 'turma-1',
          title: 'Tarefa importada',
          googleCourseWorkId: 'cw-1',
        }),
      );

      expect(tarefa.title).toBe('Tarefa importada');
      expect(tarefa.googleCourseWorkId).toBe('cw-1');
    });

    it('é idempotente pelo id do Google (RF-MIG-05)', async () => {
      const first = await withTenant(() =>
        service.importFromExternal({
          turmaEspelhadaId: 'turma-1',
          title: 'Tarefa importada',
          googleCourseWorkId: 'cw-1',
        }),
      );
      const second = await withTenant(() =>
        service.importFromExternal({
          turmaEspelhadaId: 'turma-1',
          title: 'Tarefa importada',
          googleCourseWorkId: 'cw-1',
        }),
      );

      expect(second.id).toBe(first.id);
    });

    it('é idempotente pelo id do Microsoft quando não há id do Google', async () => {
      const first = await withTenant(() =>
        service.importFromExternal({
          turmaEspelhadaId: 'turma-1',
          title: 'Tarefa importada',
          microsoftAssignmentId: 'a-1',
        }),
      );
      const second = await withTenant(() =>
        service.importFromExternal({
          turmaEspelhadaId: 'turma-1',
          title: 'Tarefa importada',
          microsoftAssignmentId: 'a-1',
        }),
      );

      expect(second.id).toBe(first.id);
    });
  });

  it('findByGoogleCourseWorkId retorna null quando não encontra', async () => {
    const result = await withTenant(() =>
      service.findByGoogleCourseWorkId('inexistente'),
    );
    expect(result).toBeNull();
  });

  it('findByMicrosoftAssignmentId retorna null quando não encontra', async () => {
    const result = await withTenant(() =>
      service.findByMicrosoftAssignmentId('inexistente'),
    );
    expect(result).toBeNull();
  });
});
