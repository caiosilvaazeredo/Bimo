import { ReportsService } from './reports.service';
import { SubmissionStatus } from '../coursework/submission-status.enum';

describe('ReportsService', () => {
  const turmaEspelhadaService = {
    listByTenant: jest.fn(),
    findById: jest.fn(),
  };
  const professorsService = { listByTenant: jest.fn() };
  const entregaContingenciaService = { listByTurma: jest.fn() };
  const matriculaService = { listAlunoIdsByTurma: jest.fn() };
  const tarefaService = { listByTurma: jest.fn() };
  const notaService = { listByTarefa: jest.fn() };

  let service: ReportsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ReportsService(
      turmaEspelhadaService as any,
      professorsService as any,
      entregaContingenciaService as any,
      matriculaService as any,
      tarefaService as any,
      notaService as any,
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

  it('turmaSummary calcula taxa de entrega real a partir de Tarefa/Nota (RF-REPORT-01)', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({
      id: 'turma-1',
      name: 'Turma A',
      syncStatus: 'SYNCED',
    });
    matriculaService.listAlunoIdsByTurma.mockResolvedValue([
      'aluno-1',
      'aluno-2',
    ]);
    tarefaService.listByTurma.mockResolvedValue([
      {
        id: 'tarefa-1',
        googleCourseWorkId: 'cw1',
        microsoftAssignmentId: 'a1',
      },
      {
        id: 'tarefa-2',
        googleCourseWorkId: 'cw2',
        microsoftAssignmentId: null,
      },
    ]);
    notaService.listByTarefa.mockImplementation(async (tarefaId: string) => {
      if (tarefaId === 'tarefa-1') {
        return [
          { status: SubmissionStatus.SUBMITTED },
          { status: SubmissionStatus.LATE },
        ];
      }
      return [{ status: SubmissionStatus.MISSING }];
    });
    entregaContingenciaService.listByTurma.mockResolvedValue([{}]);

    const report = await service.turmaSummary('turma-1');

    expect(report.totalAlunos).toBe(2);
    expect(report.totalTarefas).toBe(2);
    expect(report.tarefasEspelhadas).toBe(1);
    expect(report.tarefasSoGoogle).toBe(1);
    expect(report.tarefasSoMicrosoft).toBe(0);
    expect(report.entregasRegistradas).toBe(2);
    // totalPossivel = 2 alunos * 2 tarefas = 4; 2 entregues => 50%
    expect(report.taxaEntregaPercent).toBe(50);
    expect(report.entregasPendentes).toBe(2);
    expect(report.entregasContingencia).toBe(1);
  });

  it('turmaSummary lida com turma sem tarefas sem dividir por zero', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({
      id: 'turma-1',
      name: 'Turma A',
      syncStatus: 'SYNCED',
    });
    matriculaService.listAlunoIdsByTurma.mockResolvedValue([]);
    tarefaService.listByTurma.mockResolvedValue([]);
    entregaContingenciaService.listByTurma.mockResolvedValue([]);

    const report = await service.turmaSummary('turma-1');

    expect(report.taxaEntregaPercent).toBe(0);
    expect(report.entregasPendentes).toBe(0);
  });
});
