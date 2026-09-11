import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProfessorModule } from '../professor/professor.module';
import { TurmaEspelhadaModule } from '../turma-espelhada/turma-espelhada.module';
import { SyncQueueModule } from '../sync-queue/sync-queue.module';
import { GoogleClassroomModule } from '../integrations/google/google-classroom.module';
import { MicrosoftTeamsModule } from '../integrations/microsoft/microsoft-teams.module';
import { AlunoModule } from '../aluno/aluno.module';
import { Tarefa } from './tarefa.entity';
import { Nota } from './nota.entity';
import { TarefaService } from './tarefa.service';
import { NotaService } from './nota.service';
import { TarefaController } from './tarefa.controller';
import { NotaController } from './nota.controller';
import { PublishCourseworkHandler } from './publish-coursework.handler';
import { UpdateCourseworkHandler } from './update-coursework.handler';
import { SyncGradeHandler } from './sync-grade.handler';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tarefa, Nota]),
    ProfessorModule,
    TurmaEspelhadaModule,
    SyncQueueModule,
    GoogleClassroomModule,
    MicrosoftTeamsModule,
    AlunoModule,
  ],
  controllers: [TarefaController, NotaController],
  providers: [
    TarefaService,
    NotaService,
    PublishCourseworkHandler,
    UpdateCourseworkHandler,
    SyncGradeHandler,
  ],
  exports: [
    TarefaService,
    NotaService,
    PublishCourseworkHandler,
    UpdateCourseworkHandler,
    SyncGradeHandler,
  ],
})
export class CourseworkModule {}
