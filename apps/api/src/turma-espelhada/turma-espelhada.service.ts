import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { ExternalAccountsService } from '../professor/external-accounts.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { SyncQueueService } from '../sync-queue/sync-queue.service';
import { TurmaEspelhada } from './turma-espelhada.entity';
import { SyncStatus } from './sync-status.enum';

export const CREATE_TURMA_ESPELHADA_JOB = 'CREATE_TURMA_ESPELHADA';

@Injectable()
export class TurmaEspelhadaService {
  constructor(
    @InjectRepository(TurmaEspelhada)
    private readonly repository: Repository<TurmaEspelhada>,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly syncQueueService: SyncQueueService,
  ) {}

  /**
   * RF-DASH-01 + RF-AUTH-03: bloqueia a criação se faltar uma das duas
   * contas externas do professor, com mensagem explicando o que falta.
   */
  async create(input: {
    professorId: string;
    name: string;
    academicPeriod?: string;
  }): Promise<TurmaEspelhada> {
    const tenantId = TenantContext.getTenantId();

    const [hasGoogle, hasMicrosoft] = await Promise.all([
      this.externalAccountsService.hasProvider(
        input.professorId,
        ExternalProvider.GOOGLE,
      ),
      this.externalAccountsService.hasProvider(
        input.professorId,
        ExternalProvider.MICROSOFT,
      ),
    ]);

    const missing = [
      !hasGoogle && 'Google',
      !hasMicrosoft && 'Microsoft',
    ].filter(Boolean);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Não é possível criar a turma espelhada: falta vincular a conta ${missing.join(' e ')} ao seu perfil.`,
      );
    }

    const turma = await this.repository.save(
      this.repository.create({
        tenantId,
        professorId: input.professorId,
        name: input.name,
        academicPeriod: input.academicPeriod ?? null,
        syncStatus: SyncStatus.SYNCING,
      }),
    );

    await this.syncQueueService.enqueue(tenantId, CREATE_TURMA_ESPELHADA_JOB, {
      turmaEspelhadaId: turma.id,
      professorId: input.professorId,
    });

    return turma;
  }

  async findById(id: string): Promise<TurmaEspelhada> {
    const tenantId = TenantContext.getTenantId();
    const turma = await this.repository.findOne({ where: { id, tenantId } });
    if (!turma) {
      throw new NotFoundException('Turma espelhada não encontrada');
    }
    return turma;
  }

  async listByTenant(): Promise<TurmaEspelhada[]> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.find({ where: { tenantId } });
  }

  async markSynced(
    id: string,
    ids: {
      googleCourseId: string;
      microsoftTeamId: string;
      googleCourseUrl?: string | null;
      microsoftTeamUrl?: string | null;
    },
  ): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.repository.update(
      { id, tenantId },
      {
        googleCourseId: ids.googleCourseId,
        microsoftTeamId: ids.microsoftTeamId,
        googleCourseUrl: ids.googleCourseUrl ?? null,
        microsoftTeamUrl: ids.microsoftTeamUrl ?? null,
        syncStatus: SyncStatus.SYNCED,
        lastError: null,
      },
    );
  }

  async markError(id: string, message: string): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.repository.update(
      { id, tenantId },
      { syncStatus: SyncStatus.ERROR, lastError: message },
    );
  }

  async findByGoogleCourseId(
    googleCourseId: string,
  ): Promise<TurmaEspelhada | null> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.findOne({ where: { tenantId, googleCourseId } });
  }

  async findByMicrosoftTeamId(
    microsoftTeamId: string,
  ): Promise<TurmaEspelhada | null> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.findOne({ where: { tenantId, microsoftTeamId } });
  }

  /**
   * RF-MIG-01: cria a turma-ponte apontando direto para um Course e/ou
   * Team já existentes (em vez de mandar criar do zero, como em create()).
   */
  async createLinked(input: {
    professorId: string;
    name: string;
    academicPeriod?: string;
    googleCourseId: string | null;
    microsoftTeamId: string | null;
  }): Promise<TurmaEspelhada> {
    const tenantId = TenantContext.getTenantId();
    const bothSides =
      Boolean(input.googleCourseId) && Boolean(input.microsoftTeamId);

    return this.repository.save(
      this.repository.create({
        tenantId,
        professorId: input.professorId,
        name: input.name,
        academicPeriod: input.academicPeriod ?? null,
        googleCourseId: input.googleCourseId,
        microsoftTeamId: input.microsoftTeamId,
        syncStatus: bothSides ? SyncStatus.SYNCED : SyncStatus.SYNCING,
      }),
    );
  }

  /** Preenche o lado que faltava (RF-MIG-01) e marca sincronizado quando os dois existirem. */
  async markSideSynced(
    id: string,
    side: 'GOOGLE' | 'MICROSOFT',
    externalId: string,
    externalUrl?: string | null,
  ): Promise<TurmaEspelhada> {
    const tenantId = TenantContext.getTenantId();
    const patch =
      side === 'GOOGLE'
        ? { googleCourseId: externalId, googleCourseUrl: externalUrl ?? null }
        : {
            microsoftTeamId: externalId,
            microsoftTeamUrl: externalUrl ?? null,
          };
    await this.repository.update({ id, tenantId }, patch);

    const turma = await this.findById(id);
    if (
      turma.googleCourseId &&
      turma.microsoftTeamId &&
      turma.syncStatus !== SyncStatus.SYNCED
    ) {
      await this.repository.update(
        { id, tenantId },
        { syncStatus: SyncStatus.SYNCED, lastError: null },
      );
      return this.findById(id);
    }
    return turma;
  }
}
