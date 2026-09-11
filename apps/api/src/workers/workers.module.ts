import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SyncQueueModule } from '../sync-queue/sync-queue.module';
import { SyncWorkerService } from '../sync-queue/sync-worker.service';
import { SYNC_JOB_HANDLERS } from '../sync-queue/sync-job-handler';
import { SyncEventLogModule } from '../sync-event-log/sync-event-log.module';
import { TurmaEspelhadaModule } from '../turma-espelhada/turma-espelhada.module';
import { CreateTurmaEspelhadaHandler } from '../turma-espelhada/create-turma-espelhada.handler';
import { MigrationModule } from '../migration/migration.module';
import {
  CreateMissingGoogleCourseHandler,
  CreateMissingMicrosoftTeamHandler,
} from '../migration/create-missing-side.handlers';
import { CourseworkModule } from '../coursework/coursework.module';
import { PublishCourseworkHandler } from '../coursework/publish-coursework.handler';
import { UpdateCourseworkHandler } from '../coursework/update-coursework.handler';

const POLL_INTERVAL_MS = 5_000;

/**
 * Roda o worker de sincronização embutido no mesmo processo da API por
 * padrão (bom o suficiente para a escala piloto do Free Tier). Em
 * produção pós-piloto, este módulo pode virar um processo Node dedicado
 * sem tocar nos handlers (RNF-ARCH-02).
 *
 * Desativa em testes / quando WORKERS_ENABLED=false, para não tentar
 * bater no banco fora de um ambiente real.
 */
@Module({
  imports: [
    SyncQueueModule,
    SyncEventLogModule,
    TurmaEspelhadaModule,
    MigrationModule,
    CourseworkModule,
  ],
  providers: [
    SyncWorkerService,
    {
      provide: SYNC_JOB_HANDLERS,
      useFactory: (
        createTurmaHandler: CreateTurmaEspelhadaHandler,
        createMissingTeamHandler: CreateMissingMicrosoftTeamHandler,
        createMissingCourseHandler: CreateMissingGoogleCourseHandler,
        publishCourseworkHandler: PublishCourseworkHandler,
        updateCourseworkHandler: UpdateCourseworkHandler,
      ) => [
        createTurmaHandler,
        createMissingTeamHandler,
        createMissingCourseHandler,
        publishCourseworkHandler,
        updateCourseworkHandler,
      ],
      inject: [
        CreateTurmaEspelhadaHandler,
        CreateMissingMicrosoftTeamHandler,
        CreateMissingGoogleCourseHandler,
        PublishCourseworkHandler,
        UpdateCourseworkHandler,
      ],
    },
  ],
  exports: [SyncWorkerService],
})
export class WorkersModule implements OnModuleInit {
  private polling = false;

  constructor(
    private readonly syncWorkerService: SyncWorkerService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get<string>('WORKERS_ENABLED') !== 'true') {
      return;
    }
    this.polling = true;
    void this.pollLoop();
  }

  private async pollLoop(): Promise<void> {
    while (this.polling) {
      try {
        const processed =
          await this.syncWorkerService.processOnce('worker-inline');
        if (!processed) {
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
      }
    }
  }
}
