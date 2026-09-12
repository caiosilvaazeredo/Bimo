import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('tenant')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ default: true })
  active: boolean;

  /** RF-STU-06: a instituição pode desligar o acesso de contingência do aluno. */
  @Column({ name: 'contingency_enabled', default: true })
  contingencyEnabled: boolean;

  /** RNF-PRIV-02: qual texto de consentimento (LGPD/GDPR/genérico) mostrar aos usuários deste tenant. */
  @Column({ name: 'consent_region', default: 'BR-LGPD' })
  consentRegion: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
