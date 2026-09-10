import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncJob } from './sync-job.entity';
import { SyncQueueService } from './sync-queue.service';

@Module({
  imports: [TypeOrmModule.forFeature([SyncJob])],
  providers: [SyncQueueService],
  exports: [SyncQueueService],
})
export class SyncQueueModule {}
