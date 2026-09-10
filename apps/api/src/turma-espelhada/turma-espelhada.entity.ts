import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SyncStatus } from './sync-status.enum';

/**
 * Entidade-ponte entre um Course do Classroom e um Team do Teams
 * (RF-DASH-01, RF-INT-01/02). Os ids externos ficam nulos até o worker
 * de sincronização terminar de criar os dois lados.
 */
@Entity('turma_espelhada')
export class TurmaEspelhada {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'professor_id' })
  professorId: string;

  @Column()
  name: string;

  @Column({ name: 'academic_period', nullable: true })
  academicPeriod: string | null;

  @Column({ name: 'google_course_id', nullable: true })
  googleCourseId: string | null;

  @Column({ name: 'microsoft_team_id', nullable: true })
  microsoftTeamId: string | null;

  @Column({ type: 'varchar', enum: SyncStatus, default: SyncStatus.SYNCING })
  syncStatus: SyncStatus;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
