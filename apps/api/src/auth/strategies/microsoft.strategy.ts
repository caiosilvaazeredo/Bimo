import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy as OAuth2Strategy } from 'passport-oauth2';
import { Request } from 'express';
import { decodeOAuthState } from '../oauth-state';
import { OAuthProfile } from './oauth-profile';

/**
 * Escopos mínimos via Microsoft Graph (RF-AUTH-02).
 * Endpoint "organizations" (em vez de "common") restringe o login a
 * contas de trabalho/escola, excluindo contas pessoais Microsoft.
 */
export const MICROSOFT_SCOPES = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'https://graph.microsoft.com/Team.ReadBasic.All',
  'https://graph.microsoft.com/EduRoster.ReadBasic',
  'https://graph.microsoft.com/EduAssignments.ReadWriteBasic',
  'https://graph.microsoft.com/Files.ReadWrite',
];

interface MicrosoftGraphProfile {
  mail?: string;
  userPrincipalName?: string;
  displayName?: string;
}

@Injectable()
export class MicrosoftStrategy extends PassportStrategy(
  OAuth2Strategy,
  'microsoft',
) {
  constructor(config: ConfigService) {
    super({
      authorizationURL:
        'https://login.microsoftonline.com/organizations/oauth2/v2.0/authorize',
      tokenURL:
        'https://login.microsoftonline.com/organizations/oauth2/v2.0/token',
      clientID: config.get<string>('MICROSOFT_CLIENT_ID') ?? 'unset',
      clientSecret: config.get<string>('MICROSOFT_CLIENT_SECRET') ?? 'unset',
      callbackURL:
        config.get<string>('MICROSOFT_CALLBACK_URL') ??
        'http://localhost:3000/auth/microsoft/callback',
      scope: MICROSOFT_SCOPES,
      state: true,
      passReqToCallback: true,
    });
  }

  /** passport-oauth2 não busca perfil por padrão; buscamos no Graph. */
  async userProfile(
    accessToken: string,
    done: (err: unknown, profile?: MicrosoftGraphProfile) => void,
  ) {
    try {
      const response = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        throw new Error(
          `Falha ao buscar perfil no Microsoft Graph: ${response.status}`,
        );
      }
      const profile = (await response.json()) as MicrosoftGraphProfile;
      done(null, profile);
    } catch (error) {
      done(error);
    }
  }

  validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: MicrosoftGraphProfile,
    done: (err: unknown, user?: OAuthProfile) => void,
  ) {
    try {
      const { tenantSlug, role } = decodeOAuthState(
        req.query.state as string | undefined,
      );
      const email = profile.mail ?? profile.userPrincipalName;
      if (!email) {
        return done(new Error('Perfil Microsoft sem e-mail disponível'));
      }

      const oauthProfile: OAuthProfile = {
        tenantSlug,
        role,
        email,
        displayName: profile.displayName ?? email,
        accessToken,
        refreshToken: refreshToken ?? null,
        scopes: MICROSOFT_SCOPES,
        expiresAt: null,
      };

      done(null, oauthProfile);
    } catch (error) {
      done(error);
    }
  }
}
