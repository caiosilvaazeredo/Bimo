import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { SyncStatus } from '../turma-espelhada/sync-status.enum';
import { SyncQueueService } from '../sync-queue/sync-queue.service';
import { Nota } from './nota.entity';
import { SubmissionStatus } from './submission-status.enum';

export const SYNC_GRADE_JOB = 'SYNC_GRADE';

export interface SetGradeInput {
  grade?: number | null;
  comment?: string | null;
  status?: SubmissionStatus;
}

@Injectable()
export class NotaService {
  constructor(
    @InjectRepository(Nota)
    private readonly repository: Repository<Nota>,
    private readonly syncQueueService: SyncQueueService,
  ) {}

  /** RF-SYNC-04: lançada uma vez no Bimo, propagada para as duas plataformas. */
  async setGrade(
    tarefaId: string,
    alunoId: string,
    professorId: string,
    input: SetGradeInput,
  ): Promise<Nota> {
    const tenantId = TenantContext.getTenantId();
    const existing = await this.repository.findOne({
      where: { tenantId, tarefaId, alunoId },
    });

    const nota = existing
      ? await this.repository.save(
          Object.assign(existing, {
            grade: input.grade ?? existing.grade,
            comment: input.comment ?? existing.comment,
            status: input.status ?? existing.status,
            syncStatus: SyncStatus.SYNCING,
          }),
        )
      : await this.repository.save(
          this.repository.create({
            tenantId,
            tarefaId,
            alunoId,
            grade: input.grade ?? null,
            comment: input.comment ?? null,
            status: input.status ?? SubmissionStatus.SUBMITTED,
            syncStatus: SyncStatus.SYNCING,
          }),
        );

    await this.syncQueueService.enqueue(tenantId, SYNC_GRADE_JOB, {
      notaId: nota.id,
      professorId,
    });

    return nota;
  }

  async findById(id: string): Promise<Nota> {
    const tenantId = TenantContext.getTenantId();
    const nota = await this.repository.findOne({ where: { id, tenantId } });
    if (!nota) {
      throw new NotFoundException('Nota não encontrada');
    }
    return nota;
  }

  async findByTarefaAndAluno(
    tarefaId: string,
    alunoId: string,
  ): Promise<Nota | null> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.findOne({ where: { tenantId, tarefaId, alunoId } });
  }

  async listByTarefa(tarefaId: string): Promise<Nota[]> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.find({ where: { tenantId, tarefaId } });
  }

  async markSynced(id: string): Promise<void> {
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
}
