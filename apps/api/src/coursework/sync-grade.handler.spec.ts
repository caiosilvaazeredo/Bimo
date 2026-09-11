import { SyncGradeHandler } from './sync-grade.handler';
import { ExternalProvider } from '../professor/external-provider.enum';

describe('SyncGradeHandler', () => {
  const nota = {
    id: 'nota-1',
    tarefaId: 'tarefa-1',
    alunoId: 'aluno-1',
    grade: 9,
  };
  const tarefa = {
    id: 'tarefa-1',
    turmaEspelhadaId: 'turma-1',
    googleCourseWorkId: 'cw1',
    microsoftAssignmentId: 'a1',
  };
  const turma = { id: 'turma-1', googleCourseId: 'c1', microsoftTeamId: 't1' };
  const matricula = { googleUserId: 'g-aluno-1', microsoftUserId: 'm-aluno-1' };
  const googleAccount = { provider: ExternalProvider.GOOGLE };
  const microsoftAccount = { provider: ExternalProvider.MICROSOFT };

  const notaService = {
    findById: jest.fn(),
    markSynced: jest.fn().mockResolvedValue(undefined),
    markError: jest.fn().mockResolvedValue(undefined),
  };
  const tarefaService = { findById: jest.fn() };
  const turmaEspelhadaService = { findById: jest.fn() };
  const matriculaService = { findByAlunoAndTurma: jest.fn() };
  const externalAccountsService = {
    findByProfessorAndProvider: jest.fn(),
    getDecryptedAccessToken: jest.fn().mockReturnValue('token'),
  };
  const googleClassroomClient = {
    setGrade: jest.fn().mockResolvedValue(undefined),
  };
  const microsoftTeamsClient = {
    setGrade: jest.fn().mockResolvedValue(undefined),
  };

  let handler: SyncGradeHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    notaService.findById.mockResolvedValue(nota);
    tarefaService.findById.mockResolvedValue(tarefa);
    turmaEspelhadaService.findById.mockResolvedValue(turma);
    matriculaService.findByAlunoAndTurma.mockResolvedValue(matricula);
    externalAccountsService.getDecryptedAccessToken.mockReturnValue('token');
    externalAccountsService.findByProfessorAndProvider.mockImplementation(
      async (_id: string, provider: ExternalProvider) =>
        provider === ExternalProvider.GOOGLE ? googleAccount : microsoftAccount,
    );
    googleClassroomClient.setGrade.mockResolvedValue(undefined);
    microsoftTeamsClient.setGrade.mockResolvedValue(undefined);

    handler = new SyncGradeHandler(
      notaService as any,
      tarefaService as any,
      turmaEspelhadaService as any,
      matriculaService as any,
      externalAccountsService as any,
      googleClassroomClient as any,
      microsoftTeamsClient as any,
    );
  });

  it('propaga a nota para as duas plataformas quando os ids existem', async () => {
    await handler.handle({ notaId: 'nota-1', professorId: 'prof-1' });

    expect(googleClassroomClient.setGrade).toHaveBeenCalledWith(
      'token',
      'c1',
      'cw1',
      'g-aluno-1',
      9,
    );
    expect(microsoftTeamsClient.setGrade).toHaveBeenCalledWith(
      'token',
      't1',
      'a1',
      'm-aluno-1',
      9,
    );
    expect(notaService.markSynced).toHaveBeenCalledWith('nota-1');
  });

  it('marca sincronizado sem propagar quando a nota é null (só registro em Bimo)', async () => {
    notaService.findById.mockResolvedValue({ ...nota, grade: null });

    await handler.handle({ notaId: 'nota-1', professorId: 'prof-1' });

    expect(googleClassroomClient.setGrade).not.toHaveBeenCalled();
    expect(notaService.markSynced).toHaveBeenCalledWith('nota-1');
  });

  it('marca sincronizado sem propagar quando o aluno não está matriculado', async () => {
    matriculaService.findByAlunoAndTurma.mockResolvedValue(null);

    await handler.handle({ notaId: 'nota-1', professorId: 'prof-1' });

    expect(googleClassroomClient.setGrade).not.toHaveBeenCalled();
    expect(notaService.markSynced).toHaveBeenCalledWith('nota-1');
  });

  it('propaga só para o Google quando falta o id do aluno no Microsoft', async () => {
    matriculaService.findByAlunoAndTurma.mockResolvedValue({
      googleUserId: 'g-aluno-1',
      microsoftUserId: null,
    });

    await handler.handle({ notaId: 'nota-1', professorId: 'prof-1' });

    expect(googleClassroomClient.setGrade).toHaveBeenCalled();
    expect(microsoftTeamsClient.setGrade).not.toHaveBeenCalled();
    expect(notaService.markSynced).toHaveBeenCalledWith('nota-1');
  });

  it('marca erro e relança quando a chamada externa falha', async () => {
    googleClassroomClient.setGrade.mockRejectedValue(
      new Error('sem submission'),
    );

    await expect(
      handler.handle({ notaId: 'nota-1', professorId: 'prof-1' }),
    ).rejects.toThrow('sem submission');
    expect(notaService.markError).toHaveBeenCalledWith(
      'nota-1',
      'sem submission',
    );
  });
});
