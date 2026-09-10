import { Injectable, Logger } from '@nestjs/common';
import { ExternalProvider } from '../professor/external-provider.enum';

/**
 * Placeholder até o módulo RF-NOTIF (Fase 4) existir de fato: por ora
 * só loga de forma estruturada (RNF-OBS-01). Trocar por envio real de
 * e-mail/painel quando RF-NOTIF-02 for implementado, sem mudar quem chama.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  notifyReauthRequired(professorId: string, provider: ExternalProvider): void {
    this.logger.warn(
      `Reautenticação necessária: professor=${professorId} provider=${provider}. ` +
        'Sincronização suspensa até o professor logar novamente (RF-AUTH-04).',
    );
  }
}
