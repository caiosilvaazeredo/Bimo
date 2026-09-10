import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ProfessorRole } from './professor-role.enum';
import { ExternalAccount } from './external-account.entity';

/** Um perfil Bimo = um Professor; pode ter 0-2 contas externas vinculadas (RF-AUTH-03). */
@Entity('professor')
export class Professor {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'institutional_email' })
  institutionalEmail: string;

  @Column({ name: 'display_name' })
  displayName: string;

  @Column({
    type: 'varchar',
    enum: ProfessorRole,
    default: ProfessorRole.PROFESSOR,
  })
  role: ProfessorRole;

  @OneToMany(() => ExternalAccount, (account) => account.professor)
  externalAccounts: ExternalAccount[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
