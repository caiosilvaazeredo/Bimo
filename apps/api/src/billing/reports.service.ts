import { Injectable } from '@nestjs/common';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { ProfessorsService } from '../professor/professors.service';
import { EntregaContingenciaService } from '../aluno/entrega-contingencia.service';
import { MatriculaService } from '../aluno/matricula.service';
import { TarefaService } from '../coursework/tarefa.service';
import { NotaService } from '../coursework/nota.service';
import { SubmissionStatus } from '../coursework/submission-status.enum';

export interface InstitutionalAdoptionReport {
  totalProfessors: number;
  totalTurmas: number;
  turmasEspelhadas: number;
  turmasSoGoogle: number;
  turmasSoMicrosoft: number;
}

export interface TurmaReport {
  turmaId: string;
  turmaName: string;
  syncStatus: string;
  totalAlunos: number;
  totalTarefas: number;
  tarefasSoGoogle: number;
  tarefasSoMicrosoft: number;
  tarefasEspelhadas: number;
  entregasRegistradas: number;
  entregasPendentes: number;
  taxaEntregaPercent: number;
  entregasContingencia: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly professorsService: ProfessorsService,
    private readonly entregaContingenciaService: EntregaContingenciaService,
    private readonly matriculaService: MatriculaService,
    private readonly tarefaService: TarefaService,
    private readonly notaService: NotaService,
  ) {}

  /** RF-REPORT-02: adoção institucional. */
  async institutionalAdoption(): Promise<InstitutionalAdoptionReport> {
    const [turmas, professors] = await Promise.all([
      this.turmaEspelhadaService.listByTenant(),
      this.professorsService.listByTenant(),
    ]);

    return {
      totalProfessors: professors.length,
      totalTurmas: turmas.length,
      turmasEspelhadas: turmas.filter(
        (t) => t.googleCourseId && t.microsoftTeamId,
      ).length,
      turmasSoGoogle: turmas.filter(
        (t) => t.googleCourseId && !t.microsoftTeamId,
      ).length,
      turmasSoMicrosoft: turmas.filter(
        (t) => !t.googleCourseId && t.microsoftTeamId,
      ).length,
    };
  }

  /**
   * RF-REPORT-01: taxa de entrega por turma. O Nota não guarda de qual
   * plataforma a entrega chegou (não existe esse conceito no modelo —
   * uma submission tem só um estado unificado no Bimo), então a
   * comparação "via Classroom vs via Teams" pedida no requisito é
   * aproximada aqui pela presença do id externo em cada Tarefa
   * (tarefasSoGoogle/tarefasSoMicrosoft/tarefasEspelhadas), não por
   * entrega individual rastreada por origem.
   */
  async turmaSummary(turmaId: string): Promise<TurmaReport> {
    const turma = await this.turmaEspelhadaService.findById(turmaId);
    const [alunoIds, tarefas, entregasContingencia] = await Promise.all([
      this.matriculaService.listAlunoIdsByTurma(turmaId),
      this.tarefaService.listByTurma(turmaId),
      this.entregaContingenciaService.listByTurma(turmaId),
    ]);

    const notasPorTarefa = await Promise.all(
      tarefas.map((t) => this.notaService.listByTarefa(t.id)),
    );
    const notas = notasPorTarefa.flat();
    const entregasRegistradas = notas.filter(
      (n) =>
        n.status === SubmissionStatus.SUBMITTED ||
        n.status === SubmissionStatus.LATE,
    ).length;

    const totalPossivel = alunoIds.length * tarefas.length;

    return {
      turmaId: turma.id,
      turmaName: turma.name,
      syncStatus: turma.syncStatus,
      totalAlunos: alunoIds.length,
      totalTarefas: tarefas.length,
      tarefasSoGoogle: tarefas.filter(
        (t) => t.googleCourseWorkId && !t.microsoftAssignmentId,
      ).length,
      tarefasSoMicrosoft: tarefas.filter(
        (t) => !t.googleCourseWorkId && t.microsoftAssignmentId,
      ).length,
      tarefasEspelhadas: tarefas.filter(
        (t) => t.googleCourseWorkId && t.microsoftAssignmentId,
      ).length,
      entregasRegistradas,
      entregasPendentes: Math.max(totalPossivel - entregasRegistradas, 0),
      taxaEntregaPercent:
        totalPossivel > 0
          ? Math.round((entregasRegistradas / totalPossivel) * 1000) / 10
          : 0,
      entregasContingencia: entregasContingencia.length,
    };
  }
}
