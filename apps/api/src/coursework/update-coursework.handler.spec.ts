import { UpdateCourseworkHandler } from './update-coursework.handler';
import { ExternalProvider } from '../professor/external-provider.enum';

describe('UpdateCourseworkHandler', () => {
  const tarefa = {
    id: 'tarefa-1',
    turmaEspelhadaId: 'turma-1',
    title: 'Tarefa A (editada)',
    description: null,
    dueDate: null,
    points: 10,
    materialLinks: [],
    googleCourseWorkId: 'cw1',
    microsoftAssignmentId: 'a1',
  };
  const turma = { id: 'turma-1', googleCourseId: 'c1', microsoftTeamId: 't1' };
  const googleAccount = { provider: ExternalProvider.GOOGLE };
  const microsoftAccount = { provider: ExternalProvider.MICROSOFT };

  const tarefaService = {
    findById: jest.fn(),
    markUpdated: jest.fn().mockResolvedValue(undefined),
    markError: jest.fn().mockResolvedValue(undefined),
  };
  const turmaEspelhadaService = { findById: jest.fn() };
  const externalAccountsService = {
    findByProfessorAndProvider: jest.fn(),
    getDecryptedAccessToken: jest.fn().mockReturnValue('token'),
  };
  const googleClassroomClient = {
    updateCourseWork: jest.fn().mockResolvedValue(undefined),
  };
  const microsoftTeamsClient = {
    updateAssignment: jest.fn().mockResolvedValue(undefined),
  };

  let handler: UpdateCourseworkHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    tarefaService.findById.mockResolvedValue(tarefa);
    turmaEspelhadaService.findById.mockResolvedValue(turma);
    externalAccountsService.getDecryptedAccessToken.mockReturnValue('token');
    externalAccountsService.findByProfessorAndProvider.mockImplementation(
      async (_id: string, provider: ExternalProvider) =>
        provider === ExternalProvider.GOOGLE ? googleAccount : microsoftAccount,
    );
    googleClassroomClient.updateCourseWork.mockResolvedValue(undefined);
    microsoftTeamsClient.updateAssignment.mockResolvedValue(undefined);

    handler = new UpdateCourseworkHandler(
      tarefaService as any,
      turmaEspelhadaService as any,
      externalAccountsService as any,
      googleClassroomClient as any,
      microsoftTeamsClient as any,
    );
  });

  it('edita nas duas plataformas e marca atualizado', async () => {
    await handler.handle({ tarefaId: 'tarefa-1', professorId: 'prof-1' });

    expect(googleClassroomClient.updateCourseWork).toHaveBeenCalledWith(
      'token',
      'c1',
      'cw1',
      expect.objectContaining({ title: 'Tarefa A (editada)' }),
    );
    expect(microsoftTeamsClient.updateAssignment).toHaveBeenCalledWith(
      'token',
      't1',
      'a1',
      expect.objectContaining({ title: 'Tarefa A (editada)' }),
    );
    expect(tarefaService.markUpdated).toHaveBeenCalledWith('tarefa-1');
  });

  it('marca erro quando a tarefa ainda não foi publicada nos dois lados', async () => {
    tarefaService.findById.mockResolvedValue({
      ...tarefa,
      microsoftAssignmentId: null,
    });

    await expect(
      handler.handle({ tarefaId: 'tarefa-1', professorId: 'prof-1' }),
    ).rejects.toThrow(/ainda não foi publicada/);
    expect(tarefaService.markError).toHaveBeenCalled();
  });
});
