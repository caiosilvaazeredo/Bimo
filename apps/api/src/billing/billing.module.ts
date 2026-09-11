import { Module } from '@nestjs/common';
import { TurmaEspelhadaModule } from '../turma-espelhada/turma-espelhada.module';
import { ProfessorModule } from '../professor/professor.module';
import { AlunoModule } from '../aluno/aluno.module';
import { CourseworkModule } from '../coursework/coursework.module';
import { BillingService } from './billing.service';
import { ReportsService } from './reports.service';
import { BillingController } from './billing.controller';

@Module({
  imports: [
    TurmaEspelhadaModule,
    ProfessorModule,
    AlunoModule,
    CourseworkModule,
  ],
  controllers: [BillingController],
  providers: [BillingService, ReportsService],
})
export class BillingModule {}
