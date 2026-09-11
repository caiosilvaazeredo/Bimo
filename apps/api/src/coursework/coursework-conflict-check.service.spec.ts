import { CourseworkConflictCheckService } from './coursework-conflict-check.service';
import { ExternalProvider } from '../professor/external-provider.enum';

describe('CourseworkConflictCheckService', () => {
  const tarefa = {
    id: 'tarefa-1',
    turmaEspelhadaId: 'turma-1',
    googleCourseWorkId: 'cw1',
    microsoftAssignmentId: 'a1',
  };
  const turma = { id: 'turma-1', googleCourseId: 'c1', microsoftTeamId: 't1' };
  const googleAccount = { provider: ExternalProvider.GOOGLE };
  const microsoftAccount = { provider: ExternalProvider.MICROSOFT };

  const tarefaService = {
    findById: jest.fn(),
    markConflict: jest.fn().mockResolvedValue(undefined),
  };
  const turmaEspelhadaService = { findById: jest.fn() };
  const externalAccountsService = {
    findByProfessorAndProvider: jest.fn(),
    getDecryptedAccessToken: jest.fn().mockReturnValue('token'),
  };
  const googleClassroomClient = { getCourseWork: jest.fn() };
  const microsoftTeamsClient = { getAssignment: jest.fn() };
  const conflictService = { raise: jest.fn().mockResolvedValue(undefined) };
  const notificationsService = {
    notifyConflict: jest.fn().mockResolvedValue(undefined),
  };

  let service: CourseworkConflictCheckService;

  beforeEach(() => {
    jest.clearAllMocks();
    tarefaService.findById.mockResolvedValue(tarefa);
    turmaEspelhadaService.findById.mockResolvedValue(turma);
    externalAccountsService.getDecryptedAccessToken.mockReturnValue('token');
    externalAccountsService.findByProfessorAndProvider.mockImplementation(
      async (_id: string, provider: ExternalProvider) =>
        provider === ExternalProvider.GOOGLE ? googleAccount : microsoftAccount,
    );

    service = new CourseworkConflictCheckService(
      tarefaService as any,
      turmaEspelhadaService as any,
      externalAccountsService as any,
      googleClassroomClient as any,
      microsoftTeamsClient as any,
      conflictService as any,
      notificationsService as any,
    );
  });

  it('não faz nada quando a tarefa ainda não foi publicada nos dois lados', async () => {
    tarefaService.findById.mockResolvedValue({
      ...tarefa,
      microsoftAssignmentId: null,
    });

    const result = await service.checkTarefa('tarefa-1', 'prof-1');

    expect(result.conflictsFound).toBe(0);
    expect(googleClassroomClient.getCourseWork).not.toHaveBeenCalled();
  });

  it('não registra conflito quando os dois lados estão iguais', async () => {
    const state = {
      title: 'Tarefa X',
      description: 'desc',
      dueDateIso: null,
      points: 10,
      materialLinks: [],
    };
    googleClassroomClient.getCourseWork.mockResolvedValue(state);
    microsoftTeamsClient.getAssignment.mockResolvedValue(state);

    const result = await service.checkTarefa('tarefa-1', 'prof-1');

    expect(result.conflictsFound).toBe(0);
    expect(conflictService.raise).not.toHaveBeenCalled();
    expect(tarefaService.markConflict).not.toHaveBeenCalled();
  });

  it('registra conflito por campo divergente, marca a tarefa e notifica o professor (RF-SYNC-03)', async () => {
    googleClassroomClient.getCourseWork.mockResolvedValue({
      title: 'Título do Google',
      description: 'desc',
      dueDateIso: null,
      points: 10,
      materialLinks: [],
    });
    microsoftTeamsClient.getAssignment.mockResolvedValue({
      title: 'Título do Microsoft',
      description: 'desc',
      dueDateIso: null,
      points: 10,
      materialLinks: [],
    });

    const result = await service.checkTarefa('tarefa-1', 'prof-1');

    expect(result.conflictsFound).toBe(1);
    expect(conflictService.raise).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceType: 'TAREFA',
        resourceId: 'tarefa-1',
        fieldName: 'title',
        googleValue: 'Título do Google',
        microsoftValue: 'Título do Microsoft',
      }),
    );
    expect(tarefaService.markConflict).toHaveBeenCalledWith('tarefa-1');
    expect(notificationsService.notifyConflict).toHaveBeenCalledWith(
      'prof-1',
      'turma-1',
    );
  });

  it('não faz chamada externa quando o professor não tem as duas contas vinculadas', async () => {
    externalAccountsService.findByProfessorAndProvider.mockResolvedValue(null);

    const result = await service.checkTarefa('tarefa-1', 'prof-1');

    expect(result.conflictsFound).toBe(0);
    expect(googleClassroomClient.getCourseWork).not.toHaveBeenCalled();
  });
});
