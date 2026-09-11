import { BadRequestException } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { TurmaEspelhadaService } from './turma-espelhada.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { SyncStatus } from './sync-status.enum';
import { CREATE_TURMA_ESPELHADA_JOB } from './turma-espelhada.service';

function buildRepositoryMock() {
  const store = new Map<string, any>();
  let counter = 0;
  return {
    create: jest.fn((data: any) => ({ id: `turma-${++counter}`, ...data })),
    save: jest.fn(async (entity: any) => {
      store.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => store.get(where.id) ?? null),
    find: jest.fn(async () => [...store.values()]),
    update: jest.fn(async ({ id }: any, patch: any) => {
      const entity = store.get(id);
      if (entity) Object.assign(entity, patch);
    }),
    _store: store,
  };
}

describe('TurmaEspelhadaService', () => {
  const TENANT = 'tenant-1';
  let repository: ReturnType<typeof buildRepositoryMock>;
  let externalAccountsService: any;
  let syncQueueService: any;
  let service: TurmaEspelhadaService;

  beforeEach(() => {
    repository = buildRepositoryMock();
    externalAccountsService = { hasProvider: jest.fn() };
    syncQueueService = { enqueue: jest.fn().mockResolvedValue(undefined) };
    service = new TurmaEspelhadaService(
      repository as any,
      externalAccountsService,
      syncQueueService,
    );
  });

  const withTenant = <T>(fn: () => Promise<T>) =>
    TenantContext.run({ tenantId: TENANT }, fn);

  it('bloqueia a criação se faltar a conta Google (RF-AUTH-03)', async () => {
    externalAccountsService.hasProvider.mockImplementation(
      async (_id: string, provider: ExternalProvider) =>
        provider === ExternalProvider.MICROSOFT,
    );

    await expect(
      withTenant(() =>
        service.create({ professorId: 'prof-1', name: 'Turma A' }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(syncQueueService.enqueue).not.toHaveBeenCalled();
  });

  it('bloqueia a criação se faltar as duas contas e cita ambas na mensagem', async () => {
    externalAccountsService.hasProvider.mockResolvedValue(false);

    await expect(
      withTenant(() =>
        service.create({ professorId: 'prof-1', name: 'Turma A' }),
      ),
    ).rejects.toThrow(/Google e Microsoft/);
  });

  it('cria a turma com status SYNCING e enfileira o job de criação quando as duas contas existem', async () => {
    externalAccountsService.hasProvider.mockResolvedValue(true);

    const turma = await withTenant(() =>
      service.create({ professorId: 'prof-1', name: 'Turma A' }),
    );

    expect(turma.syncStatus).toBe(SyncStatus.SYNCING);
    expect(syncQueueService.enqueue).toHaveBeenCalledWith(
      TENANT,
      CREATE_TURMA_ESPELHADA_JOB,
      expect.objectContaining({
        turmaEspelhadaId: turma.id,
        professorId: 'prof-1',
      }),
    );
  });

  it('markSynced atualiza os ids externos e limpa o erro', async () => {
    externalAccountsService.hasProvider.mockResolvedValue(true);
    const turma = await withTenant(() =>
      service.create({ professorId: 'prof-1', name: 'Turma A' }),
    );

    await withTenant(() =>
      service.markSynced(turma.id, {
        googleCourseId: 'course-1',
        microsoftTeamId: 'team-1',
        googleCourseUrl: 'https://classroom.google.com/c/course-1',
        microsoftTeamUrl: 'https://teams.microsoft.com/l/team/team-1',
      }),
    );

    const updated = repository._store.get(turma.id);
    expect(updated.syncStatus).toBe(SyncStatus.SYNCED);
    expect(updated.googleCourseId).toBe('course-1');
    expect(updated.microsoftTeamId).toBe('team-1');
    expect(updated.googleCourseUrl).toBe(
      'https://classroom.google.com/c/course-1',
    );
    expect(updated.microsoftTeamUrl).toBe(
      'https://teams.microsoft.com/l/team/team-1',
    );
  });

  it('markSideSynced grava o link nativo do lado sincronizado (RF-DASH-05)', async () => {
    externalAccountsService.hasProvider.mockResolvedValue(true);
    const turma = await withTenant(() =>
      service.create({ professorId: 'prof-1', name: 'Turma A' }),
    );

    await withTenant(() =>
      service.markSideSynced(
        turma.id,
        'GOOGLE',
        'course-1',
        'https://classroom.google.com/c/course-1',
      ),
    );

    const updated = repository._store.get(turma.id);
    expect(updated.googleCourseId).toBe('course-1');
    expect(updated.googleCourseUrl).toBe(
      'https://classroom.google.com/c/course-1',
    );
  });

  it('markError marca status ERROR com a mensagem', async () => {
    externalAccountsService.hasProvider.mockResolvedValue(true);
    const turma = await withTenant(() =>
      service.create({ professorId: 'prof-1', name: 'Turma A' }),
    );

    await withTenant(() => service.markError(turma.id, 'rate limit'));

    const updated = repository._store.get(turma.id);
    expect(updated.syncStatus).toBe(SyncStatus.ERROR);
    expect(updated.lastError).toBe('rate limit');
  });
});
