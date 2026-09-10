import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import {
  Strategy,
  StrategyOptionsWithRequest,
  VerifyCallback,
} from 'passport-google-oauth20';
import { Request } from 'express';
import { decodeOAuthState } from '../oauth-state';
import { OAuthProfile } from './oauth-profile';

/**
 * Escopos mínimos necessários (RF-AUTH-01): apenas o que o Bimo de fato usa
 * para espelhar turmas, tarefas, roster e materiais.
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/classroom.courses',
  'https://www.googleapis.com/auth/classroom.coursework.me',
  'https://www.googleapis.com/auth/classroom.rosters',
  'https://www.googleapis.com/auth/classroom.profile.emails',
];

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(config: ConfigService) {
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') ?? 'unset',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? 'unset',
      callbackURL:
        config.get<string>('GOOGLE_CALLBACK_URL') ??
        'http://localhost:3000/auth/google/callback',
      scope: GOOGLE_SCOPES,
      passReqToCallback: true,
    } as StrategyOptionsWithRequest);
  }

  validate(
    req: Request,
    accessToken: string,
    refreshToken: string,
    profile: { emails?: { value: string }[]; displayName?: string },
    done: VerifyCallback,
  ) {
    try {
      const { tenantSlug } = decodeOAuthState(
        req.query.state as string | undefined,
      );
      const email = profile.emails?.[0]?.value;
      if (!email) {
        return done(
          new Error('Perfil Google sem e-mail disponível'),
          undefined,
        );
      }

      const oauthProfile: OAuthProfile = {
        tenantSlug,
        email,
        displayName: profile.displayName ?? email,
        accessToken,
        refreshToken: refreshToken ?? null,
        scopes: GOOGLE_SCOPES,
        expiresAt: null,
      };

      done(null, oauthProfile);
    } catch (error) {
      done(error as Error, undefined);
    }
  }
}
