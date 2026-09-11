import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { SyncStatus } from '../turma-espelhada/sync-status.enum';
import { SyncQueueService } from '../sync-queue/sync-queue.service';
import { Tarefa } from './tarefa.entity';

export const PUBLISH_COURSEWORK_JOB = 'PUBLISH_COURSEWORK';
export const UPDATE_COURSEWORK_JOB = 'UPDATE_COURSEWORK';

export interface TarefaInput {
  title: string;
  description?: string;
  dueDate?: Date;
  points?: number;
  materialLinks?: string[];
}

@Injectable()
export class TarefaService {
  constructor(
    @InjectRepository(Tarefa)
    private readonly repository: Repository<Tarefa>,
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly syncQueueService: SyncQueueService,
  ) {}

  /** RF-SYNC-01: publica uma vez no Bimo, propaga para as duas plataformas. */
  async publish(
    turmaId: string,
    professorId: string,
    input: TarefaInput,
  ): Promise<Tarefa> {
    const tenantId = TenantContext.getTenantId();
    const turma = await this.turmaEspelhadaService.findById(turmaId);

    if (turma.syncStatus !== SyncStatus.SYNCED) {
      throw new BadRequestException(
        'A turma ainda não está totalmente sincronizada (Google e Microsoft); espere a sincronização terminar antes de publicar tarefas.',
      );
    }

    const tarefa = await this.repository.save(
      this.repository.create({
        tenantId,
        turmaEspelhadaId: turmaId,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        points: input.points ?? null,
        materialLinks: input.materialLinks ?? [],
        syncStatus: SyncStatus.SYNCING,
      }),
    );

    await this.syncQueueService.enqueue(tenantId, PUBLISH_COURSEWORK_JOB, {
      tarefaId: tarefa.id,
      professorId,
    });

    return tarefa;
  }

  /** RF-SYNC-02: edita a tarefa já publicada, preservando entregas/notas já lançadas. */
  async update(
    tarefaId: string,
    professorId: string,
    input: TarefaInput,
  ): Promise<Tarefa> {
    const tenantId = TenantContext.getTenantId();
    const tarefa = await this.findById(tarefaId);

    await this.repository.update(
      { id: tarefaId, tenantId },
      {
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        points: input.points ?? null,
        materialLinks: input.materialLinks ?? tarefa.materialLinks,
        syncStatus: SyncStatus.SYNCING,
      },
    );

    await this.syncQueueService.enqueue(tenantId, UPDATE_COURSEWORK_JOB, {
      tarefaId,
      professorId,
    });

    return this.findById(tarefaId);
  }

  async findById(id: string): Promise<Tarefa> {
    const tenantId = TenantContext.getTenantId();
    const tarefa = await this.repository.findOne({ where: { id, tenantId } });
    if (!tarefa) {
      throw new NotFoundException('Tarefa não encontrada');
    }
    return tarefa;
  }

  async listByTurma(turmaEspelhadaId: string): Promise<Tarefa[]> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.find({
      where: { tenantId, turmaEspelhadaId },
      order: { createdAt: 'DESC' },
    });
  }

  async markSynced(
    id: string,
    ids: { googleCourseWorkId: string; microsoftAssignmentId: string },
  ): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.repository.update(
      { id, tenantId },
      {
        googleCourseWorkId: ids.googleCourseWorkId,
        microsoftAssignmentId: ids.microsoftAssignmentId,
        syncStatus: SyncStatus.SYNCED,
        lastError: null,
      },
    );
  }

  async markUpdated(id: string): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.repository.update(
      { id, tenantId },
      { syncStatus: SyncStatus.SYNCED, lastError: null },
    );
  }

  async markError(id: string, message: string): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.repository.update(
      { id, tenantId },
      { syncStatus: SyncStatus.ERROR, lastError: message },
    );
  }

  async findByGoogleCourseWorkId(
    googleCourseWorkId: string,
  ): Promise<Tarefa | null> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.findOne({ where: { tenantId, googleCourseWorkId } });
  }

  async findByMicrosoftAssignmentId(
    microsoftAssignmentId: string,
  ): Promise<Tarefa | null> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.findOne({
      where: { tenantId, microsoftAssignmentId },
    });
  }

  /**
   * RF-MIG-02: cria/atualiza a partir de uma tarefa já existente e
   * publicada numa das plataformas (importação de histórico), sem
   * enfileirar nenhum job — a tarefa já está publicada na origem, não
   * precisa ser criada de novo. Idempotente por id externo (RF-MIG-05).
   */
  async importFromExternal(input: {
    turmaEspelhadaId: string;
    title: string;
    description?: string | null;
    dueDate?: Date | null;
    points?: number | null;
    materialLinks?: string[];
    googleCourseWorkId?: string | null;
    microsoftAssignmentId?: string | null;
  }): Promise<Tarefa> {
    const tenantId = TenantContext.getTenantId();

    const existing = input.googleCourseWorkId
      ? await this.findByGoogleCourseWorkId(input.googleCourseWorkId)
      : input.microsoftAssignmentId
        ? await this.findByMicrosoftAssignmentId(input.microsoftAssignmentId)
        : null;

    if (existing) {
      return existing;
    }

    return this.repository.save(
      this.repository.create({
        tenantId,
        turmaEspelhadaId: input.turmaEspelhadaId,
        title: input.title,
        description: input.description ?? null,
        dueDate: input.dueDate ?? null,
        points: input.points ?? null,
        materialLinks: input.materialLinks ?? [],
        googleCourseWorkId: input.googleCourseWorkId ?? null,
        microsoftAssignmentId: input.microsoftAssignmentId ?? null,
        syncStatus: SyncStatus.SYNCED,
      }),
    );
  }
}
