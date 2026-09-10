import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TenantModule } from '../tenant/tenant.module';
import { ProfessorModule } from '../professor/professor.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleStrategy } from './strategies/google.strategy';
import { MicrosoftStrategy } from './strategies/microsoft.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleTokenRefresher } from './token-refresh/google-token-refresher';
import { MicrosoftTokenRefresher } from './token-refresh/microsoft-token-refresher';
import { OAUTH_TOKEN_REFRESHERS } from './token-refresh/oauth-token-refresher';
import { TokenRefreshService } from './token-refresh/token-refresh.service';

@Module({
  imports: [
    PassportModule,
    TenantModule,
    ProfessorModule,
    NotificationsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '8h' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    GoogleStrategy,
    MicrosoftStrategy,
    JwtStrategy,
    GoogleTokenRefresher,
    MicrosoftTokenRefresher,
    TokenRefreshService,
    {
      provide: OAUTH_TOKEN_REFRESHERS,
      useFactory: (
        google: GoogleTokenRefresher,
        microsoft: MicrosoftTokenRefresher,
      ) => [google, microsoft],
      inject: [GoogleTokenRefresher, MicrosoftTokenRefresher],
    },
  ],
  exports: [TokenRefreshService],
})
export class AuthModule {}
