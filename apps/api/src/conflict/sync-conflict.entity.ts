import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * Conflito de sincronização (RF-SYNC-03): o mesmo recurso foi alterado
 * nos dois lados antes de sincronizar. As duas versões ficam registradas
 * aqui para o professor escolher manualmente — o Bimo nunca sobrescreve
 * uma sem indicação clara.
 */
@Entity('sync_conflict')
export class SyncConflict {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  /** Ex: "TURMA_ESPELHADA", "COURSEWORK" (quando esse recurso existir). */
  @Column({ name: 'resource_type' })
  resourceType: string;

  @Column({ name: 'resource_id' })
  resourceId: string;

  @Column({ name: 'field_name' })
  fieldName: string;

  @Column({ name: 'google_value', type: 'text', nullable: true })
  googleValue: string | null;

  @Column({ name: 'google_updated_at', type: 'timestamp', nullable: true })
  googleUpdatedAt: Date | null;

  @Column({ name: 'microsoft_value', type: 'text', nullable: true })
  microsoftValue: string | null;

  @Column({ name: 'microsoft_updated_at', type: 'timestamp', nullable: true })
  microsoftUpdatedAt: Date | null;

  @Column({ default: false })
  resolved: boolean;

  @Column({ name: 'resolved_value', type: 'text', nullable: true })
  resolvedValue: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
