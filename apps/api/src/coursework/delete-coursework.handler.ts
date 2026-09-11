import { Injectable } from '@nestjs/common';
import { SyncJobHandler } from '../sync-queue/sync-job-handler';
import { ExternalAccountsService } from '../professor/external-accounts.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { GoogleClassroomClient } from '../integrations/google/google-classroom.client';
import { MicrosoftTeamsClient } from '../integrations/microsoft/microsoft-teams.client';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { TarefaService, DELETE_COURSEWORK_JOB } from './tarefa.service';

interface DeleteCourseworkPayload {
  tarefaId: string;
  professorId: string;
}

/**
 * Handler do job DELETE_COURSEWORK (RF-SYNC-06): só roda depois que o
 * professor confirmou explicitamente a exclusão (TarefaService.requestDeletion
 * já validou isso antes de enfileirar). Propaga a exclusão para o lado(s) já
 * publicado(s); se a tarefa nunca chegou a ser publicada em nenhuma
 * plataforma, não há nada para propagar — finaliza direto.
 */
@Injectable()
export class DeleteCourseworkHandler implements SyncJobHandler {
  readonly jobType = DELETE_COURSEWORK_JOB;

  constructor(
    private readonly tarefaService: TarefaService,
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly googleClassroomClient: GoogleClassroomClient,
    private readonly microsoftTeamsClient: MicrosoftTeamsClient,
  ) {}

  async handle(payload: DeleteCourseworkPayload): Promise<void> {
    const tarefa = await this.tarefaService.findById(payload.tarefaId);

    try {
      if (!tarefa.googleCourseWorkId && !tarefa.microsoftAssignmentId) {
        await this.tarefaService.markDeleted(tarefa.id);
        return;
      }

      const turma = await this.turmaEspelhadaService.findById(
        tarefa.turmaEspelhadaId,
      );

      const deletions: Promise<void>[] = [];

      if (tarefa.googleCourseWorkId) {
        const googleAccount =
          await this.externalAccountsService.findByProfessorAndProvider(
            payload.professorId,
            ExternalProvider.GOOGLE,
          );
        if (!googleAccount) {
          throw new Error('Professor não possui conta Google vinculada');
        }
        const googleToken =
          this.externalAccountsService.getDecryptedAccessToken(googleAccount);
        deletions.push(
          this.googleClassroomClient.deleteCourseWork(
            googleToken,
            turma.googleCourseId as string,
            tarefa.googleCourseWorkId,
          ),
        );
      }

      if (tarefa.microsoftAssignmentId) {
        const microsoftAccount =
          await this.externalAccountsService.findByProfessorAndProvider(
            payload.professorId,
            ExternalProvider.MICROSOFT,
          );
        if (!microsoftAccount) {
          throw new Error('Professor não possui conta Microsoft vinculada');
        }
        const microsoftToken =
          this.externalAccountsService.getDecryptedAccessToken(
            microsoftAccount,
          );
        deletions.push(
          this.microsoftTeamsClient.deleteAssignment(
            microsoftToken,
            turma.microsoftTeamId as string,
            tarefa.microsoftAssignmentId,
          ),
        );
      }

      await Promise.all(deletions);
      await this.tarefaService.markDeleted(tarefa.id);
    } catch (error) {
      await this.tarefaService.markError(tarefa.id, (error as Error).message);
      throw error;
    }
  }
}
