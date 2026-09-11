import { Injectable } from '@nestjs/common';
import { SyncJobHandler } from '../sync-queue/sync-job-handler';
import { ExternalAccountsService } from '../professor/external-accounts.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { GoogleClassroomClient } from '../integrations/google/google-classroom.client';
import { MicrosoftTeamsClient } from '../integrations/microsoft/microsoft-teams.client';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';

interface CreateMissingSidePayload {
  turmaEspelhadaId: string;
  professorId: string;
}

export const CREATE_MISSING_MICROSOFT_TEAM_JOB =
  'CREATE_MISSING_MICROSOFT_TEAM';
export const CREATE_MISSING_GOOGLE_COURSE_JOB = 'CREATE_MISSING_GOOGLE_COURSE';

/**
 * RF-MIG-01: quando a turma existe só no Classroom, o Bimo cria o Team
 * que falta no Teams, usando o nome da turma como ponto de partida.
 */
@Injectable()
export class CreateMissingMicrosoftTeamHandler implements SyncJobHandler {
  readonly jobType = CREATE_MISSING_MICROSOFT_TEAM_JOB;

  constructor(
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly microsoftTeamsClient: MicrosoftTeamsClient,
  ) {}

  async handle(payload: CreateMissingSidePayload): Promise<void> {
    const turma = await this.turmaEspelhadaService.findById(
      payload.turmaEspelhadaId,
    );
    try {
      const account =
        await this.externalAccountsService.findByProfessorAndProvider(
          payload.professorId,
          ExternalProvider.MICROSOFT,
        );
      if (!account) {
        throw new Error('Professor não possui conta Microsoft vinculada');
      }
      const token =
        this.externalAccountsService.getDecryptedAccessToken(account);
      const team = await this.microsoftTeamsClient.createTeam(token, {
        name: turma.name,
      });
      await this.turmaEspelhadaService.markSideSynced(
        turma.id,
        'MICROSOFT',
        team.externalId,
      );
    } catch (error) {
      await this.turmaEspelhadaService.markError(
        turma.id,
        (error as Error).message,
      );
      throw error;
    }
  }
}

/** RF-MIG-01: simétrico ao acima, quando a turma existe só no Teams. */
@Injectable()
export class CreateMissingGoogleCourseHandler implements SyncJobHandler {
  readonly jobType = CREATE_MISSING_GOOGLE_COURSE_JOB;

  constructor(
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly googleClassroomClient: GoogleClassroomClient,
  ) {}

  async handle(payload: CreateMissingSidePayload): Promise<void> {
    const turma = await this.turmaEspelhadaService.findById(
      payload.turmaEspelhadaId,
    );
    try {
      const account =
        await this.externalAccountsService.findByProfessorAndProvider(
          payload.professorId,
          ExternalProvider.GOOGLE,
        );
      if (!account) {
        throw new Error('Professor não possui conta Google vinculada');
      }
      const token =
        this.externalAccountsService.getDecryptedAccessToken(account);
      const course = await this.googleClassroomClient.createCourse(token, {
        name: turma.name,
      });
      await this.turmaEspelhadaService.markSideSynced(
        turma.id,
        'GOOGLE',
        course.externalId,
      );
    } catch (error) {
      await this.turmaEspelhadaService.markError(
        turma.id,
        (error as Error).message,
      );
      throw error;
    }
  }
}
