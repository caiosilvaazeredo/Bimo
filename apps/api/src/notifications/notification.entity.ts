import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

export enum NotificationKind {
  REAUTH_REQUIRED = 'REAUTH_REQUIRED',
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  ADMIN_RECURRING_FAILURE = 'ADMIN_RECURRING_FAILURE',
  PERIODIC_SUMMARY = 'PERIODIC_SUMMARY',
}

/** Notificação em painel (RF-NOTIF-01/02/03); o e-mail é logado separadamente por ora. */
@Entity('notification')
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'tenant_id' })
  tenantId: string;

  /** Destinatário: id do Professor (ou, no futuro, de um Admin). */
  @Column({ name: 'recipient_id' })
  recipientId: string;

  @Column({ type: 'varchar', enum: NotificationKind })
  kind: NotificationKind;

  @Column()
  message: string;

  @Column({ default: false })
  read: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
