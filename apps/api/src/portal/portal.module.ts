import { Module } from '@nestjs/common';
import { AlunoModule } from '../aluno/aluno.module';
import { TurmaEspelhadaModule } from '../turma-espelhada/turma-espelhada.module';
import { CourseworkModule } from '../coursework/coursework.module';
import { PortalController } from './portal.controller';

@Module({
  imports: [AlunoModule, TurmaEspelhadaModule, CourseworkModule],
  controllers: [PortalController],
})
export class PortalModule {}
