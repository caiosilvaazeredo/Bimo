import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { Tenant } from './tenant/tenant.entity';
import { Professor } from './professor/professor.entity';
import { ExternalAccount } from './professor/external-account.entity';
import { SyncJob } from './sync-queue/sync-job.entity';
import { SyncEventLog } from './sync-event-log/sync-event-log.entity';
import { TurmaEspelhada } from './turma-espelhada/turma-espelhada.entity';
import { SyncConflict } from './conflict/sync-conflict.entity';
import { Notification } from './notifications/notification.entity';
import { Aluno } from './aluno/aluno.entity';
import { Matricula } from './aluno/matricula.entity';
import { EntregaContingencia } from './aluno/entrega-contingencia.entity';
import { Tarefa } from './coursework/tarefa.entity';
import { Nota } from './coursework/nota.entity';

config();

/**
 * DataSource só para o CLI do TypeORM (migration:run/revert/generate) —
 * o NestJS em runtime usa TypeOrmModule.forRootAsync no app.module.ts, que
 * é uma configuração equivalente mas não pode ser reaproveitada diretamente
 * aqui porque o CLI roda fora do contexto de injeção de dependência do Nest.
 *
 * Mesma lógica de conexão via Wallet do app.module.ts: DB_CONNECT_STRING
 * (alias do tnsnames.ora) tem prioridade sobre host/port/serviceName.
 */
export const AppDataSource = new DataSource({
  type: 'oracle',
  ...(process.env.DB_CONNECT_STRING
    ? { connectString: process.env.DB_CONNECT_STRING }
    : {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 1521,
        serviceName: process.env.DB_SERVICE_NAME,
      }),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  extra: process.env.DB_WALLET_LOCATION
    ? {
        walletLocation: process.env.DB_WALLET_LOCATION,
        walletPassword: process.env.DB_WALLET_PASSWORD,
      }
    : undefined,
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
  migrations: [__dirname + '/migrations/*.{ts,js}'],
  synchronize: false,
});
