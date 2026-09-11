import { Injectable } from '@nestjs/common';
import { ExternalAccountsService } from '../professor/external-accounts.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { GoogleClassroomClient } from '../integrations/google/google-classroom.client';
import { MicrosoftTeamsClient } from '../integrations/microsoft/microsoft-teams.client';
import { ConflictService } from '../conflict/conflict.service';
import { NotificationsService } from '../notifications/notifications.service';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { TarefaService } from './tarefa.service';

const COMPARED_FIELDS = [
  'title',
  'description',
  'dueDateIso',
  'points',
] as const;

/**
 * RF-SYNC-03 (gatilho real): compara o estado atual da tarefa nas duas
 * plataformas contra o que o Bimo tem gravado. Se alguma diverge do
 * valor que o Bimo publicou por último, registra um conflito por campo
 * (usando o motor genérico já existente desde a Fase 4) e marca a
 * tarefa como "dessincronizada" — nunca resolve sozinho.
 *
 * Simplificação de RF-INT-06 (webhooks/change notifications não
 * implementados nesta base): a checagem é sob demanda, acionada pelo
 * professor ou por uma chamada externa (ex: um cron futuro), não um
 * listener automático de mudanças.
 */
@Injectable()
export class CourseworkConflictCheckService {
  constructor(
    private readonly tarefaService: TarefaService,
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly googleClassroomClient: GoogleClassroomClient,
    private readonly microsoftTeamsClient: MicrosoftTeamsClient,
    private readonly conflictService: ConflictService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async checkTarefa(
    tarefaId: string,
    professorId: string,
  ): Promise<{ conflictsFound: number }> {
    const tarefa = await this.tarefaService.findById(tarefaId);

    if (!tarefa.googleCourseWorkId || !tarefa.microsoftAssignmentId) {
      return { conflictsFound: 0 };
    }

    const turma = await this.turmaEspelhadaService.findById(
      tarefa.turmaEspelhadaId,
    );

    const [googleAccount, microsoftAccount] = await Promise.all([
      this.externalAccountsService.findByProfessorAndProvider(
        professorId,
        ExternalProvider.GOOGLE,
      ),
      this.externalAccountsService.findByProfessorAndProvider(
        professorId,
        ExternalProvider.MICROSOFT,
      ),
    ]);
    if (!googleAccount || !microsoftAccount) {
      return { conflictsFound: 0 };
    }

    const googleToken =
      this.externalAccountsService.getDecryptedAccessToken(googleAccount);
    const microsoftToken =
      this.externalAccountsService.getDecryptedAccessToken(microsoftAccount);

    const [googleState, microsoftState] = await Promise.all([
      this.googleClassroomClient.getCourseWork(
        googleToken,
        turma.googleCourseId as string,
        tarefa.googleCourseWorkId,
      ),
      this.microsoftTeamsClient.getAssignment(
        microsoftToken,
        turma.microsoftTeamId as string,
        tarefa.microsoftAssignmentId,
      ),
    ]);

    const googleValues: Record<string, string | null> = {
      title: googleState.title,
      description: googleState.description,
      dueDateIso: googleState.dueDateIso,
      points: googleState.points === null ? null : String(googleState.points),
    };
    const microsoftValues: Record<string, string | null> = {
      title: microsoftState.title,
      description: microsoftState.description,
      dueDateIso: microsoftState.dueDateIso,
      points:
        microsoftState.points === null ? null : String(microsoftState.points),
    };

    let conflictsFound = 0;
    for (const field of COMPARED_FIELDS) {
      if (googleValues[field] !== microsoftValues[field]) {
        await this.conflictService.raise({
          resourceType: 'TAREFA',
          resourceId: tarefa.id,
          fieldName: field,
          googleValue: googleValues[field],
          googleUpdatedAt: null,
          microsoftValue: microsoftValues[field],
          microsoftUpdatedAt: null,
        });
        conflictsFound += 1;
      }
    }

    if (conflictsFound > 0) {
      await this.tarefaService.markConflict(tarefa.id);
      await this.notificationsService.notifyConflict(
        professorId,
        tarefa.turmaEspelhadaId,
      );
    }

    return { conflictsFound };
  }
}
