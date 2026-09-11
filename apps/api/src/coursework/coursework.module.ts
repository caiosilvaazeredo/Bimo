import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfessorModule } from '../professor/professor.module';
import { TurmaEspelhadaModule } from '../turma-espelhada/turma-espelhada.module';
import { SyncQueueModule } from '../sync-queue/sync-queue.module';
import { GoogleClassroomModule } from '../integrations/google/google-classroom.module';
import { MicrosoftTeamsModule } from '../integrations/microsoft/microsoft-teams.module';
import { Tarefa } from './tarefa.entity';
import { TarefaService } from './tarefa.service';
import { TarefaController } from './tarefa.controller';
import { PublishCourseworkHandler } from './publish-coursework.handler';
import { UpdateCourseworkHandler } from './update-coursework.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tarefa]),
    ProfessorModule,
    TurmaEspelhadaModule,
    SyncQueueModule,
    GoogleClassroomModule,
    MicrosoftTeamsModule,
  ],
  controllers: [TarefaController],
  providers: [TarefaService, PublishCourseworkHandler, UpdateCourseworkHandler],
  exports: [TarefaService, PublishCourseworkHandler, UpdateCourseworkHandler],
})
export class CourseworkModule {}
