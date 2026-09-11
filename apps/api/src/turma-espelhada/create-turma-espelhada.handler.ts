import { Injectable } from '@nestjs/common';
import { SyncJobHandler } from '../sync-queue/sync-job-handler';
import { ExternalAccountsService } from '../professor/external-accounts.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { GoogleClassroomClient } from '../integrations/google/google-classroom.client';
import { MicrosoftTeamsClient } from '../integrations/microsoft/microsoft-teams.client';
import {
  TurmaEspelhadaService,
  CREATE_TURMA_ESPELHADA_JOB,
} from './turma-espelhada.service';

interface CreateTurmaEspelhadaPayload {
  turmaEspelhadaId: string;
  professorId: string;
}

/**
 * Handler do job CREATE_TURMA_ESPELHADA (RF-INT-01/02): cria o Course no
 * Classroom e o Team no Teams a partir dos tokens do professor. Qualquer
 * falha aqui é relançada para o SyncWorkerService, que aciona o retry com
 * backoff da fila (RF-INT-05); a turma fica marcada como erro enquanto
 * isso não resolve.
 */
@Injectable()
export class CreateTurmaEspelhadaHandler implements SyncJobHandler {
  readonly jobType = CREATE_TURMA_ESPELHADA_JOB;

  constructor(
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly googleClassroomClient: GoogleClassroomClient,
    private readonly microsoftTeamsClient: MicrosoftTeamsClient,
  ) {}

  async handle(payload: CreateTurmaEspelhadaPayload): Promise<void> {
    const turma = await this.turmaEspelhadaService.findById(
      payload.turmaEspelhadaId,
    );

    try {
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

      const [course, team] = await Promise.all([
        this.googleClassroomClient.createCourse(googleToken, {
          name: turma.name,
          section: turma.academicPeriod ?? undefined,
        }),
        this.microsoftTeamsClient.createTeam(microsoftToken, {
          name: turma.name,
        }),
      ]);

      await this.turmaEspelhadaService.markSynced(turma.id, {
        googleCourseId: course.externalId,
        microsoftTeamId: team.externalId,
        googleCourseUrl: course.alternateLink,
        microsoftTeamUrl: team.webUrl,
      });
    } catch (error) {
      await this.turmaEspelhadaService.markError(
        turma.id,
        (error as Error).message,
      );
      throw error;
    }
  }
}
