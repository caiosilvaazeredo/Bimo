import { PublishCourseworkHandler } from './publish-coursework.handler';
import { ExternalProvider } from '../professor/external-provider.enum';

describe('PublishCourseworkHandler', () => {
  const tarefa = {
    id: 'tarefa-1',
    turmaEspelhadaId: 'turma-1',
    title: 'Tarefa A',
    description: null,
    dueDate: null,
    points: 10,
    materialLinks: [],
  };
  const turma = { id: 'turma-1', googleCourseId: 'c1', microsoftTeamId: 't1' };
  const googleAccount = { provider: ExternalProvider.GOOGLE };
  const microsoftAccount = { provider: ExternalProvider.MICROSOFT };

  const tarefaService = {
    findById: jest.fn(),
    markSynced: jest.fn().mockResolvedValue(undefined),
    markError: jest.fn().mockResolvedValue(undefined),
  };
  const turmaEspelhadaService = { findById: jest.fn() };
  const externalAccountsService = {
    findByProfessorAndProvider: jest.fn(),
    getDecryptedAccessToken: jest.fn().mockReturnValue('token'),
  };
  const googleClassroomClient = { createCourseWork: jest.fn() };
  const microsoftTeamsClient = { createAssignment: jest.fn() };

  let handler: PublishCourseworkHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    tarefaService.findById.mockResolvedValue(tarefa);
    turmaEspelhadaService.findById.mockResolvedValue(turma);
    externalAccountsService.getDecryptedAccessToken.mockReturnValue('token');
    externalAccountsService.findByProfessorAndProvider.mockImplementation(
      async (_id: string, provider: ExternalProvider) =>
        provider === ExternalProvider.GOOGLE ? googleAccount : microsoftAccount,
    );

    handler = new PublishCourseworkHandler(
      tarefaService as any,
      turmaEspelhadaService as any,
      externalAccountsService as any,
      googleClassroomClient as any,
      microsoftTeamsClient as any,
    );
  });

  it('publica nos dois provedores e marca sincronizado', async () => {
    googleClassroomClient.createCourseWork.mockResolvedValue({
      externalId: 'cw1',
      alternateLink: null,
    });
    microsoftTeamsClient.createAssignment.mockResolvedValue({
      externalId: 'a1',
      webUrl: null,
    });

    await handler.handle({ tarefaId: 'tarefa-1', professorId: 'prof-1' });

    expect(googleClassroomClient.createCourseWork).toHaveBeenCalledWith(
      'token',
      'c1',
      expect.objectContaining({ title: 'Tarefa A' }),
    );
    expect(microsoftTeamsClient.createAssignment).toHaveBeenCalledWith(
      'token',
      't1',
      expect.objectContaining({ title: 'Tarefa A' }),
    );
    expect(tarefaService.markSynced).toHaveBeenCalledWith('tarefa-1', {
      googleCourseWorkId: 'cw1',
      microsoftAssignmentId: 'a1',
    });
  });

  it('marca erro e relança quando falta conta externa', async () => {
    externalAccountsService.findByProfessorAndProvider.mockResolvedValue(null);

    await expect(
      handler.handle({ tarefaId: 'tarefa-1', professorId: 'prof-1' }),
    ).rejects.toThrow(/duas contas externas/);
    expect(tarefaService.markError).toHaveBeenCalled();
  });

  it('marca erro e relança quando a API externa falha', async () => {
    googleClassroomClient.createCourseWork.mockRejectedValue(
      new Error('HTTP 500'),
    );

    await expect(
      handler.handle({ tarefaId: 'tarefa-1', professorId: 'prof-1' }),
    ).rejects.toThrow('HTTP 500');
    expect(tarefaService.markError).toHaveBeenCalledWith(
      'tarefa-1',
      'HTTP 500',
    );
    expect(tarefaService.markSynced).not.toHaveBeenCalled();
  });
});
