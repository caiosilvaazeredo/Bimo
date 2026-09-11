import { BadRequestException, Injectable } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { ExternalAccountsService } from '../professor/external-accounts.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { GoogleClassroomClient } from '../integrations/google/google-classroom.client';
import { MicrosoftTeamsClient } from '../integrations/microsoft/microsoft-teams.client';
import { SyncQueueService } from '../sync-queue/sync-queue.service';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { TurmaEspelhada } from '../turma-espelhada/turma-espelhada.entity';
import { AlunosService } from '../aluno/alunos.service';
import { MatriculaService } from '../aluno/matricula.service';
import { TarefaService } from '../coursework/tarefa.service';
import { NotaService } from '../coursework/nota.service';
import { SubmissionStatus } from '../coursework/submission-status.enum';
import {
  CREATE_MISSING_GOOGLE_COURSE_JOB,
  CREATE_MISSING_MICROSOFT_TEAM_JOB,
} from './create-missing-side.handlers';

export interface LinkExistingInput {
  professorId: string;
  googleCourseId?: string;
  microsoftTeamId?: string;
  /** Obrigatório quando os dois ids são informados (RF-MIG-01: nunca correspondência automática). */
  confirmedSameClass?: boolean;
}

export interface RosterReconciliation {
  onlyGoogle: string[];
  onlyMicrosoft: string[];
  both: string[];
}

export type LinkExistingBatchResult =
  | { input: LinkExistingInput; ok: true; turma: TurmaEspelhada }
  | { input: LinkExistingInput; ok: false; error: string };

@Injectable()
export class MigrationService {
  constructor(
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly googleClassroomClient: GoogleClassroomClient,
    private readonly microsoftTeamsClient: MicrosoftTeamsClient,
    private readonly syncQueueService: SyncQueueService,
    private readonly alunosService: AlunosService,
    private readonly matriculaService: MatriculaService,
    private readonly tarefaService: TarefaService,
    private readonly notaService: NotaService,
  ) {}

  /**
   * RF-MIG-01: vincula uma turma já existente no Classroom e/ou Teams.
   * Idempotente (RF-MIG-05): religar o mesmo id externo retorna a turma
   * já vinculada em vez de duplicar.
   */
  async linkExisting(input: LinkExistingInput): Promise<TurmaEspelhada> {
    if (!input.googleCourseId && !input.microsoftTeamId) {
      throw new BadRequestException(
        'Informe ao menos um id de turma existente (Google ou Microsoft).',
      );
    }

    if (
      input.googleCourseId &&
      input.microsoftTeamId &&
      !input.confirmedSameClass
    ) {
      throw new BadRequestException(
        'A turma existe nos dois lados: confirme manualmente que é a mesma turma (confirmedSameClass=true) antes de vincular.',
      );
    }

    const existing = await this.findExistingLink(input);
    if (existing) {
      return existing;
    }

    const tenantId = TenantContext.getTenantId();
    const name = await this.resolveName(input);

    const turma = await this.turmaEspelhadaService.createLinked({
      professorId: input.professorId,
      name,
      googleCourseId: input.googleCourseId ?? null,
      microsoftTeamId: input.microsoftTeamId ?? null,
    });

    if (!input.googleCourseId) {
      await this.syncQueueService.enqueue(
        tenantId,
        CREATE_MISSING_GOOGLE_COURSE_JOB,
        {
          turmaEspelhadaId: turma.id,
          professorId: input.professorId,
        },
      );
    }
    if (!input.microsoftTeamId) {
      await this.syncQueueService.enqueue(
        tenantId,
        CREATE_MISSING_MICROSOFT_TEAM_JOB,
        {
          turmaEspelhadaId: turma.id,
          professorId: input.professorId,
        },
      );
    }

    return turma;
  }

  /**
   * RF-MIG-06: vincula várias turmas existentes de uma vez (ex: todas as
   * turmas do professor no início do semestre), reaproveitando linkExisting
   * item a item. Sequencial (não em paralelo) para não estourar rate limit
   * das duas APIs de uma vez com N turmas. Uma turma que falha (ex: id
   * inválido, falta confirmedSameClass) não interrompe as demais — cada
   * item do lote volta com seu próprio resultado (ok/erro), nunca lança.
   */
  async linkExistingBatch(
    inputs: LinkExistingInput[],
  ): Promise<LinkExistingBatchResult[]> {
    const results: LinkExistingBatchResult[] = [];
    for (const input of inputs) {
      try {
        const turma = await this.linkExisting(input);
        results.push({ input, ok: true, turma });
      } catch (error) {
        results.push({ input, ok: false, error: (error as Error).message });
      }
    }
    return results;
  }

  /**
   * RF-MIG-03: roster reconciliado por e-mail institucional, sinalizando
   * quem está presente em apenas um dos dois lados (mesma lógica de
   * RF-INT-03). Também matricula (RF-STU) quem já está claramente
   * identificado nos dois lados ou em pelo menos um.
   */
  async reconcileRoster(
    turmaId: string,
    professorId: string,
  ): Promise<RosterReconciliation> {
    const turma = await this.turmaEspelhadaService.findById(turmaId);

    const [googleStudents, microsoftMembers] = await Promise.all([
      turma.googleCourseId
        ? this.fetchGoogleRoster(professorId, turma.googleCourseId)
        : Promise.resolve([]),
      turma.microsoftTeamId
        ? this.fetchMicrosoftRoster(professorId, turma.microsoftTeamId)
        : Promise.resolve([]),
    ]);

    const googleByEmail = new Map(
      googleStudents.map((s) => [s.email.toLowerCase(), s.googleUserId]),
    );
    const microsoftByEmail = new Map(
      microsoftMembers.map((m) => [m.email.toLowerCase(), m.microsoftUserId]),
    );
    const allEmails = new Set([
      ...googleByEmail.keys(),
      ...microsoftByEmail.keys(),
    ]);

    const result: RosterReconciliation = {
      onlyGoogle: [],
      onlyMicrosoft: [],
      both: [],
    };

    for (const email of allEmails) {
      const googleUserId = googleByEmail.get(email) ?? null;
      const microsoftUserId = microsoftByEmail.get(email) ?? null;
      if (googleUserId && microsoftUserId) {
        result.both.push(email);
      } else if (googleUserId) {
        result.onlyGoogle.push(email);
      } else {
        result.onlyMicrosoft.push(email);
      }

      const aluno = await this.alunosService.findOrCreateByInstitutionalEmail({
        institutionalEmail: email,
        displayName: email,
      });
      await this.matriculaService.enroll(aluno.id, turma.id, {
        googleUserId,
        microsoftUserId,
      });
    }

    return result;
  }

  /**
   * RF-MIG-02: importa o histórico de tarefas já publicadas e as notas
   * já lançadas em cada lado já vinculado, preservando a data de
   * publicação original e o status de entrega de cada aluno. Idempotente
   * (RF-MIG-05) por id externo da tarefa. Não tenta publicar essas
   * tarefas históricas no lado que acabou de ser criado pelo Bimo — só
   * traz o que já existe como ponto de partida (RF-MIG-01).
   */
  async importHistory(
    turmaId: string,
    professorId: string,
  ): Promise<{ tarefasImportadas: number }> {
    const turma = await this.turmaEspelhadaService.findById(turmaId);
    const matriculas = await this.matriculaService.listByTurma(turmaId);
    const alunoIdByGoogleUserId = new Map(
      matriculas
        .filter((m) => m.googleUserId)
        .map((m) => [m.googleUserId as string, m.alunoId]),
    );
    const alunoIdByMicrosoftUserId = new Map(
      matriculas
        .filter((m) => m.microsoftUserId)
        .map((m) => [m.microsoftUserId as string, m.alunoId]),
    );

    let count = 0;

    if (turma.googleCourseId) {
      const token = await this.googleAccessToken(professorId);
      const courseWorks = await this.googleClassroomClient.listCourseWork(
        token,
        turma.googleCourseId,
      );

      for (const cw of courseWorks) {
        const tarefa = await this.tarefaService.importFromExternal({
          turmaEspelhadaId: turma.id,
          title: cw.title,
          description: cw.description,
          dueDate: cw.dueDateIso ? new Date(cw.dueDateIso) : null,
          points: cw.points,
          materialLinks: cw.materialLinks,
          googleCourseWorkId: cw.externalId,
        });
        count += 1;

        const submissions = await this.googleClassroomClient.listSubmissions(
          token,
          turma.googleCourseId,
          cw.externalId,
        );
        for (const sub of submissions) {
          if (sub.assignedGrade === null) continue;
          const alunoId = alunoIdByGoogleUserId.get(sub.googleUserId);
          if (!alunoId) continue;
          await this.notaService.setGrade(tarefa.id, alunoId, professorId, {
            grade: sub.assignedGrade,
            status: sub.late
              ? SubmissionStatus.LATE
              : SubmissionStatus.SUBMITTED,
          });
        }
      }
    }

    if (turma.microsoftTeamId) {
      const token = await this.microsoftAccessToken(professorId);
      const assignments = await this.microsoftTeamsClient.listAssignments(
        token,
        turma.microsoftTeamId,
      );

      for (const a of assignments) {
        const tarefa = await this.tarefaService.importFromExternal({
          turmaEspelhadaId: turma.id,
          title: a.title,
          description: a.description,
          dueDate: a.dueDateIso ? new Date(a.dueDateIso) : null,
          points: a.points,
          materialLinks: a.materialLinks,
          microsoftAssignmentId: a.externalId,
        });
        count += 1;

        const submissions =
          await this.microsoftTeamsClient.listAssignmentSubmissions(
            token,
            turma.microsoftTeamId,
            a.externalId,
          );
        for (const sub of submissions) {
          if (sub.points === null) continue;
          const alunoId = alunoIdByMicrosoftUserId.get(sub.microsoftUserId);
          if (!alunoId) continue;
          await this.notaService.setGrade(tarefa.id, alunoId, professorId, {
            grade: sub.points,
          });
        }
      }
    }

    return { tarefasImportadas: count };
  }

  private async findExistingLink(
    input: LinkExistingInput,
  ): Promise<TurmaEspelhada | null> {
    if (input.googleCourseId) {
      const byGoogle = await this.turmaEspelhadaService.findByGoogleCourseId(
        input.googleCourseId,
      );
      if (byGoogle) return byGoogle;
    }
    if (input.microsoftTeamId) {
      const byMicrosoft =
        await this.turmaEspelhadaService.findByMicrosoftTeamId(
          input.microsoftTeamId,
        );
      if (byMicrosoft) return byMicrosoft;
    }
    return null;
  }

  private async resolveName(input: LinkExistingInput): Promise<string> {
    if (input.googleCourseId) {
      const token = await this.googleAccessToken(input.professorId);
      const course = await this.googleClassroomClient.getCourse(
        token,
        input.googleCourseId,
      );
      return course.name;
    }
    const token = await this.microsoftAccessToken(input.professorId);
    const group = await this.microsoftTeamsClient.getGroup(
      token,
      input.microsoftTeamId as string,
    );
    return group.displayName;
  }

  private async fetchGoogleRoster(professorId: string, courseId: string) {
    const token = await this.googleAccessToken(professorId);
    return this.googleClassroomClient.listStudents(token, courseId);
  }

  private async fetchMicrosoftRoster(professorId: string, groupId: string) {
    const token = await this.microsoftAccessToken(professorId);
    return this.microsoftTeamsClient.listMembers(token, groupId);
  }

  private async googleAccessToken(professorId: string): Promise<string> {
    const account =
      await this.externalAccountsService.findByProfessorAndProvider(
        professorId,
        ExternalProvider.GOOGLE,
      );
    if (!account) {
      throw new BadRequestException(
        'Professor não possui conta Google vinculada',
      );
    }
    return this.externalAccountsService.getDecryptedAccessToken(account);
  }

  private async microsoftAccessToken(professorId: string): Promise<string> {
    const account =
      await this.externalAccountsService.findByProfessorAndProvider(
        professorId,
        ExternalProvider.MICROSOFT,
      );
    if (!account) {
      throw new BadRequestException(
        'Professor não possui conta Microsoft vinculada',
      );
    }
    return this.externalAccountsService.getDecryptedAccessToken(account);
  }
}
