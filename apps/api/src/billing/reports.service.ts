import { Injectable } from '@nestjs/common';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { ProfessorsService } from '../professor/professors.service';
import { EntregaContingenciaService } from '../aluno/entrega-contingencia.service';

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
  entregasContingencia: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly professorsService: ProfessorsService,
    private readonly entregaContingenciaService: EntregaContingenciaService,
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
   * RF-REPORT-01 (parcial): a taxa de entrega comparando Classroom vs
   * Teams depende da camada de coursework/submissions, que esta base
   * ainda não implementa. Por ora, reporta o que já existe de fato: o
   * volume de entregas recebidas via contingência naquela turma.
   */
  async turmaSummary(turmaId: string): Promise<TurmaReport> {
    const turma = await this.turmaEspelhadaService.findById(turmaId);
    const entregas = await this.entregaContingenciaService.listByTurma(turmaId);
    return {
      turmaId: turma.id,
      turmaName: turma.name,
      syncStatus: turma.syncStatus,
      entregasContingencia: entregas.length,
    };
  }
}
