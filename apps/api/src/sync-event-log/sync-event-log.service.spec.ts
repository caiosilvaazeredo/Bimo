import { SyncEventLogService } from './sync-event-log.service';

describe('SyncEventLogService', () => {
  const repository = {
    save: jest.fn().mockResolvedValue(undefined),
    create: jest.fn((data: any) => data),
    find: jest.fn(),
  };

  let service: SyncEventLogService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SyncEventLogService(repository as any);
  });

  describe('record', () => {
    it('grava um evento de sucesso com os campos opcionais preenchidos', async () => {
      await service.record({
        tenantId: 'tenant-1',
        jobType: 'CREATE_TURMA_ESPELHADA',
        resourceId: 'turma-1',
        result: 'SUCCESS',
        detail: 'ok',
      });

      expect(repository.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        jobType: 'CREATE_TURMA_ESPELHADA',
        resourceId: 'turma-1',
        result: 'SUCCESS',
        detail: 'ok',
      });
      expect(repository.save).toHaveBeenCalled();
    });

    it('usa null como padrão quando resourceId/detail não são informados', async () => {
      await service.record({
        tenantId: 'tenant-1',
        jobType: 'ADMIN_SET_CONSENT_REGION',
        result: 'FAILURE',
      });

      expect(repository.create).toHaveBeenCalledWith({
        tenantId: 'tenant-1',
        jobType: 'ADMIN_SET_CONSENT_REGION',
        resourceId: null,
        result: 'FAILURE',
        detail: null,
      });
    });
  });

  describe('listByTenant', () => {
    it('busca eventos ordenados por data decrescente com o limite padrão', async () => {
      repository.find.mockResolvedValue([{ id: 'log-1' }]);

      const result = await service.listByTenant('tenant-1');

      expect(result).toEqual([{ id: 'log-1' }]);
      expect(repository.find).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
        order: { createdAt: 'DESC' },
        take: 100,
      });
    });

    it('respeita um limite customizado', async () => {
      repository.find.mockResolvedValue([]);

      await service.listByTenant('tenant-1', 5);

      expect(repository.find).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });
});
