import { Injectable } from '@nestjs/common';
import { SyncJobHandler } from '../sync-queue/sync-job-handler';
import { ExternalAccountsService } from '../professor/external-accounts.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { GoogleClassroomClient } from '../integrations/google/google-classroom.client';
import { MicrosoftTeamsClient } from '../integrations/microsoft/microsoft-teams.client';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { TarefaService, UPDATE_COURSEWORK_JOB } from './tarefa.service';

interface UpdateCourseworkPayload {
  tarefaId: string;
  professorId: string;
}

/** Handler do job UPDATE_COURSEWORK (RF-SYNC-02): preserva entregas/notas já lançadas. */
@Injectable()
export class UpdateCourseworkHandler implements SyncJobHandler {
  readonly jobType = UPDATE_COURSEWORK_JOB;

  constructor(
    private readonly tarefaService: TarefaService,
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly googleClassroomClient: GoogleClassroomClient,
    private readonly microsoftTeamsClient: MicrosoftTeamsClient,
  ) {}

  async handle(payload: UpdateCourseworkPayload): Promise<void> {
    const tarefa = await this.tarefaService.findById(payload.tarefaId);

    try {
      if (!tarefa.googleCourseWorkId || !tarefa.microsoftAssignmentId) {
        throw new Error(
          'Tarefa ainda não foi publicada nas duas plataformas; aguarde a publicação terminar.',
        );
      }
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

      await Promise.all([
        this.googleClassroomClient.updateCourseWork(
          googleToken,
          turma.googleCourseId as string,
          tarefa.googleCourseWorkId,
          input,
        ),
        this.microsoftTeamsClient.updateAssignment(
          microsoftToken,
          turma.microsoftTeamId as string,
          tarefa.microsoftAssignmentId,
          input,
        ),
      ]);

      await this.tarefaService.markUpdated(tarefa.id);
    } catch (error) {
      await this.tarefaService.markError(tarefa.id, (error as Error).message);
      throw error;
    }
  }
}
