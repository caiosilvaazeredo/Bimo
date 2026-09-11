import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncConflict } from './sync-conflict.entity';
import { ConflictService } from './conflict.service';
import { ConflictController } from './conflict.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SyncConflict])],
  controllers: [ConflictController],
  providers: [ConflictService],
  exports: [ConflictService],
})
export class ConflictModule {}
