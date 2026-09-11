import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncEventLog } from './sync-event-log.entity';
import { SyncEventLogService } from './sync-event-log.service';

@Module({
  imports: [TypeOrmModule.forFeature([SyncEventLog])],
  providers: [SyncEventLogService],
  exports: [SyncEventLogService],
})
export class SyncEventLogModule {}
