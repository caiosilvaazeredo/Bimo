import { ReportsService } from './reports.service';

describe('ReportsService', () => {
  const turmaEspelhadaService = {
    listByTenant: jest.fn(),
    findById: jest.fn(),
  };
  const professorsService = { listByTenant: jest.fn() };
  const entregaContingenciaService = { listByTurma: jest.fn() };

  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(
      turmaEspelhadaService as any,
      professorsService as any,
      entregaContingenciaService as any,
    );
  });

  it('institutionalAdoption classifica turmas espelhadas vs só-Google vs só-Microsoft (RF-REPORT-02)', async () => {
    turmaEspelhadaService.listByTenant.mockResolvedValue([
      { googleCourseId: 'g1', microsoftTeamId: 'm1' },
      { googleCourseId: 'g2', microsoftTeamId: null },
      { googleCourseId: null, microsoftTeamId: 'm2' },
    ]);
    professorsService.listByTenant.mockResolvedValue([{}, {}]);

    const report = await service.institutionalAdoption();

    expect(report).toEqual({
      totalProfessors: 2,
      totalTurmas: 3,
      turmasEspelhadas: 1,
      turmasSoGoogle: 1,
      turmasSoMicrosoft: 1,
    });
  });

  it('turmaSummary devolve nome, status e volume de entregas por contingência', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({
      id: 'turma-1',
      name: 'Turma A',
      syncStatus: 'SYNCED',
    });
    entregaContingenciaService.listByTurma.mockResolvedValue([{}, {}, {}]);

    const report = await service.turmaSummary('turma-1');

    expect(report).toEqual({
      turmaId: 'turma-1',
      turmaName: 'Turma A',
      syncStatus: 'SYNCED',
      entregasContingencia: 3,
    });
  });
});
