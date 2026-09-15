import { BillingController } from './billing.controller';

describe('BillingController', () => {
  const billingService = {
    countActiveAlunos: jest.fn(),
  };
  const reportsService = {
    institutionalAdoption: jest.fn(),
    turmaSummary: jest.fn(),
  };

  let controller: BillingController;
  const req = { user: { sub: 'admin-1', tenantId: 'tenant-1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new BillingController(
      billingService as any,
      reportsService as any,
    );
  });

  it('retorna o consumo (alunos ativos) do período corrente (RF-BILL-01/03)', async () => {
    billingService.countActiveAlunos.mockResolvedValue(42);

    const result = await controller.usage(req);

    expect(result).toEqual({ activeStudents: 42 });
    expect(billingService.countActiveAlunos).toHaveBeenCalled();
  });

  it('retorna o relatório de adoção institucional (RF-REPORT-02)', async () => {
    reportsService.institutionalAdoption.mockResolvedValue({ adopted: 10 });

    const result = await controller.adoption(req);

    expect(result).toEqual({ adopted: 10 });
    expect(reportsService.institutionalAdoption).toHaveBeenCalled();
  });

  it('retorna o resumo de uma turma (RF-REPORT-01)', async () => {
    reportsService.turmaSummary.mockResolvedValue({ turmaId: 'turma-1' });

    const result = await controller.turmaReport(req, 'turma-1');

    expect(result).toEqual({ turmaId: 'turma-1' });
    expect(reportsService.turmaSummary).toHaveBeenCalledWith('turma-1');
  });
});
