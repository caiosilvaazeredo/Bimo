import { Injectable, Logger } from '@nestjs/common';
import { SyncJobHandler } from '../sync-queue/sync-job-handler';
import { ExternalAccountsService } from '../professor/external-accounts.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { GoogleClassroomClient } from '../integrations/google/google-classroom.client';
import { MicrosoftTeamsClient } from '../integrations/microsoft/microsoft-teams.client';
import { TarefaService } from './tarefa.service';
import { NotaService, SYNC_GRADE_JOB } from './nota.service';
import { MatriculaService } from '../aluno/matricula.service';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';

interface SyncGradePayload {
  notaId: string;
  professorId: string;
}

/**
 * Handler do job SYNC_GRADE (RF-SYNC-04). O Bimo é a fonte única da nota
 * entre as duas plataformas; a propagação para Classroom/Graph é
 * best-effort, condicionada a existir o id do aluno naquele provedor
 * (capturado no roster — RF-MIG-03/RF-INT-03). Sem nota numérica ou sem
 * o mapeamento do aluno em nenhum dos dois lados, a nota fica registrada
 * só no Bimo e o job é considerado concluído (nada a propagar).
 */
@Injectable()
export class SyncGradeHandler implements SyncJobHandler {
  readonly jobType = SYNC_GRADE_JOB;
  private readonly logger = new Logger(SyncGradeHandler.name);

  constructor(
    private readonly notaService: NotaService,
    private readonly tarefaService: TarefaService,
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly matriculaService: MatriculaService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly googleClassroomClient: GoogleClassroomClient,
    private readonly microsoftTeamsClient: MicrosoftTeamsClient,
  ) {}

  async handle(payload: SyncGradePayload): Promise<void> {
    const nota = await this.notaService.findById(payload.notaId);

    try {
      if (nota.grade === null) {
        await this.notaService.markSynced(nota.id);
        return;
      }

      const tarefa = await this.tarefaService.findById(nota.tarefaId);
      const turma = await this.turmaEspelhadaService.findById(
        tarefa.turmaEspelhadaId,
      );
      const matricula = await this.matriculaService.findByAlunoAndTurma(
        nota.alunoId,
        tarefa.turmaEspelhadaId,
      );

      if (!matricula) {
        this.logger.warn(
          `Nota ${nota.id}: aluno ${nota.alunoId} sem matrícula na turma, nada a propagar externamente.`,
        );
        await this.notaService.markSynced(nota.id);
        return;
      }

      const [googleAccount, microsoftAccount] = await Promise.all([
        this.externalAccountsService.findByProfessorAndProvider(
          payload.professorId,
          ExternalProvider.GOOGLE,
        ),
        this.externalAccountsService.findByProfessorAndProvider(
          payload.professorId,
          ExternalProvider.MICROSOFT,
        ),
      ]);

      const pushes: Promise<void>[] = [];

      if (
        tarefa.googleCourseWorkId &&
        matricula.googleUserId &&
        googleAccount
      ) {
        const token =
          this.externalAccountsService.getDecryptedAccessToken(googleAccount);
        pushes.push(
          this.googleClassroomClient.setGrade(
            token,
            turma.googleCourseId as string,
            tarefa.googleCourseWorkId,
            matricula.googleUserId,
            nota.grade,
          ),
        );
      }
      if (
        tarefa.microsoftAssignmentId &&
        matricula.microsoftUserId &&
        microsoftAccount
      ) {
        const token =
          this.externalAccountsService.getDecryptedAccessToken(
            microsoftAccount,
          );
        pushes.push(
          this.microsoftTeamsClient.setGrade(
            token,
            turma.microsoftTeamId as string,
            tarefa.microsoftAssignmentId,
            matricula.microsoftUserId,
            nota.grade,
          ),
        );
      }

      await Promise.all(pushes);
      await this.notaService.markSynced(nota.id);
    } catch (error) {
      await this.notaService.markError(nota.id, (error as Error).message);
      throw error;
    }
  }
}
