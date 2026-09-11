import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SyncStatus } from '../turma-espelhada/sync-status.enum';
import { SubmissionStatus } from './submission-status.enum';

/**
 * Entidade-ponte entre submissão/nota do Classroom e do Teams, vinculada
 * a Tarefa e Aluno (RF-SYNC-04). O Bimo é a fonte única dentro dele
 * mesmo; a propagação para Classroom/Graph é best-effort, condicionada
 * a existir o id do aluno naquele provedor (capturado no roster —
 * ver Matricula.googleUserId/microsoftUserId).
 */
@Entity('nota')
@Index(['tenantId', 'tarefaId', 'alunoId'], { unique: true })
export class Nota {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'tarefa_id' })
  tarefaId: string;

  @Column({ name: 'aluno_id' })
  alunoId: string;

  @Column({ type: 'float', nullable: true })
  grade: number | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @Column({
    type: 'varchar',
    enum: SubmissionStatus,
    default: SubmissionStatus.MISSING,
  })
  status: SubmissionStatus;

  @Column({ type: 'varchar', enum: SyncStatus, default: SyncStatus.SYNCING })
  syncStatus: SyncStatus;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
