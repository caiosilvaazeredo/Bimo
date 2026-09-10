import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ExternalProvider } from '../../professor/external-provider.enum';
import { OAuthTokenRefresher, RefreshedTokens } from './oauth-token-refresher';

@Injectable()
export class MicrosoftTokenRefresher implements OAuthTokenRefresher {
  readonly provider = ExternalProvider.MICROSOFT;

  constructor(private readonly config: ConfigService) {}

  async refresh(refreshToken: string): Promise<RefreshedTokens> {
    const response = await fetch(
      'https://login.microsoftonline.com/organizations/oauth2/v2.0/token',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: this.config.get<string>('MICROSOFT_CLIENT_ID') ?? '',
          client_secret:
            this.config.get<string>('MICROSOFT_CLIENT_SECRET') ?? '',
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      },
    );

    if (!response.ok) {
      throw new Error(
        `Falha ao renovar token Microsoft: HTTP ${response.status}`,
      );
    }

    const body = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? null,
      expiresAt: body.expires_in
        ? new Date(Date.now() + body.expires_in * 1000)
        : null,
    };
  }
}
