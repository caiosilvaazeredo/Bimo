import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Log de auditoria de toda operação de sincronização (RF-SYNC-05, RNF-OBS-01). */
@Entity('sync_event_log')
export class SyncEventLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'job_type' })
  jobType: string;

  @Column({ name: 'resource_id', nullable: true })
  resourceId: string | null;

  @Column()
  result: 'SUCCESS' | 'FAILURE';

  @Column({ type: 'text', nullable: true })
  detail: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
