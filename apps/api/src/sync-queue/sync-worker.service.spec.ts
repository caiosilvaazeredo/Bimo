import { TenantContext } from '../tenant/tenant-context';
import { SyncWorkerService } from './sync-worker.service';
import { SyncJobHandler } from './sync-job-handler';

describe('SyncWorkerService', () => {
  const job = {
    id: 'job-1',
    tenantId: 'tenant-1',
    jobType: 'CREATE_TURMA_ESPELHADA',
    payload: JSON.stringify({ turmaEspelhadaId: 't1' }),
  };

  const syncQueueService = {
    claimNext: jest.fn(),
    complete: jest.fn().mockResolvedValue(undefined),
    fail: jest.fn().mockResolvedValue(undefined),
  };
  const syncEventLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  let handler: SyncJobHandler;
  let service: SyncWorkerService;

  beforeEach(() => {
    jest.clearAllMocks();
    handler = {
      jobType: 'CREATE_TURMA_ESPELHADA',
      handle: jest.fn().mockResolvedValue(undefined),
    };
    service = new SyncWorkerService(
      [handler],
      syncQueueService as any,
      syncEventLogService as any,
    );
  });

  it('retorna false quando não há job pendente', async () => {
    syncQueueService.claimNext.mockResolvedValue(null);

    const processed = await service.processOnce('worker-1');

    expect(processed).toBe(false);
    expect(syncQueueService.complete).not.toHaveBeenCalled();
    expect(syncEventLogService.record).not.toHaveBeenCalled();
  });

  it('despacha o job para o handler certo dentro do TenantContext do job, completa e audita sucesso', async () => {
    syncQueueService.claimNext.mockResolvedValue(job);
    (handler.handle as jest.Mock).mockImplementation(async () => {
      expect(TenantContext.getTenantId()).toBe('tenant-1');
    });

    const processed = await service.processOnce('worker-1');

    expect(processed).toBe(true);
    expect(handler.handle).toHaveBeenCalledWith({ turmaEspelhadaId: 't1' });
    expect(syncQueueService.complete).toHaveBeenCalledWith('job-1');
    expect(syncQueueService.fail).not.toHaveBeenCalled();
    expect(syncEventLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        jobType: job.jobType,
        result: 'SUCCESS',
      }),
    );
  });

  it('chama fail e audita falha quando o handler lança erro', async () => {
    syncQueueService.claimNext.mockResolvedValue(job);
    (handler.handle as jest.Mock).mockRejectedValue(new Error('falhou'));

    await service.processOnce('worker-1');

    expect(syncQueueService.fail).toHaveBeenCalledWith(
      'job-1',
      expect.any(Error),
    );
    expect(syncQueueService.complete).not.toHaveBeenCalled();
    expect(syncEventLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ result: 'FAILURE', detail: 'falhou' }),
    );
  });

  it('chama fail quando não há handler registrado para o jobType', async () => {
    syncQueueService.claimNext.mockResolvedValue({
      ...job,
      jobType: 'TIPO_DESCONHECIDO',
    });

    await service.processOnce('worker-1');

    expect(syncQueueService.fail).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({
        message: expect.stringContaining('TIPO_DESCONHECIDO'),
      }),
    );
  });
});
