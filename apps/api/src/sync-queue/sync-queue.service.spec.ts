import { Repository } from 'typeorm';
import { SyncQueueService } from './sync-queue.service';
import { SyncJob } from './sync-job.entity';
import { SyncJobStatus } from './sync-job-status.enum';

function buildRepositoryMock() {
  const store = new Map<string, SyncJob>();
  let counter = 0;

  return {
    create: jest.fn(
      (data: Partial<SyncJob>) =>
        ({ id: `job-${++counter}`, ...data }) as SyncJob,
    ),
    save: jest.fn(async (entity: SyncJob) => {
      store.set(entity.id, entity);
      return entity;
    }),
    find: jest.fn(async ({ where }: any) =>
      [...store.values()]
        .filter(
          (j) => j.status === where.status && j.nextAttemptAt <= new Date(),
        )
        .sort((a, b) => a.nextAttemptAt.getTime() - b.nextAttemptAt.getTime()),
    ),
    update: jest.fn(async (criteria: any, patch: Partial<SyncJob>) => {
      const job = store.get(criteria.id);
      if (!job) return { affected: 0 };
      if (criteria.status && job.status !== criteria.status)
        return { affected: 0 };
      Object.assign(job, patch);
      return { affected: 1 };
    }),
    findOne: jest.fn(async ({ where }: any) => store.get(where.id) ?? null),
    _store: store,
  } as unknown as Repository<SyncJob> & { _store: Map<string, SyncJob> };
}

describe('SyncQueueService', () => {
  let repository: ReturnType<typeof buildRepositoryMock>;
  let service: SyncQueueService;

  beforeEach(() => {
    repository = buildRepositoryMock();
    service = new SyncQueueService(repository);
  });

  it('enfileira um job pronto para processar imediatamente', async () => {
    const job = await service.enqueue('tenant-1', 'CREATE_TURMA_ESPELHADA', {
      turmaId: 't1',
    });

    expect(job.status).toBe(SyncJobStatus.PENDING);
    expect(job.nextAttemptAt.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('claimNext transiciona o job para PROCESSING e não o devolve de novo', async () => {
    await service.enqueue('tenant-1', 'CREATE_TURMA_ESPELHADA', {});

    const claimed = await service.claimNext('worker-1');
    expect(claimed?.status).toBe(SyncJobStatus.PROCESSING);
    expect(claimed?.lockedBy).toBe('worker-1');

    const secondClaim = await service.claimNext('worker-2');
    expect(secondClaim).toBeNull();
  });

  it('complete marca o job como DONE', async () => {
    const job = await service.enqueue('tenant-1', 'CREATE_TURMA_ESPELHADA', {});
    await service.claimNext('worker-1');

    await service.complete(job.id);

    expect(repository._store.get(job.id)?.status).toBe(SyncJobStatus.DONE);
  });

  it('fail agenda retry com backoff crescente enquanto não esgota as tentativas', async () => {
    const job = await service.enqueue('tenant-1', 'CREATE_TURMA_ESPELHADA', {});
    await service.claimNext('worker-1');

    await service.fail(job.id, new Error('rate limit'));

    const updated = repository._store.get(job.id)!;
    expect(updated.status).toBe(SyncJobStatus.PENDING);
    expect(updated.attemptCount).toBe(1);
    expect(updated.nextAttemptAt.getTime()).toBeGreaterThan(Date.now());
    expect(updated.lastError).toBe('rate limit');
  });

  it('fail marca como FAILED ao esgotar maxAttempts', async () => {
    const job = await service.enqueue('tenant-1', 'CREATE_TURMA_ESPELHADA', {});
    repository._store.get(job.id)!.maxAttempts = 2;

    await service.fail(job.id, new Error('erro 1'));
    await service.fail(job.id, new Error('erro 2'));

    expect(repository._store.get(job.id)?.status).toBe(SyncJobStatus.FAILED);
    expect(repository._store.get(job.id)?.attemptCount).toBe(2);
  });
});
