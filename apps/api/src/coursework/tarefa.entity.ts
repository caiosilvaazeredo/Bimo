import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { SyncStatus } from '../turma-espelhada/sync-status.enum';

/**
 * Entidade-ponte entre CourseWork (Classroom) e Assignment (Teams/Graph)
 * — RF-SYNC-01/02. Materiais são sempre link, nunca cópia (RF-INT-04).
 */
@Entity('tarefa')
export class Tarefa {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'turma_espelhada_id' })
  turmaEspelhadaId: string;

  @Column()
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'due_date', type: 'timestamp', nullable: true })
  dueDate: Date | null;

  @Column({ type: 'int', nullable: true })
  points: number | null;

  /** RF-INT-04: referência por link, nunca cópia física do arquivo. */
  @Column({ name: 'material_links', type: 'simple-array', default: '' })
  materialLinks: string[];

  @Column({ name: 'google_course_work_id', nullable: true })
  googleCourseWorkId: string | null;

  @Column({ name: 'microsoft_assignment_id', nullable: true })
  microsoftAssignmentId: string | null;

  @Column({ type: 'varchar', enum: SyncStatus, default: SyncStatus.SYNCING })
  syncStatus: SyncStatus;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
