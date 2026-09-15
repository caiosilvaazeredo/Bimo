import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantModule } from '../tenant/tenant.module';
import { TurmaEspelhadaModule } from '../turma-espelhada/turma-espelhada.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { Aluno } from './aluno.entity';
import { Matricula } from './matricula.entity';
import { EntregaContingencia } from './entrega-contingencia.entity';
import { AlunosService } from './alunos.service';
import { MatriculaService } from './matricula.service';
import { EntregaContingenciaService } from './entrega-contingencia.service';
import { ProfessorContingenciaController } from './professor-contingencia.controller';
import { MatriculaController } from './matricula.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Aluno, Matricula, EntregaContingencia]),
    TenantModule,
    TurmaEspelhadaModule,
    NotificationsModule,
  ],
  controllers: [ProfessorContingenciaController, MatriculaController],
  providers: [AlunosService, MatriculaService, EntregaContingenciaService],
  exports: [AlunosService, MatriculaService, EntregaContingenciaService],
})
export class AlunoModule {}
