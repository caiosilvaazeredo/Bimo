import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** Reconciliado por e-mail institucional (RF-STU-01), 1 registro por tenant. */
@Entity('aluno')
export class Aluno {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'institutional_email' })
  institutionalEmail: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
