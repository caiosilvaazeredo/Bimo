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

  /**
   * RF-AUTH-03/RNF-SEC: domínios de e-mail institucional aceitos no login
   * (ex: ["uva.br", "veigadealmeida.edu.br"]). Lista vazia/null = sem
   * restrição (qualquer e-mail retornado pelo provedor OAuth é aceito).
   * Validado em AuthService.completeOAuthLogin antes de criar o Professor
   * — é a camada de defesa real, já que o app registration do Microsoft
   * Entra ID sozinho não restringe por domínio específico sem Conditional
   * Access (recurso pago).
   */
  @Column({ name: 'allowed_email_domains', type: 'simple-array', default: '' })
  allowedEmailDomains: string[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
