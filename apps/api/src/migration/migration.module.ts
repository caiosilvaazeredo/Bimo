import { Module } from '@nestjs/common';
import { ProfessorModule } from '../professor/professor.module';
import { TurmaEspelhadaModule } from '../turma-espelhada/turma-espelhada.module';
import { SyncQueueModule } from '../sync-queue/sync-queue.module';
import { GoogleClassroomModule } from '../integrations/google/google-classroom.module';
import { MicrosoftTeamsModule } from '../integrations/microsoft/microsoft-teams.module';
import { AlunoModule } from '../aluno/aluno.module';
import { MigrationService } from './migration.service';
import { MigrationController } from './migration.controller';
import {
  CreateMissingGoogleCourseHandler,
  CreateMissingMicrosoftTeamHandler,
} from './create-missing-side.handlers';

@Module({
  imports: [
    ProfessorModule,
    TurmaEspelhadaModule,
    SyncQueueModule,
    GoogleClassroomModule,
    MicrosoftTeamsModule,
    AlunoModule,
  ],
  controllers: [MigrationController],
  providers: [
    MigrationService,
    CreateMissingMicrosoftTeamHandler,
    CreateMissingGoogleCourseHandler,
  ],
  exports: [
    CreateMissingMicrosoftTeamHandler,
    CreateMissingGoogleCourseHandler,
  ],
})
export class MigrationModule {}
