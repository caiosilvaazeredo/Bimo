import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { SyncQueueService } from './sync-queue.service';
import { SYNC_JOB_HANDLERS, SyncJobHandler } from './sync-job-handler';

/**
 * Processa um job por vez da fila de sincronização, despachando por
 * jobType para o handler registrado (RNF-ARCH-02: motor de sincronização
 * desacoplado do painel web). Cada chamada roda dentro do TenantContext
 * do próprio job, para que os serviços de domínio não precisem saber
 * que estão sendo chamados por um worker em vez de uma requisição HTTP.
 */
@Injectable()
export class SyncWorkerService {
  private readonly logger = new Logger(SyncWorkerService.name);
  private readonly handlersByType: Map<string, SyncJobHandler>;

  constructor(
    @Optional() @Inject(SYNC_JOB_HANDLERS) handlers: SyncJobHandler[] = [],
    private readonly syncQueueService: SyncQueueService,
  ) {
    this.handlersByType = new Map(
      handlers.map((handler) => [handler.jobType, handler]),
    );
  }

  /** Processa um job pendente, se houver. Retorna false se a fila estava vazia. */
  async processOnce(workerId: string): Promise<boolean> {
    const job = await this.syncQueueService.claimNext(workerId);
    if (!job) {
      return false;
    }

    const handler = this.handlersByType.get(job.jobType);

    try {
      if (!handler) {
        throw new Error(
          `Nenhum handler registrado para job type "${job.jobType}"`,
        );
      }
      await TenantContext.run({ tenantId: job.tenantId }, () =>
        handler.handle(JSON.parse(job.payload)),
      );
      await this.syncQueueService.complete(job.id);
    } catch (error) {
      this.logger.error(
        `Job ${job.id} (${job.jobType}, tenant=${job.tenantId}) falhou: ${(error as Error).message}`,
      );
      await this.syncQueueService.fail(job.id, error as Error);
    }

    return true;
  }
}
