import { JwtService } from '@nestjs/jwt';
import { AlunoAuthService } from './aluno-auth.service';
import { OAuthProfile } from './strategies/oauth-profile';

describe('AlunoAuthService', () => {
  const tenant = {
    id: 'tenant-uuid-1',
    slug: 'escola-exemplo',
    active: true,
    allowedEmailDomains: [] as string[],
  };
  const aluno = {
    id: 'aluno-uuid-1',
    institutionalEmail: 'aluno@escola.edu.br',
  };

  const tenantsService = {
    findActiveBySlug: jest.fn().mockResolvedValue(tenant),
  };
  const alunosService = {
    findOrCreateByInstitutionalEmail: jest.fn().mockResolvedValue(aluno),
  };
  const jwtService = {
    sign: jest.fn().mockReturnValue('signed.jwt.token'),
  } as unknown as JwtService;

  let service: AlunoAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantsService.findActiveBySlug.mockResolvedValue(tenant);
    alunosService.findOrCreateByInstitutionalEmail.mockResolvedValue(aluno);
    (jwtService.sign as jest.Mock).mockReturnValue('signed.jwt.token');

    service = new AlunoAuthService(
      tenantsService as any,
      alunosService as any,
      jwtService,
    );
  });

  const oauthProfile: OAuthProfile = {
    tenantSlug: 'escola-exemplo',
    role: 'ALUNO',
    email: 'aluno@escola.edu.br',
    displayName: 'Aluno Exemplo',
    accessToken: 'access-token',
    refreshToken: null,
    scopes: [],
    expiresAt: null,
  };

  it('resolve o tenant, reconcilia o aluno pelo e-mail e assina o JWT (RF-STU-01)', async () => {
    const result = await service.completeOAuthLogin(oauthProfile);

    expect(tenantsService.findActiveBySlug).toHaveBeenCalledWith(
      'escola-exemplo',
    );
    expect(alunosService.findOrCreateByInstitutionalEmail).toHaveBeenCalledWith(
      {
        institutionalEmail: aluno.institutionalEmail,
        displayName: 'Aluno Exemplo',
      },
    );
    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      alunoId: aluno.id,
      tenantId: tenant.id,
    });
  });

  it('rejeita o login quando o e-mail não bate com o domínio permitido do tenant (RF-AUTH-03)', async () => {
    tenantsService.findActiveBySlug.mockResolvedValue({
      ...tenant,
      allowedEmailDomains: ['uva.br'],
    });

    await expect(
      service.completeOAuthLogin({ ...oauthProfile, email: 'aluno@gmail.com' }),
    ).rejects.toThrow(/não está autorizado/);
    expect(
      alunosService.findOrCreateByInstitutionalEmail,
    ).not.toHaveBeenCalled();
  });
});
