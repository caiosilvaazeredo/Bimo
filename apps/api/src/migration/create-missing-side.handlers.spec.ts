import {
  CreateMissingMicrosoftTeamHandler,
  CreateMissingGoogleCourseHandler,
} from './create-missing-side.handlers';

describe('CreateMissingMicrosoftTeamHandler (RF-MIG-01)', () => {
  const turma = { id: 'turma-1', name: 'Turma A' };
  const turmaEspelhadaService = {
    findById: jest.fn().mockResolvedValue(turma),
    markSideSynced: jest.fn().mockResolvedValue(undefined),
    markError: jest.fn().mockResolvedValue(undefined),
  };
  const externalAccountsService = {
    findByProfessorAndProvider: jest.fn(),
    getDecryptedAccessToken: jest.fn().mockReturnValue('token'),
  };
  const microsoftTeamsClient = {
    createTeam: jest.fn(),
  };

  let handler: CreateMissingMicrosoftTeamHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    turmaEspelhadaService.findById.mockResolvedValue(turma);
    externalAccountsService.getDecryptedAccessToken.mockReturnValue('token');
    handler = new CreateMissingMicrosoftTeamHandler(
      turmaEspelhadaService as any,
      externalAccountsService as any,
      microsoftTeamsClient as any,
    );
  });

  it('cria o Team faltante e marca o lado como sincronizado', async () => {
    externalAccountsService.findByProfessorAndProvider.mockResolvedValue({
      id: 'acc-1',
    });
    microsoftTeamsClient.createTeam.mockResolvedValue({
      externalId: 'team-1',
      webUrl: 'http://teams/team-1',
    });

    await handler.handle({
      turmaEspelhadaId: 'turma-1',
      professorId: 'prof-1',
    });

    expect(microsoftTeamsClient.createTeam).toHaveBeenCalledWith('token', {
      name: 'Turma A',
    });
    expect(turmaEspelhadaService.markSideSynced).toHaveBeenCalledWith(
      'turma-1',
      'MICROSOFT',
      'team-1',
      'http://teams/team-1',
    );
    expect(turmaEspelhadaService.markError).not.toHaveBeenCalled();
  });

  it('marca erro e propaga quando o professor não tem conta Microsoft', async () => {
    externalAccountsService.findByProfessorAndProvider.mockResolvedValue(null);

    await expect(
      handler.handle({ turmaEspelhadaId: 'turma-1', professorId: 'prof-1' }),
    ).rejects.toThrow('Professor não possui conta Microsoft vinculada');

    expect(turmaEspelhadaService.markError).toHaveBeenCalledWith(
      'turma-1',
      'Professor não possui conta Microsoft vinculada',
    );
  });

  it('marca erro e propaga quando a chamada ao Teams falha', async () => {
    externalAccountsService.findByProfessorAndProvider.mockResolvedValue({
      id: 'acc-1',
    });
    microsoftTeamsClient.createTeam.mockRejectedValue(new Error('falhou'));

    await expect(
      handler.handle({ turmaEspelhadaId: 'turma-1', professorId: 'prof-1' }),
    ).rejects.toThrow('falhou');

    expect(turmaEspelhadaService.markError).toHaveBeenCalledWith(
      'turma-1',
      'falhou',
    );
  });
});

describe('CreateMissingGoogleCourseHandler (RF-MIG-01)', () => {
  const turma = { id: 'turma-1', name: 'Turma A' };
  const turmaEspelhadaService = {
    findById: jest.fn().mockResolvedValue(turma),
    markSideSynced: jest.fn().mockResolvedValue(undefined),
    markError: jest.fn().mockResolvedValue(undefined),
  };
  const externalAccountsService = {
    findByProfessorAndProvider: jest.fn(),
    getDecryptedAccessToken: jest.fn().mockReturnValue('token'),
  };
  const googleClassroomClient = {
    createCourse: jest.fn(),
  };

  let handler: CreateMissingGoogleCourseHandler;

  beforeEach(() => {
    jest.clearAllMocks();
    turmaEspelhadaService.findById.mockResolvedValue(turma);
    externalAccountsService.getDecryptedAccessToken.mockReturnValue('token');
    handler = new CreateMissingGoogleCourseHandler(
      turmaEspelhadaService as any,
      externalAccountsService as any,
      googleClassroomClient as any,
    );
  });

  it('cria o curso faltante e marca o lado como sincronizado', async () => {
    externalAccountsService.findByProfessorAndProvider.mockResolvedValue({
      id: 'acc-1',
    });
    googleClassroomClient.createCourse.mockResolvedValue({
      externalId: 'course-1',
      alternateLink: 'http://classroom/course-1',
    });

    await handler.handle({
      turmaEspelhadaId: 'turma-1',
      professorId: 'prof-1',
    });

    expect(googleClassroomClient.createCourse).toHaveBeenCalledWith('token', {
      name: 'Turma A',
    });
    expect(turmaEspelhadaService.markSideSynced).toHaveBeenCalledWith(
      'turma-1',
      'GOOGLE',
      'course-1',
      'http://classroom/course-1',
    );
  });

  it('marca erro e propaga quando o professor não tem conta Google', async () => {
    externalAccountsService.findByProfessorAndProvider.mockResolvedValue(null);

    await expect(
      handler.handle({ turmaEspelhadaId: 'turma-1', professorId: 'prof-1' }),
    ).rejects.toThrow('Professor não possui conta Google vinculada');

    expect(turmaEspelhadaService.markError).toHaveBeenCalledWith(
      'turma-1',
      'Professor não possui conta Google vinculada',
    );
  });

  it('marca erro e propaga quando a chamada ao Classroom falha', async () => {
    externalAccountsService.findByProfessorAndProvider.mockResolvedValue({
      id: 'acc-1',
    });
    googleClassroomClient.createCourse.mockRejectedValue(new Error('falhou'));

    await expect(
      handler.handle({ turmaEspelhadaId: 'turma-1', professorId: 'prof-1' }),
    ).rejects.toThrow('falhou');

    expect(turmaEspelhadaService.markError).toHaveBeenCalledWith(
      'turma-1',
      'falhou',
    );
  });
});
