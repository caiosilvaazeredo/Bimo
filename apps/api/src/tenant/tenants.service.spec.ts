import { NotFoundException } from '@nestjs/common';
import { TenantsService } from './tenants.service';

function buildRepositoryMock() {
  return {
    findOne: jest.fn(),
    create: jest.fn((data: any) => ({ ...data })),
    save: jest.fn(async (entity: any) => ({ id: 'tenant-1', ...entity })),
    find: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
  };
}

describe('TenantsService', () => {
  let repository: ReturnType<typeof buildRepositoryMock>;
  let service: TenantsService;

  beforeEach(() => {
    repository = buildRepositoryMock();
    service = new TenantsService(repository as any);
  });

  describe('findActiveBySlug', () => {
    it('retorna o tenant ativo encontrado', async () => {
      const tenant = { id: 'tenant-1', slug: 'ufrj', active: true };
      repository.findOne.mockResolvedValue(tenant);

      const result = await service.findActiveBySlug('ufrj');

      expect(result).toBe(tenant);
      expect(repository.findOne).toHaveBeenCalledWith({
        where: { slug: 'ufrj', active: true },
      });
    });

    it('lança NotFoundException quando não encontra tenant ativo', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(
        service.findActiveBySlug('inexistente'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findById', () => {
    it('retorna o tenant encontrado', async () => {
      const tenant = { id: 'tenant-1' };
      repository.findOne.mockResolvedValue(tenant);

      const result = await service.findById('tenant-1');

      expect(result).toBe(tenant);
    });

    it('lança NotFoundException quando não encontra o tenant', async () => {
      repository.findOne.mockResolvedValue(null);

      await expect(service.findById('tenant-x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('cria o tenant como ativo', async () => {
      const result = await service.create({ name: 'UFRJ', slug: 'ufrj' });

      expect(repository.create).toHaveBeenCalledWith({
        name: 'UFRJ',
        slug: 'ufrj',
        active: true,
      });
      expect(result).toEqual(
        expect.objectContaining({ name: 'UFRJ', slug: 'ufrj', active: true }),
      );
    });
  });

  describe('listAll', () => {
    it('delega ao repositório', async () => {
      repository.find.mockResolvedValue([{ id: 'tenant-1' }]);

      const result = await service.listAll();

      expect(result).toEqual([{ id: 'tenant-1' }]);
      expect(repository.find).toHaveBeenCalled();
    });
  });

  describe('setContingencyEnabled', () => {
    it('atualiza a flag de contingência', async () => {
      await service.setContingencyEnabled('tenant-1', true);

      expect(repository.update).toHaveBeenCalledWith(
        { id: 'tenant-1' },
        { contingencyEnabled: true },
      );
    });
  });

  describe('setConsentRegion', () => {
    it('atualiza a região de consentimento (RNF-PRIV-02)', async () => {
      await service.setConsentRegion('tenant-1', 'EU-GDPR');

      expect(repository.update).toHaveBeenCalledWith(
        { id: 'tenant-1' },
        { consentRegion: 'EU-GDPR' },
      );
    });
  });
});
