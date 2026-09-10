import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../tenant/tenant-context';
import { ExternalAccountsService } from '../../professor/external-accounts.service';
import { ExternalProvider } from '../../professor/external-provider.enum';
import { NotificationsService } from '../../notifications/notifications.service';
import {
  OAUTH_TOKEN_REFRESHERS,
  OAuthTokenRefresher,
} from './oauth-token-refresher';

/**
 * Renova o access token de uma conta externa usando o refresh token
 * guardado (RF-AUTH-04). Se o refresh falhar (ex: token revogado pelo
 * admin de TI), marca a conta como precisando reautenticação e notifica
 * o professor — a sincronização daquela turma deve considerar essa flag
 * antes de rodar (checagem feita pelo motor de sincronização na Fase 2).
 */
@Injectable()
export class TokenRefreshService {
  private readonly logger = new Logger(TokenRefreshService.name);
  private readonly refreshersByProvider: Map<
    ExternalProvider,
    OAuthTokenRefresher
  >;

  constructor(
    @Inject(OAUTH_TOKEN_REFRESHERS) refreshers: OAuthTokenRefresher[],
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.refreshersByProvider = new Map(
      refreshers.map((refresher) => [refresher.provider, refresher]),
    );
  }

  async refreshAccount(tenantId: string, accountId: string): Promise<void> {
    await TenantContext.run({ tenantId }, async () => {
      const account = await this.externalAccountsService.findById(accountId);
      if (!account) {
        throw new NotFoundException('Conta externa não encontrada');
      }

      const refreshToken =
        this.externalAccountsService.getDecryptedRefreshToken(account);
      const refresher = this.refreshersByProvider.get(account.provider);

      if (!refreshToken || !refresher) {
        await this.handleFailure(
          account.id,
          account.professorId,
          account.provider,
        );
        return;
      }

      try {
        const tokens = await refresher.refresh(refreshToken);
        await this.externalAccountsService.updateTokensAfterRefresh(
          account.id,
          tokens,
        );
      } catch (error) {
        this.logger.warn(
          `Falha ao renovar token (accountId=${account.id}): ${(error as Error).message}`,
        );
        await this.handleFailure(
          account.id,
          account.professorId,
          account.provider,
        );
      }
    });
  }

  private async handleFailure(
    accountId: string,
    professorId: string,
    provider: ExternalProvider,
  ): Promise<void> {
    await this.externalAccountsService.markNeedsReauth(accountId);
    this.notificationsService.notifyReauthRequired(professorId, provider);
  }
}
