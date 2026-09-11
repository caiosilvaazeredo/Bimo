import { Module } from '@nestjs/common';
import { ProfessorModule } from '../professor/professor.module';
import { AlunoModule } from '../aluno/aluno.module';
import { SyncEventLogModule } from '../sync-event-log/sync-event-log.module';
import { DataSubjectRequestsService } from './data-subject-requests.service';
import { DataSubjectRequestsController } from './data-subject-requests.controller';

@Module({
  imports: [ProfessorModule, AlunoModule, SyncEventLogModule],
  controllers: [DataSubjectRequestsController],
  providers: [DataSubjectRequestsService],
})
export class PrivacyModule {}
