import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { TenantContext } from '../tenant/tenant-context';
import { TenantsService } from '../tenant/tenants.service';
import { AlunosService } from '../aluno/alunos.service';
import { AlunoJwtPayload } from './bimo-jwt-payload';
import { OAuthProfile } from './strategies/oauth-profile';

export interface AlunoOAuthLoginResult {
  accessToken: string;
  alunoId: string;
  tenantId: string;
}

/**
 * Login do aluno diretamente no portal Bimo (RF-STU-01), como acesso de
 * contingência quando uma das duas plataformas nativas está indisponível
 * para ele. Reusa o mesmo fluxo OAuth de Professor (RF-AUTH-01/02), mas
 * não guarda tokens do aluno — o portal só lê dados já espelhados pelo
 * Bimo, não chama Classroom/Graph em nome do aluno.
 */
@Injectable()
export class AlunoAuthService {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly alunosService: AlunosService,
    private readonly jwtService: JwtService,
  ) {}

  async completeOAuthLogin(
    profile: OAuthProfile,
  ): Promise<AlunoOAuthLoginResult> {
    const tenant = await this.tenantsService.findActiveBySlug(
      profile.tenantSlug,
    );

    return TenantContext.run({ tenantId: tenant.id }, async () => {
      const aluno = await this.alunosService.findOrCreateByInstitutionalEmail({
        institutionalEmail: profile.email,
        displayName: profile.displayName,
      });

      const payload: AlunoJwtPayload = {
        sub: aluno.id,
        tenantId: tenant.id,
        kind: 'ALUNO',
      };

      return {
        accessToken: this.jwtService.sign(payload),
        alunoId: aluno.id,
        tenantId: tenant.id,
      };
    });
  }
}
