import { Module } from '@nestjs/common';
import { TenantModule } from '../tenant/tenant.module';
import { ProfessorModule } from '../professor/professor.module';
import { TurmaEspelhadaModule } from '../turma-espelhada/turma-espelhada.module';
import { SyncEventLogModule } from '../sync-event-log/sync-event-log.module';
import { PrivacyModule } from '../privacy/privacy.module';
import { TenantBootstrapController } from './tenant-bootstrap.controller';
import { AdminController } from './admin.controller';

@Module({
  imports: [
    TenantModule,
    ProfessorModule,
    TurmaEspelhadaModule,
    SyncEventLogModule,
    PrivacyModule,
  ],
  controllers: [TenantBootstrapController, AdminController],
})
export class AdminModule {}
