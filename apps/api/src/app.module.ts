import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TenantModule } from './tenant/tenant.module';
import { TenantMiddleware } from './tenant/tenant.middleware';
import { Tenant } from './tenant/tenant.entity';
import { CryptoModule } from './crypto/crypto.module';
import { ProfessorModule } from './professor/professor.module';
import { Professor } from './professor/professor.entity';
import { ExternalAccount } from './professor/external-account.entity';
import { AuthModule } from './auth/auth.module';
import { SyncQueueModule } from './sync-queue/sync-queue.module';
import { SyncJob } from './sync-queue/sync-job.entity';
import { SyncEventLogModule } from './sync-event-log/sync-event-log.module';
import { SyncEventLog } from './sync-event-log/sync-event-log.entity';
import { TurmaEspelhadaModule } from './turma-espelhada/turma-espelhada.module';
import { TurmaEspelhada } from './turma-espelhada/turma-espelhada.entity';
import { WorkersModule } from './workers/workers.module';
import { ConflictModule } from './conflict/conflict.module';
import { SyncConflict } from './conflict/sync-conflict.entity';
import { NotificationsModule } from './notifications/notifications.module';
import { Notification } from './notifications/notification.entity';
import { AlunoModule } from './aluno/aluno.module';
import { Aluno } from './aluno/aluno.entity';
import { Matricula } from './aluno/matricula.entity';
import { EntregaContingencia } from './aluno/entrega-contingencia.entity';
import { PortalModule } from './portal/portal.module';
import { MigrationModule } from './migration/migration.module';
import { AdminModule } from './admin/admin.module';
import { BillingModule } from './billing/billing.module';
import { PrivacyModule } from './privacy/privacy.module';
import { CourseworkModule } from './coursework/coursework.module';
import { Tarefa } from './coursework/tarefa.entity';
import { Nota } from './coursework/nota.entity';

const JWT_SCOPED_ROUTES = [
  'turmas-espelhadas',
  'turmas-espelhadas/(.*)',
  'tarefas',
  'tarefas/(.*)',
  'conflicts',
  'conflicts/(.*)',
  'notifications',
  'notifications/(.*)',
  'portal',
  'portal/(.*)',
  'migrations',
  'migrations/(.*)',
  'admin/turmas',
  'admin/professores',
  'admin/professores/(.*)',
  'admin/tenant/(.*)',
  'admin/billing/(.*)',
  'admin/reports/(.*)',
  'me',
  'me/(.*)',
];

/** Não resolve tenant nenhum: cria um tenant novo (RF-ADMIN-01). */
const NO_TENANT_ROUTES = ['admin/tenants'];

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'oracle',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 1521),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        serviceName: config.get<string>('DB_SERVICE_NAME'),
        entities: [
          Tenant,
          Professor,
          ExternalAccount,
          SyncJob,
          SyncEventLog,
          TurmaEspelhada,
          SyncConflict,
          Notification,
          Aluno,
          Matricula,
          EntregaContingencia,
          Tarefa,
          Nota,
        ],
        synchronize: false,
        autoLoadEntities: true,
      }),
    }),
    ScheduleModule.forRoot(),
    CryptoModule,
    TenantModule,
    ProfessorModule,
    AuthModule,
    SyncQueueModule,
    SyncEventLogModule,
    TurmaEspelhadaModule,
    ConflictModule,
    NotificationsModule,
    AlunoModule,
    PortalModule,
    MigrationModule,
    AdminModule,
    BillingModule,
    PrivacyModule,
    CourseworkModule,
    WorkersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Rotas /auth/* resolvem o tenant pelo state do OAuth (ver auth/oauth-state.ts).
    // Rotas autenticadas por JWT resolvem o tenant a partir do próprio token
    // (ver *.controller.ts), não do header x-tenant-slug — por isso ambas
    // ficam fora do middleware global.
    consumer
      .apply(TenantMiddleware)
      .exclude('health', 'auth/(.*)', ...JWT_SCOPED_ROUTES, ...NO_TENANT_ROUTES)
      .forRoutes('*');
  }
}
