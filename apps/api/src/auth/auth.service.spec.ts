import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { ProfessorRole } from '../professor/professor-role.enum';
import { OAuthProfile } from './strategies/oauth-profile';

describe('AuthService', () => {
  const tenant = {
    id: 'tenant-uuid-1',
    slug: 'escola-exemplo',
    name: 'Escola Exemplo',
    active: true,
    allowedEmailDomains: [] as string[],
  };
  const professor = {
    id: 'prof-uuid-1',
    institutionalEmail: 'prof@escola.edu.br',
    displayName: 'Prof. Exemplo',
    role: ProfessorRole.PROFESSOR,
  };

  const tenantsService = {
    findActiveBySlug: jest.fn().mockResolvedValue(tenant),
  };
  const professorsService = {
    findOrCreateByInstitutionalEmail: jest.fn().mockResolvedValue(professor),
  };
  const externalAccountsService = {
    link: jest.fn().mockResolvedValue(undefined),
    unlink: jest.fn().mockResolvedValue(undefined),
  };
  const jwtService = {
    sign: jest.fn().mockReturnValue('signed.jwt.token'),
  } as unknown as JwtService;

  let authService: AuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    tenantsService.findActiveBySlug.mockResolvedValue(tenant);
    professorsService.findOrCreateByInstitutionalEmail.mockResolvedValue(
      professor,
    );
    (jwtService.sign as jest.Mock).mockReturnValue('signed.jwt.token');

    authService = new AuthService(
      tenantsService as any,
      professorsService as any,
      externalAccountsService as any,
      jwtService,
    );
  });

  const oauthProfile: OAuthProfile = {
    tenantSlug: 'escola-exemplo',
    role: 'PROFESSOR',
    email: 'prof@escola.edu.br',
    displayName: 'Prof. Exemplo',
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    scopes: ['classroom.courses'],
    expiresAt: null,
  };

  it('resolve o tenant pelo slug do state e vincula a conta ao professor certo', async () => {
    const result = await authService.completeOAuthLogin(
      oauthProfile,
      ExternalProvider.GOOGLE,
    );

    expect(tenantsService.findActiveBySlug).toHaveBeenCalledWith(
      'escola-exemplo',
    );
    expect(externalAccountsService.link).toHaveBeenCalledWith(
      expect.objectContaining({
        professorId: professor.id,
        provider: ExternalProvider.GOOGLE,
      }),
    );
    expect(result).toEqual({
      accessToken: 'signed.jwt.token',
      professorId: professor.id,
      tenantId: tenant.id,
    });
  });

  it('assina o JWT com o tenantId e o papel corretos', async () => {
    await authService.completeOAuthLogin(
      oauthProfile,
      ExternalProvider.MICROSOFT,
    );

    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: professor.id,
      tenantId: tenant.id,
      role: professor.role,
      kind: 'PROFESSOR',
    });
  });

  describe('restrição de domínio de e-mail (RF-AUTH-03)', () => {
    it('rejeita o login quando o tenant restringe domínios e o e-mail não bate com nenhum', async () => {
      tenantsService.findActiveBySlug.mockResolvedValue({
        ...tenant,
        allowedEmailDomains: ['uva.br', 'veigadealmeida.edu.br'],
      });

      await expect(
        authService.completeOAuthLogin(
          { ...oauthProfile, email: 'alguem@gmail.com' },
          ExternalProvider.MICROSOFT,
        ),
      ).rejects.toThrow(/não está autorizado/);

      expect(
        professorsService.findOrCreateByInstitutionalEmail,
      ).not.toHaveBeenCalled();
    });

    it('permite o login quando o e-mail bate com um dos domínios permitidos', async () => {
      tenantsService.findActiveBySlug.mockResolvedValue({
        ...tenant,
        allowedEmailDomains: ['uva.br', 'veigadealmeida.edu.br'],
      });

      await expect(
        authService.completeOAuthLogin(
          { ...oauthProfile, email: 'prof@uva.br' },
          ExternalProvider.MICROSOFT,
        ),
      ).resolves.toBeDefined();
    });
  });
});
