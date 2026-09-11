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

    const [googleEmails, microsoftEmails] = await Promise.all([
      turma.googleCourseId
        ? this.fetchGoogleRoster(professorId, turma.googleCourseId)
        : Promise.resolve([]),
      turma.microsoftTeamId
        ? this.fetchMicrosoftRoster(professorId, turma.microsoftTeamId)
        : Promise.resolve([]),
    ]);

    const googleSet = new Set(googleEmails.map((e) => e.toLowerCase()));
    const microsoftSet = new Set(microsoftEmails.map((e) => e.toLowerCase()));
    const allEmails = new Set([...googleSet, ...microsoftSet]);

    const result: RosterReconciliation = {
      onlyGoogle: [],
      onlyMicrosoft: [],
      both: [],
    };

    for (const email of allEmails) {
      const inGoogle = googleSet.has(email);
      const inMicrosoft = microsoftSet.has(email);
      if (inGoogle && inMicrosoft) {
        result.both.push(email);
      } else if (inGoogle) {
        result.onlyGoogle.push(email);
      } else {
        result.onlyMicrosoft.push(email);
      }

      const aluno = await this.alunosService.findOrCreateByInstitutionalEmail({
        institutionalEmail: email,
        displayName: email,
      });
      await this.matriculaService.enroll(aluno.id, turma.id);
    }

    return result;
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

  private async fetchGoogleRoster(
    professorId: string,
    courseId: string,
  ): Promise<string[]> {
    const token = await this.googleAccessToken(professorId);
    return this.googleClassroomClient.listStudentEmails(token, courseId);
  }

  private async fetchMicrosoftRoster(
    professorId: string,
    groupId: string,
  ): Promise<string[]> {
    const token = await this.microsoftAccessToken(professorId);
    return this.microsoftTeamsClient.listMemberEmails(token, groupId);
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
