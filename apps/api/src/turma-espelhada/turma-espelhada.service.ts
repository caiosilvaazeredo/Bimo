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
    ids: { googleCourseId: string; microsoftTeamId: string },
  ): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.repository.update(
      { id, tenantId },
      {
        googleCourseId: ids.googleCourseId,
        microsoftTeamId: ids.microsoftTeamId,
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
}
