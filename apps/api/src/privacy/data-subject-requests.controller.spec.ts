import { DataSubjectRequestsController } from './data-subject-requests.controller';

describe('DataSubjectRequestsController (RNF-PRIV-03)', () => {
  const dataSubjectRequestsService = {
    deleteOwnData: jest.fn().mockResolvedValue(undefined),
  };

  let controller: DataSubjectRequestsController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new DataSubjectRequestsController(
      dataSubjectRequestsService as any,
    );
  });

  it('solicita a exclusão dos próprios dados do titular autenticado', async () => {
    const req = {
      user: { tenantId: 'tenant-1', sub: 'prof-1', kind: 'PROFESSOR' },
    } as any;

    const result = await controller.deleteMyData(req);

    expect(result).toEqual({ status: 'processado' });
    expect(dataSubjectRequestsService.deleteOwnData).toHaveBeenCalledWith(
      'tenant-1',
      'PROFESSOR',
      'prof-1',
    );
  });

  it('funciona também para um aluno autenticado', async () => {
    const req = {
      user: { tenantId: 'tenant-1', sub: 'aluno-1', kind: 'ALUNO' },
    } as any;

    await controller.deleteMyData(req);

    expect(dataSubjectRequestsService.deleteOwnData).toHaveBeenCalledWith(
      'tenant-1',
      'ALUNO',
      'aluno-1',
    );
  });
});
