import { NotFoundException } from '@nestjs/common';
import { ExternalProvider } from '../../professor/external-provider.enum';
import { TokenRefreshService } from './token-refresh.service';
import { OAuthTokenRefresher } from './oauth-token-refresher';

describe('TokenRefreshService', () => {
  const account = {
    id: 'acc-1',
    professorId: 'prof-1',
    provider: ExternalProvider.GOOGLE,
    refreshTokenEncrypted: 'encrypted-refresh',
  };

  const externalAccountsService = {
    findById: jest.fn(),
    getDecryptedRefreshToken: jest.fn().mockReturnValue('plain-refresh-token'),
    updateTokensAfterRefresh: jest.fn().mockResolvedValue(undefined),
    markNeedsReauth: jest.fn().mockResolvedValue(undefined),
  };
  const notificationsService = { notifyReauthRequired: jest.fn() };

  const googleRefresher: OAuthTokenRefresher = {
    provider: ExternalProvider.GOOGLE,
    refresh: jest.fn(),
  };

  let service: TokenRefreshService;

  beforeEach(() => {
    jest.clearAllMocks();
    externalAccountsService.findById.mockResolvedValue(account);
    externalAccountsService.getDecryptedRefreshToken.mockReturnValue(
      'plain-refresh-token',
    );

    service = new TokenRefreshService(
      [googleRefresher],
      externalAccountsService as any,
      notificationsService as any,
    );
  });

  it('renova o token com sucesso e atualiza a conta', async () => {
    (googleRefresher.refresh as jest.Mock).mockResolvedValue({
      accessToken: 'novo-access',
      refreshToken: 'novo-refresh',
      expiresAt: null,
    });

    await service.refreshAccount('tenant-1', 'acc-1');

    expect(googleRefresher.refresh).toHaveBeenCalledWith('plain-refresh-token');
    expect(
      externalAccountsService.updateTokensAfterRefresh,
    ).toHaveBeenCalledWith(
      'acc-1',
      expect.objectContaining({ accessToken: 'novo-access' }),
    );
    expect(externalAccountsService.markNeedsReauth).not.toHaveBeenCalled();
  });

  it('marca needsReauth e notifica o professor quando o refresh falha (RF-AUTH-04)', async () => {
    (googleRefresher.refresh as jest.Mock).mockRejectedValue(
      new Error('refresh_token revogado'),
    );

    await service.refreshAccount('tenant-1', 'acc-1');

    expect(externalAccountsService.markNeedsReauth).toHaveBeenCalledWith(
      'acc-1',
    );
    expect(notificationsService.notifyReauthRequired).toHaveBeenCalledWith(
      'prof-1',
      ExternalProvider.GOOGLE,
    );
    expect(
      externalAccountsService.updateTokensAfterRefresh,
    ).not.toHaveBeenCalled();
  });

  it('marca needsReauth quando não há refresh token armazenado', async () => {
    externalAccountsService.getDecryptedRefreshToken.mockReturnValue(null);

    await service.refreshAccount('tenant-1', 'acc-1');

    expect(externalAccountsService.markNeedsReauth).toHaveBeenCalledWith(
      'acc-1',
    );
    expect(notificationsService.notifyReauthRequired).toHaveBeenCalled();
  });

  it('lança NotFoundException quando a conta não existe', async () => {
    externalAccountsService.findById.mockResolvedValue(null);

    await expect(
      service.refreshAccount('tenant-1', 'acc-inexistente'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
