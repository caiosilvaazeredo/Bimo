import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Repository } from 'typeorm';
import { SyncJob } from './sync-job.entity';
import { SyncJobStatus } from './sync-job-status.enum';

const BASE_BACKOFF_MS = 5_000;
const MAX_BACKOFF_MS = 5 * 60_000;

function computeBackoffMs(attemptCount: number): number {
  return Math.min(BASE_BACKOFF_MS * 2 ** attemptCount, MAX_BACKOFF_MS);
}

@Injectable()
export class SyncQueueService {
  private readonly logger = new Logger(SyncQueueService.name);

  constructor(
    @InjectRepository(SyncJob)
    private readonly repository: Repository<SyncJob>,
  ) {}

  async enqueue(
    tenantId: string,
    jobType: string,
    payload: unknown,
  ): Promise<SyncJob> {
    return this.repository.save(
      this.repository.create({
        tenantId,
        jobType,
        payload: JSON.stringify(payload),
        status: SyncJobStatus.PENDING,
        attemptCount: 0,
        maxAttempts: 5,
        nextAttemptAt: new Date(),
      }),
    );
  }

  /**
   * "Claim" otimista: tenta várias vezes achar um job PENDING pronto e
   * fazer a transição PENDING -> PROCESSING de forma atômica (update
   * condicional por id+status). Evita que dois workers processem o
   * mesmo job (RNF-AVAIL-03: at-least-once, nunca perder job).
   *
   * TODO: revisitar com `SELECT ... FOR UPDATE SKIP LOCKED` nativo do
   * Oracle se o throughput da fila virar gargalo (ver riscos do plano
   * de implementação).
   */
  async claimNext(workerId: string): Promise<SyncJob | null> {
    const candidates = await this.repository.find({
      where: {
        status: SyncJobStatus.PENDING,
        nextAttemptAt: LessThanOrEqual(new Date()),
      },
      order: { nextAttemptAt: 'ASC' },
      take: 10,
    });

    for (const candidate of candidates) {
      const result = await this.repository.update(
        { id: candidate.id, status: SyncJobStatus.PENDING },
        {
          status: SyncJobStatus.PROCESSING,
          lockedBy: workerId,
          lockedAt: new Date(),
        },
      );
      if (result.affected === 1) {
        return this.repository.findOne({ where: { id: candidate.id } });
      }
    }

    return null;
  }

  async complete(jobId: string): Promise<void> {
    await this.repository.update(
      { id: jobId },
      { status: SyncJobStatus.DONE, lockedBy: null, lockedAt: null },
    );
  }

  async fail(jobId: string, error: Error): Promise<void> {
    const job = await this.repository.findOne({ where: { id: jobId } });
    if (!job) return;

    const attemptCount = job.attemptCount + 1;
    const exhausted = attemptCount >= job.maxAttempts;

    this.logger.warn(
      `Job ${jobId} (${job.jobType}) falhou na tentativa ${attemptCount}/${job.maxAttempts}: ${error.message}`,
    );

    await this.repository.update(
      { id: jobId },
      {
        attemptCount,
        status: exhausted ? SyncJobStatus.FAILED : SyncJobStatus.PENDING,
        nextAttemptAt: new Date(Date.now() + computeBackoffMs(attemptCount)),
        lastError: error.message,
        lockedBy: null,
        lockedAt: null,
      },
    );
  }
}
