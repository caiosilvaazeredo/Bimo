import { PeriodicSummaryService } from './periodic-summary.service';

describe('PeriodicSummaryService', () => {
  const tenants = [{ id: 'tenant-1' }, { id: 'tenant-2' }];
  const professors = [
    { id: 'prof-1', tenantId: 'tenant-1' },
    { id: 'prof-2', tenantId: 'tenant-1' },
  ];
  const turmas = [
    { id: 'turma-1', professorId: 'prof-1' },
    { id: 'turma-2', professorId: 'prof-1' },
  ];

  const tenantsService = { listAll: jest.fn() };
  const professorsService = { listByTenant: jest.fn() };
  const turmaEspelhadaService = { listByTenant: jest.fn() };
  const reportsService = { turmaSummary: jest.fn() };
  const notificationsService = {
    notifyPeriodicSummary: jest.fn().mockResolvedValue(undefined),
  };
  const config = { get: jest.fn() };

  let service: PeriodicSummaryService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PeriodicSummaryService(
      tenantsService as any,
      professorsService as any,
      turmaEspelhadaService as any,
      reportsService as any,
      notificationsService as any,
      config as any,
    );
  });

  it('não faz nada no cron quando PERIODIC_SUMMARY_ENABLED não é "true"', async () => {
    config.get.mockReturnValue(undefined);

    await service.handleWeeklyCron();

    expect(tenantsService.listAll).not.toHaveBeenCalled();
  });

  it('roda para todos os tenants quando PERIODIC_SUMMARY_ENABLED=true', async () => {
    config.get.mockReturnValue('true');
    tenantsService.listAll.mockResolvedValue([]);

    await service.handleWeeklyCron();

    expect(tenantsService.listAll).toHaveBeenCalled();
  });

  it('gera e envia um resumo por professor com turmas, agregando tarefas e entregas pendentes (RF-DASH-06)', async () => {
    professorsService.listByTenant.mockResolvedValue(professors);
    turmaEspelhadaService.listByTenant.mockResolvedValue(turmas);
    reportsService.turmaSummary.mockImplementation(async (turmaId: string) => ({
      turmaId,
      totalTarefas: 3,
      entregasPendentes: 2,
    }));

    await service.generateForTenant();

    expect(reportsService.turmaSummary).toHaveBeenCalledTimes(2);
    expect(notificationsService.notifyPeriodicSummary).toHaveBeenCalledTimes(1);
    expect(notificationsService.notifyPeriodicSummary).toHaveBeenCalledWith(
      'prof-1',
      expect.stringContaining('2 turma(s)'),
    );
    expect(notificationsService.notifyPeriodicSummary).toHaveBeenCalledWith(
      'prof-1',
      expect.stringContaining('6 tarefa(s)'),
    );
    expect(notificationsService.notifyPeriodicSummary).toHaveBeenCalledWith(
      'prof-1',
      expect.stringContaining('4 entrega(s) pendente(s)'),
    );
  });

  it('pula professores sem nenhuma turma espelhada', async () => {
    professorsService.listByTenant.mockResolvedValue(professors);
    turmaEspelhadaService.listByTenant.mockResolvedValue([]);

    await service.generateForTenant();

    expect(reportsService.turmaSummary).not.toHaveBeenCalled();
    expect(notificationsService.notifyPeriodicSummary).not.toHaveBeenCalled();
  });

  it('continua para os outros tenants quando um deles falha', async () => {
    config.get.mockReturnValue('true');
    tenantsService.listAll.mockResolvedValue(tenants);
    professorsService.listByTenant
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([]);
    turmaEspelhadaService.listByTenant.mockResolvedValue([]);

    await expect(service.generateForAllTenants()).resolves.toBeUndefined();

    expect(professorsService.listByTenant).toHaveBeenCalledTimes(2);
  });
});
