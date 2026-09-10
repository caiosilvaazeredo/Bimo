import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ExternalProvider } from './external-provider.enum';
import { Professor } from './professor.entity';

/**
 * Credencial OAuth de um Professor com um provedor externo (Google ou
 * Microsoft). Tokens nunca são guardados em texto plano — sempre
 * cifrados via TokenEncryptionService antes de chegar aqui (RNF-SEC-01).
 */
@Entity('external_account')
@Index(['tenantId', 'professorId', 'provider'], { unique: true })
export class ExternalAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  @Column({ name: 'professor_id' })
  professorId: string;

  @ManyToOne(() => Professor, (professor) => professor.externalAccounts, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'professor_id' })
  professor: Professor;

  @Column({ type: 'varchar', enum: ExternalProvider })
  provider: ExternalProvider;

  @Column({ name: 'external_account_email' })
  externalAccountEmail: string;

  @Column({ name: 'access_token_encrypted', type: 'text' })
  accessTokenEncrypted: string;

  @Column({ name: 'refresh_token_encrypted', type: 'text', nullable: true })
  refreshTokenEncrypted: string | null;

  @Column({ type: 'simple-array', default: '' })
  scopes: string[];

  @Column({ name: 'expires_at', type: 'timestamp', nullable: true })
  expiresAt: Date | null;

  /** true quando o refresh falhou e o professor precisa reautenticar (RF-AUTH-04). */
  @Column({ name: 'needs_reauth', default: false })
  needsReauth: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
