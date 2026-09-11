import { DataSubjectRequestsService } from './data-subject-requests.service';

describe('DataSubjectRequestsService', () => {
  const professorsService = {
    anonymize: jest.fn().mockResolvedValue(undefined),
  };
  const externalAccountsService = {
    removeAllForProfessor: jest.fn().mockResolvedValue(undefined),
  };
  const alunosService = { anonymize: jest.fn().mockResolvedValue(undefined) };
  const syncEventLogService = {
    record: jest.fn().mockResolvedValue(undefined),
  };

  let service: DataSubjectRequestsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DataSubjectRequestsService(
      professorsService as any,
      externalAccountsService as any,
      alunosService as any,
      syncEventLogService as any,
    );
  });

  it('anonimiza professor e remove tokens externos (RNF-PRIV-03)', async () => {
    await service.deleteOwnData('tenant-1', 'PROFESSOR', 'prof-1');

    expect(externalAccountsService.removeAllForProfessor).toHaveBeenCalledWith(
      'prof-1',
    );
    expect(professorsService.anonymize).toHaveBeenCalledWith('prof-1');
    expect(alunosService.anonymize).not.toHaveBeenCalled();
    expect(syncEventLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        resourceId: 'prof-1',
        result: 'SUCCESS',
      }),
    );
  });

  it('anonimiza aluno sem mexer em ExternalAccount (aluno não tem)', async () => {
    await service.deleteOwnData('tenant-1', 'ALUNO', 'aluno-1');

    expect(alunosService.anonymize).toHaveBeenCalledWith('aluno-1');
    expect(professorsService.anonymize).not.toHaveBeenCalled();
    expect(
      externalAccountsService.removeAllForProfessor,
    ).not.toHaveBeenCalled();
  });
});
