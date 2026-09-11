import { Injectable } from '@nestjs/common';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { SyncStatus } from '../turma-espelhada/sync-status.enum';
import { MatriculaService } from '../aluno/matricula.service';

/**
 * RF-BILL-01: calcula o número de alunos ativos por instituição, mesmo
 * sem cobrar por isso na v1 — serve de base para o faturamento quando o
 * modelo pago entrar em vigor (RF-BILL-03). "Aluno ativo" = matriculado
 * em ao menos uma turma espelhada com sincronização bem-sucedida
 * (critério de aceite de RF-BILL-01).
 *
 * Simplificação desta fase: como não há histórico de períodos de
 * faturamento nem eventos de "sincronização bem-sucedida" por aluno
 * (isso pertenceria à camada de coursework/submissions, ainda não
 * implementada), o cálculo usa o status atual da turma como proxy —
 * suficiente para o piloto, mas precisa de um corte temporal real
 * (por período) antes do modelo pago valer.
 */
@Injectable()
export class BillingService {
  constructor(
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly matriculaService: MatriculaService,
  ) {}

  async countActiveAlunos(): Promise<number> {
    const turmas = await this.turmaEspelhadaService.listByTenant();
    const syncedTurmaIds = turmas
      .filter((t) => t.syncStatus === SyncStatus.SYNCED)
      .map((t) => t.id);

    const alunoIdLists = await Promise.all(
      syncedTurmaIds.map((turmaId) =>
        this.matriculaService.listAlunoIdsByTurma(turmaId),
      ),
    );

    return new Set(alunoIdLists.flat()).size;
  }
}
