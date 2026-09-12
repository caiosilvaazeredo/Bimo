import { Module } from '@nestjs/common';
import { ProfessorModule } from '../professor/professor.module';
import { AlunoModule } from '../aluno/aluno.module';
import { SyncEventLogModule } from '../sync-event-log/sync-event-log.module';
import { TenantModule } from '../tenant/tenant.module';
import { DataSubjectRequestsService } from './data-subject-requests.service';
import { DataSubjectRequestsController } from './data-subject-requests.controller';
import { ConsentTextsService } from './consent-texts.service';
import { ConsentTextController } from './consent-text.controller';

@Module({
  imports: [ProfessorModule, AlunoModule, SyncEventLogModule, TenantModule],
  controllers: [DataSubjectRequestsController, ConsentTextController],
  providers: [DataSubjectRequestsService, ConsentTextsService],
  exports: [ConsentTextsService],
})
export class PrivacyModule {}
