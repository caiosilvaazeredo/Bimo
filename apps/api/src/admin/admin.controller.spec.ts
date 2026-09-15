import { BadRequestException } from '@nestjs/common';
import { AdminController } from './admin.controller';

describe('AdminController.setConsentRegion (RNF-PRIV-02)', () => {
  const tenantsService = {
    setConsentRegion: jest.fn().mockResolvedValue(undefined),
    setContingencyEnabled: jest.fn().mockResolvedValue(undefined),
  };
  const professorsService = {
    listByTenant: jest.fn(),
    revoke: jest.fn().mockResolvedValue(undefined),
  };
  const turmaEspelhadaService = {
    listByTenant: jest.fn(),
  };
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

  it('lista as turmas do tenant do admin (RF-ADMIN-02)', async () => {
    turmaEspelhadaService.listByTenant.mockResolvedValue([{ id: 'turma-1' }]);

    const result = await controller.listTurmas(req);

    expect(result).toEqual([{ id: 'turma-1' }]);
  });

  it('lista os professores do tenant do admin (RF-ADMIN-02)', async () => {
    professorsService.listByTenant.mockResolvedValue([{ id: 'prof-1' }]);

    const result = await controller.listProfessores(req);

    expect(result).toEqual([{ id: 'prof-1' }]);
  });

  it('revoga um professor e registra no log de auditoria (RF-ADMIN-05/RNF-SEC-04)', async () => {
    await controller.revokeProfessor(req, 'prof-1');

    expect(professorsService.revoke).toHaveBeenCalledWith('prof-1');
    expect(syncEventLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        jobType: 'ADMIN_REVOKE_PROFESSOR',
        resourceId: 'prof-1',
      }),
    );
  });

  it('liga/desliga a contingência do tenant e registra no log de auditoria', async () => {
    await controller.setContingency(req, { enabled: true });

    expect(tenantsService.setContingencyEnabled).toHaveBeenCalledWith(
      'tenant-1',
      true,
    );
    expect(syncEventLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        jobType: 'ADMIN_SET_CONTINGENCY',
      }),
    );
  });
});
