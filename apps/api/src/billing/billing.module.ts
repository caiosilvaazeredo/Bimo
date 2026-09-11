import { Module } from '@nestjs/common';
import { TurmaEspelhadaModule } from '../turma-espelhada/turma-espelhada.module';
import { ProfessorModule } from '../professor/professor.module';
import { AlunoModule } from '../aluno/aluno.module';
import { CourseworkModule } from '../coursework/coursework.module';
import { TenantModule } from '../tenant/tenant.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { BillingService } from './billing.service';
import { ReportsService } from './reports.service';
import { PeriodicSummaryService } from './periodic-summary.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [
    TurmaEspelhadaModule,
    ProfessorModule,
    AlunoModule,
    CourseworkModule,
    TenantModule,
    NotificationsModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, ReportsService, PeriodicSummaryService],
  exports: [PeriodicSummaryService],
})
export class BillingModule {}
