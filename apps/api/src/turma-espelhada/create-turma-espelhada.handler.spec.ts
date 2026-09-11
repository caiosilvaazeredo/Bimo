import { CreateTurmaEspelhadaHandler } from './create-turma-espelhada.handler';
import { ExternalProvider } from '../professor/external-provider.enum';

describe('CreateTurmaEspelhadaHandler', () => {
  const turma = { id: 'turma-1', name: 'Turma A', academicPeriod: '2026.2' };
  const googleAccount = { id: 'acc-g', provider: ExternalProvider.GOOGLE };
  const microsoftAccount = {
    id: 'acc-m',
    provider: ExternalProvider.MICROSOFT,
  };

  const turmaEspelhadaService = {
    findById: jest.fn().mockResolvedValue(turma),
    markSynced: jest.fn().mockResolvedValue(undefined),
    markError: jest.fn().mockResolvedValue(undefined),
  };
  const externalAccountsService = {
    findByProfessorAndProvider: jest.fn(),
    getDecryptedAccessToken: jest.fn().mockReturnValue('decrypted-token'),
  };
  const googleClassroomClient = { createCourse: jest.fn() };
  const microsoftTeamsClient = { createTeam: jest.fn() };

  let handler: CreateTurmaEspelhadaHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    turmaEspelhadaService.findById.mockResolvedValue(turma);
    externalAccountsService.getDecryptedAccessToken.mockReturnValue(
      'decrypted-token',
    );
    externalAccountsService.findByProfessorAndProvider.mockImplementation(
      async (_id: string, provider: ExternalProvider) =>
        provider === ExternalProvider.GOOGLE ? googleAccount : microsoftAccount,
    );

    handler = new CreateTurmaEspelhadaHandler(
      turmaEspelhadaService as any,
      externalAccountsService as any,
      googleClassroomClient as any,
      microsoftTeamsClient as any,
    );
  });

  it('cria o course e o team e marca a turma como sincronizada', async () => {
    googleClassroomClient.createCourse.mockResolvedValue({
      externalId: 'course-1',
      name: 'Turma A',
      alternateLink: null,
    });
    microsoftTeamsClient.createTeam.mockResolvedValue({
      externalId: 'team-1',
      name: 'Turma A',
      webUrl: 'https://teams.microsoft.com/l/team/team-1',
    });

    await handler.handle({
      turmaEspelhadaId: 'turma-1',
      professorId: 'prof-1',
    });

    expect(googleClassroomClient.createCourse).toHaveBeenCalledWith(
      'decrypted-token',
      {
        name: 'Turma A',
        section: '2026.2',
      },
    );
    expect(microsoftTeamsClient.createTeam).toHaveBeenCalledWith(
      'decrypted-token',
      { name: 'Turma A' },
    );
    expect(turmaEspelhadaService.markSynced).toHaveBeenCalledWith('turma-1', {
      googleCourseId: 'course-1',
      microsoftTeamId: 'team-1',
      googleCourseUrl: null,
      microsoftTeamUrl: 'https://teams.microsoft.com/l/team/team-1',
    });
    expect(turmaEspelhadaService.markError).not.toHaveBeenCalled();
  });

  it('marca erro e relança quando falta uma conta externa', async () => {
    externalAccountsService.findByProfessorAndProvider.mockResolvedValue(null);

    await expect(
      handler.handle({ turmaEspelhadaId: 'turma-1', professorId: 'prof-1' }),
    ).rejects.toThrow(/duas contas externas/);
    expect(turmaEspelhadaService.markError).toHaveBeenCalledWith(
      'turma-1',
      expect.stringContaining('duas contas'),
    );
  });

  it('marca erro e relança quando a API externa falha', async () => {
    googleClassroomClient.createCourse.mockRejectedValue(new Error('HTTP 429'));

    await expect(
      handler.handle({ turmaEspelhadaId: 'turma-1', professorId: 'prof-1' }),
    ).rejects.toThrow('HTTP 429');
    expect(turmaEspelhadaService.markError).toHaveBeenCalledWith(
      'turma-1',
      'HTTP 429',
    );
    expect(turmaEspelhadaService.markSynced).not.toHaveBeenCalled();
  });
});
