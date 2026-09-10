import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TenantContext } from '../tenant/tenant-context';
import { TenantsService } from '../tenant/tenants.service';
import { ProfessorsService } from '../professor/professors.service';
import { ExternalAccountsService } from '../professor/external-accounts.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { BimoJwtPayload } from './bimo-jwt-payload';
import { OAuthProfile } from './strategies/oauth-profile';

export interface OAuthLoginResult {
  accessToken: string;
  professorId: string;
  tenantId: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly professorsService: ProfessorsService,
    private readonly externalAccountsService: ExternalAccountsService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Completa o login OAuth (Google ou Microsoft): resolve o tenant pelo
   * slug carregado no `state`, reconcilia/cria o Professor pelo e-mail
   * institucional e vincula a conta externa (RF-AUTH-01/02/03).
   */
  async completeOAuthLogin(
    profile: OAuthProfile,
    provider: ExternalProvider,
  ): Promise<OAuthLoginResult> {
    const tenant = await this.tenantsService.findActiveBySlug(
      profile.tenantSlug,
    );

    return TenantContext.run({ tenantId: tenant.id }, async () => {
      const professor =
        await this.professorsService.findOrCreateByInstitutionalEmail({
          institutionalEmail: profile.email,
          displayName: profile.displayName,
        });

      await this.externalAccountsService.link({
        professorId: professor.id,
        provider,
        externalAccountEmail: profile.email,
        accessToken: profile.accessToken,
        refreshToken: profile.refreshToken,
        scopes: profile.scopes,
        expiresAt: profile.expiresAt,
      });

      const payload: BimoJwtPayload = {
        sub: professor.id,
        tenantId: tenant.id,
        role: professor.role,
      };

      return {
        accessToken: this.jwtService.sign(payload),
        professorId: professor.id,
        tenantId: tenant.id,
      };
    });
  }

  async unlinkAccount(
    professorId: string,
    provider: ExternalProvider,
  ): Promise<void> {
    await this.externalAccountsService.unlink(professorId, provider);
  }
}
