import { Injectable } from '@nestjs/common';
import { SyncJobHandler } from '../sync-queue/sync-job-handler';
import { ExternalAccountsService } from '../professor/external-accounts.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { GoogleClassroomClient } from '../integrations/google/google-classroom.client';
import { MicrosoftTeamsClient } from '../integrations/microsoft/microsoft-teams.client';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { TarefaService, PUBLISH_COURSEWORK_JOB } from './tarefa.service';

interface PublishCourseworkPayload {
  tarefaId: string;
  professorId: string;
}

/** Handler do job PUBLISH_COURSEWORK (RF-SYNC-01). */
@Injectable()
export class PublishCourseworkHandler implements SyncJobHandler {
  readonly jobType = PUBLISH_COURSEWORK_JOB;

  constructor(
    private readonly tarefaService: TarefaService,
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly googleClassroomClient: GoogleClassroomClient,
    private readonly microsoftTeamsClient: MicrosoftTeamsClient,
  ) {}

  async handle(payload: PublishCourseworkPayload): Promise<void> {
    const tarefa = await this.tarefaService.findById(payload.tarefaId);

    try {
      const turma = await this.turmaEspelhadaService.findById(
        tarefa.turmaEspelhadaId,
      );

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
      if (!googleAccount || !microsoftAccount) {
        throw new Error(
          'Professor não possui as duas contas externas necessárias vinculadas',
        );
      }

      const googleToken =
        this.externalAccountsService.getDecryptedAccessToken(googleAccount);
      const microsoftToken =
        this.externalAccountsService.getDecryptedAccessToken(microsoftAccount);

      const input = {
        title: tarefa.title,
        description: tarefa.description ?? undefined,
        dueDateIso: tarefa.dueDate?.toISOString() ?? null,
        points: tarefa.points,
        materialLinks: tarefa.materialLinks,
      };

      const [courseWork, assignment] = await Promise.all([
        this.googleClassroomClient.createCourseWork(
          googleToken,
          turma.googleCourseId as string,
          input,
        ),
        this.microsoftTeamsClient.createAssignment(
          microsoftToken,
          turma.microsoftTeamId as string,
          input,
        ),
      ]);

      await this.tarefaService.markSynced(tarefa.id, {
        googleCourseWorkId: courseWork.externalId,
        microsoftAssignmentId: assignment.externalId,
      });
    } catch (error) {
      await this.tarefaService.markError(tarefa.id, (error as Error).message);
      throw error;
    }
  }
}
