import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfessorModule } from '../professor/professor.module';
import { SyncQueueModule } from '../sync-queue/sync-queue.module';
import { GoogleClassroomModule } from '../integrations/google/google-classroom.module';
import { MicrosoftTeamsModule } from '../integrations/microsoft/microsoft-teams.module';
import { TurmaEspelhada } from './turma-espelhada.entity';
import { TurmaEspelhadaService } from './turma-espelhada.service';
import { CreateTurmaEspelhadaHandler } from './create-turma-espelhada.handler';
import { TurmaEspelhadaController } from './turma-espelhada.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([TurmaEspelhada]),
    ProfessorModule,
    SyncQueueModule,
    GoogleClassroomModule,
    MicrosoftTeamsModule,
  ],
  controllers: [TurmaEspelhadaController],
  providers: [TurmaEspelhadaService, CreateTurmaEspelhadaHandler],
  exports: [TurmaEspelhadaService, CreateTurmaEspelhadaHandler],
})
export class TurmaEspelhadaModule {}
