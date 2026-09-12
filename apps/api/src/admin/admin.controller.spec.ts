import { BadRequestException } from '@nestjs/common';
import { AdminController } from './admin.controller';

describe('AdminController.setConsentRegion (RNF-PRIV-02)', () => {
  const tenantsService = {
    setConsentRegion: jest.fn().mockResolvedValue(undefined),
  };
  const professorsService = {};
  const turmaEspelhadaService = {};
  const syncEventLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };
  const consentTextsService = {
    listRegions: jest.fn().mockReturnValue(['BR-LGPD', 'EU-GDPR', 'GENERIC']),
  };

  let controller: AdminController;

  beforeEach(() => {
    jest.clearAllMocks();
    consentTextsService.listRegions.mockReturnValue([
      'BR-LGPD',
      'EU-GDPR',
      'GENERIC',
    ]);
    controller = new AdminController(
      tenantsService as any,
      professorsService as any,
      turmaEspelhadaService as any,
      syncEventLogService as any,
      consentTextsService as any,
    );
  });

  const req = { user: { tenantId: 'tenant-1', sub: 'admin-1' } } as any;

  it('recusa uma região desconhecida sem chamar o serviço', async () => {
    await expect(
      controller.setConsentRegion(req, { region: 'MARTE' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tenantsService.setConsentRegion).not.toHaveBeenCalled();
  });

  it('grava a região válida e registra no log de auditoria', async () => {
    await controller.setConsentRegion(req, { region: 'EU-GDPR' });

    expect(tenantsService.setConsentRegion).toHaveBeenCalledWith(
      'tenant-1',
      'EU-GDPR',
    );
    expect(syncEventLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        jobType: 'ADMIN_SET_CONSENT_REGION',
      }),
    );
  });
});
