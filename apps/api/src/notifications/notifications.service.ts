import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { ExternalProvider } from '../professor/external-provider.enum';
import { Notification, NotificationKind } from './notification.entity';

/**
 * Notificações em painel (persistidas) + log estruturado fazendo às vezes
 * de e-mail por ora (RF-NOTIF-01/02/03). Trocar o lado do e-mail por um
 * provedor real é um detalhe de infraestrutura que não deve exigir mudar
 * quem chama este serviço.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly repository: Repository<Notification>,
  ) {}

  async notifyReauthRequired(
    professorId: string,
    provider: ExternalProvider,
  ): Promise<void> {
    this.logger.warn(
      `[e-mail] Reautenticação necessária: professor=${professorId} provider=${provider}. ` +
        'Sincronização suspensa até o professor logar novamente (RF-AUTH-04).',
    );
    await this.create(
      professorId,
      NotificationKind.REAUTH_REQUIRED,
      `Reautentique sua conta ${provider} para retomar a sincronização.`,
    );
  }

  async notifyConflict(
    professorId: string,
    turmaEspelhadaId: string,
  ): Promise<void> {
    this.logger.warn(
      `[e-mail] Conflito de sincronização na turma ${turmaEspelhadaId} (RF-NOTIF-01).`,
    );
    await this.create(
      professorId,
      NotificationKind.SYNC_CONFLICT,
      `A turma ${turmaEspelhadaId} tem um conflito de sincronização aguardando sua decisão.`,
    );
  }

  async notifyAdminRecurringFailure(
    adminId: string,
    message: string,
  ): Promise<void> {
    this.logger.warn(
      `[e-mail] Falha recorrente de sincronização: ${message} (RF-NOTIF-03).`,
    );
    await this.create(
      adminId,
      NotificationKind.ADMIN_RECURRING_FAILURE,
      message,
    );
  }

  /** RF-DASH-06: resumo periódico das turmas do professor. */
  async notifyPeriodicSummary(
    professorId: string,
    message: string,
  ): Promise<void> {
    this.logger.warn(`[e-mail] Resumo periódico (RF-DASH-06): ${message}`);
    await this.create(professorId, NotificationKind.PERIODIC_SUMMARY, message);
  }

  async listForRecipient(recipientId: string): Promise<Notification[]> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.find({
      where: { tenantId, recipientId },
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  async markRead(id: string): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.repository.update({ id, tenantId }, { read: true });
  }

  private async create(
    recipientId: string,
    kind: NotificationKind,
    message: string,
  ): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.repository.save(
      this.repository.create({
        tenantId,
        recipientId,
        kind,
        message,
        read: false,
      }),
    );
  }
}
