import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SyncJobStatus } from './sync-job-status.enum';

/**
 * Fila de sincronização baseada em tabela no próprio Oracle Database
 * (sem broker externo, para caber no orçamento de RAM do Free Tier -
 * RNF-ARCH-04). Garante reprocessamento at-least-once mesmo se um
 * worker cair no meio do processamento (RNF-AVAIL-03).
 */
@Entity('sync_job')
@Index(['status', 'nextAttemptAt'])
export class SyncJob {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  /** Ex: "CREATE_TURMA_ESPELHADA", "PUBLISH_COURSEWORK" (Fase 2+). */
  @Column({ name: 'job_type' })
  jobType: string;

  /** JSON serializado com os dados necessários para o worker processar o job. */
  @Column({ type: 'text' })
  payload: string;

  @Column({
    type: 'varchar',
    enum: SyncJobStatus,
    default: SyncJobStatus.PENDING,
  })
  status: SyncJobStatus;

  @Column({ name: 'attempt_count', default: 0 })
  attemptCount: number;

  @Column({ name: 'max_attempts', default: 5 })
  maxAttempts: number;

  @Column({ name: 'next_attempt_at', type: 'timestamp' })
  nextAttemptAt: Date;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'locked_by', nullable: true })
  lockedBy: string | null;

  @Column({ name: 'locked_at', type: 'timestamp', nullable: true })
  lockedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
