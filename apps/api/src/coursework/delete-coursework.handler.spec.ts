import { DeleteCourseworkHandler } from './delete-coursework.handler';
import { ExternalProvider } from '../professor/external-provider.enum';

describe('DeleteCourseworkHandler', () => {
  const turma = { id: 'turma-1', googleCourseId: 'c1', microsoftTeamId: 't1' };
  const googleAccount = { provider: ExternalProvider.GOOGLE };
  const microsoftAccount = { provider: ExternalProvider.MICROSOFT };

  const tarefaService = {
    findById: jest.fn(),
    markDeleted: jest.fn().mockResolvedValue(undefined),
    markError: jest.fn().mockResolvedValue(undefined),
  };
  const turmaEspelhadaService = {
    findById: jest.fn().mockResolvedValue(turma),
  };
  const externalAccountsService = {
    findByProfessorAndProvider: jest.fn(),
    getDecryptedAccessToken: jest.fn().mockReturnValue('token'),
  };
  const googleClassroomClient = {
    deleteCourseWork: jest.fn().mockResolvedValue(undefined),
  };
  const microsoftTeamsClient = {
    deleteAssignment: jest.fn().mockResolvedValue(undefined),
  };

  let handler: DeleteCourseworkHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    turmaEspelhadaService.findById.mockResolvedValue(turma);
    externalAccountsService.getDecryptedAccessToken.mockReturnValue('token');
    externalAccountsService.findByProfessorAndProvider.mockImplementation(
      async (_id: string, provider: ExternalProvider) =>
        provider === ExternalProvider.GOOGLE ? googleAccount : microsoftAccount,
    );
    googleClassroomClient.deleteCourseWork.mockResolvedValue(undefined);
    microsoftTeamsClient.deleteAssignment.mockResolvedValue(undefined);

    handler = new DeleteCourseworkHandler(
      tarefaService as any,
      turmaEspelhadaService as any,
      externalAccountsService as any,
      googleClassroomClient as any,
      microsoftTeamsClient as any,
    );
  });

  it('exclui nas duas plataformas quando publicada nas duas e marca deletada (RF-SYNC-06)', async () => {
    tarefaService.findById.mockResolvedValue({
      id: 'tarefa-1',
      turmaEspelhadaId: 'turma-1',
      googleCourseWorkId: 'cw1',
      microsoftAssignmentId: 'a1',
    });

    await handler.handle({ tarefaId: 'tarefa-1', professorId: 'prof-1' });

    expect(googleClassroomClient.deleteCourseWork).toHaveBeenCalledWith(
      'token',
      'c1',
      'cw1',
    );
    expect(microsoftTeamsClient.deleteAssignment).toHaveBeenCalledWith(
      'token',
      't1',
      'a1',
    );
    expect(tarefaService.markDeleted).toHaveBeenCalledWith('tarefa-1');
    expect(tarefaService.markError).not.toHaveBeenCalled();
  });

  it('exclui só o lado já publicado quando a tarefa só existe em uma plataforma', async () => {
    tarefaService.findById.mockResolvedValue({
      id: 'tarefa-1',
      turmaEspelhadaId: 'turma-1',
      googleCourseWorkId: 'cw1',
      microsoftAssignmentId: null,
    });

    await handler.handle({ tarefaId: 'tarefa-1', professorId: 'prof-1' });

    expect(googleClassroomClient.deleteCourseWork).toHaveBeenCalled();
    expect(microsoftTeamsClient.deleteAssignment).not.toHaveBeenCalled();
    expect(tarefaService.markDeleted).toHaveBeenCalledWith('tarefa-1');
  });

  it('marca deletada direto, sem chamar nenhuma API, quando a tarefa nunca foi publicada', async () => {
    tarefaService.findById.mockResolvedValue({
      id: 'tarefa-1',
      turmaEspelhadaId: 'turma-1',
      googleCourseWorkId: null,
      microsoftAssignmentId: null,
    });

    await handler.handle({ tarefaId: 'tarefa-1', professorId: 'prof-1' });

    expect(googleClassroomClient.deleteCourseWork).not.toHaveBeenCalled();
    expect(microsoftTeamsClient.deleteAssignment).not.toHaveBeenCalled();
    expect(tarefaService.markDeleted).toHaveBeenCalledWith('tarefa-1');
  });

  it('marca erro e relança quando a exclusão em uma das plataformas falha', async () => {
    tarefaService.findById.mockResolvedValue({
      id: 'tarefa-1',
      turmaEspelhadaId: 'turma-1',
      googleCourseWorkId: 'cw1',
      microsoftAssignmentId: 'a1',
    });
    microsoftTeamsClient.deleteAssignment.mockRejectedValue(
      new Error('assignment já atribuído a alunos'),
    );

    await expect(
      handler.handle({ tarefaId: 'tarefa-1', professorId: 'prof-1' }),
    ).rejects.toThrow('assignment já atribuído a alunos');

    expect(tarefaService.markError).toHaveBeenCalledWith(
      'tarefa-1',
      'assignment já atribuído a alunos',
    );
    expect(tarefaService.markDeleted).not.toHaveBeenCalled();
  });
});
