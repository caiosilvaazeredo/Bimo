import { BadRequestException } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { MigrationService } from './migration.service';
import { ExternalProvider } from '../professor/external-provider.enum';

describe('MigrationService', () => {
  const TENANT = 'tenant-1';
  const turmaEspelhadaService = {
    findByGoogleCourseId: jest.fn(),
    findByMicrosoftTeamId: jest.fn(),
    createLinked: jest.fn(),
    findById: jest.fn(),
  };
  const externalAccountsService = {
    findByProfessorAndProvider: jest.fn(),
    getDecryptedAccessToken: jest.fn().mockReturnValue('token'),
  };
  const googleClassroomClient = {
    getCourse: jest.fn(),
    listStudents: jest.fn(),
  };
  const microsoftTeamsClient = {
    getGroup: jest.fn(),
    listMembers: jest.fn(),
  };
  const syncQueueService = { enqueue: jest.fn().mockResolvedValue(undefined) };
  const alunosService = { findOrCreateByInstitutionalEmail: jest.fn() };
  const matriculaService = {
    enroll: jest.fn().mockResolvedValue(undefined),
    listByTurma: jest.fn().mockResolvedValue([]),
  };
  const tarefaService = { importFromExternal: jest.fn() };
  const notaService = { setGrade: jest.fn().mockResolvedValue(undefined) };

  let service: MigrationService;

  beforeEach(() => {
    jest.clearAllMocks();
    externalAccountsService.getDecryptedAccessToken.mockReturnValue('token');
    externalAccountsService.findByProfessorAndProvider.mockImplementation(
      async (_id: string, provider: ExternalProvider) => ({
        provider,
      }),
    );
    alunosService.findOrCreateByInstitutionalEmail.mockImplementation(
      async ({ institutionalEmail }: any) => ({
        id: `aluno-${institutionalEmail}`,
      }),
    );

    service = new MigrationService(
      turmaEspelhadaService as any,
      externalAccountsService as any,
      googleClassroomClient as any,
      microsoftTeamsClient as any,
      syncQueueService as any,
      alunosService as any,
      matriculaService as any,
      tarefaService as any,
      notaService as any,
    );
  });

  const withTenant = <T>(fn: () => Promise<T>) =>
    TenantContext.run({ tenantId: TENANT }, fn);

  it('exige ao menos um id de turma existente', async () => {
    await expect(
      withTenant(() => service.linkExisting({ professorId: 'prof-1' })),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('exige confirmação manual quando os dois ids são informados (RF-MIG-01)', async () => {
    turmaEspelhadaService.findByGoogleCourseId.mockResolvedValue(null);
    turmaEspelhadaService.findByMicrosoftTeamId.mockResolvedValue(null);

    await expect(
      withTenant(() =>
        service.linkExisting({
          professorId: 'prof-1',
          googleCourseId: 'c1',
          microsoftTeamId: 't1',
        }),
      ),
    ).rejects.toThrow(/confirme manualmente/);
  });

  it('é idempotente: religar o mesmo googleCourseId retorna a turma já vinculada (RF-MIG-05)', async () => {
    const existing = { id: 'turma-1', googleCourseId: 'c1' };
    turmaEspelhadaService.findByGoogleCourseId.mockResolvedValue(existing);

    const result = await withTenant(() =>
      service.linkExisting({ professorId: 'prof-1', googleCourseId: 'c1' }),
    );

    expect(result).toBe(existing);
    expect(turmaEspelhadaService.createLinked).not.toHaveBeenCalled();
  });

  it('cria a turma-ponte e enfileira a criação do lado que falta quando só o Google existe', async () => {
    turmaEspelhadaService.findByGoogleCourseId.mockResolvedValue(null);
    googleClassroomClient.getCourse.mockResolvedValue({
      externalId: 'c1',
      name: 'Turma X',
      alternateLink: null,
    });
    const created = {
      id: 'turma-1',
      googleCourseId: 'c1',
      microsoftTeamId: null,
    };
    turmaEspelhadaService.createLinked.mockResolvedValue(created);

    const result = await withTenant(() =>
      service.linkExisting({ professorId: 'prof-1', googleCourseId: 'c1' }),
    );

    expect(result).toBe(created);
    expect(syncQueueService.enqueue).toHaveBeenCalledWith(
      TENANT,
      'CREATE_MISSING_MICROSOFT_TEAM',
      expect.objectContaining({ turmaEspelhadaId: 'turma-1' }),
    );
  });

  it('vincula os dois lados diretamente (sem job) quando confirmado', async () => {
    turmaEspelhadaService.findByGoogleCourseId.mockResolvedValue(null);
    turmaEspelhadaService.findByMicrosoftTeamId.mockResolvedValue(null);
    googleClassroomClient.getCourse.mockResolvedValue({
      externalId: 'c1',
      name: 'Turma X',
      alternateLink: null,
    });
    const created = {
      id: 'turma-1',
      googleCourseId: 'c1',
      microsoftTeamId: 't1',
    };
    turmaEspelhadaService.createLinked.mockResolvedValue(created);

    await withTenant(() =>
      service.linkExisting({
        professorId: 'prof-1',
        googleCourseId: 'c1',
        microsoftTeamId: 't1',
        confirmedSameClass: true,
      }),
    );

    expect(syncQueueService.enqueue).not.toHaveBeenCalled();
  });

  it('reconcileRoster sinaliza alunos presentes em apenas um dos lados (RF-MIG-03)', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({
      id: 'turma-1',
      googleCourseId: 'c1',
      microsoftTeamId: 't1',
    });
    googleClassroomClient.listStudents.mockResolvedValue([
      { email: 'a@escola.edu.br', googleUserId: 'g-a' },
      { email: 'b@escola.edu.br', googleUserId: 'g-b' },
    ]);
    microsoftTeamsClient.listMembers.mockResolvedValue([
      { email: 'b@escola.edu.br', microsoftUserId: 'm-b' },
      { email: 'c@escola.edu.br', microsoftUserId: 'm-c' },
    ]);

    const result = await withTenant(() =>
      service.reconcileRoster('turma-1', 'prof-1'),
    );

    expect(result.onlyGoogle).toEqual(['a@escola.edu.br']);
    expect(result.onlyMicrosoft).toEqual(['c@escola.edu.br']);
    expect(result.both).toEqual(['b@escola.edu.br']);
    expect(matriculaService.enroll).toHaveBeenCalledTimes(3);
  });

  it('importHistory importa tarefas dos dois lados e lança nota de quem já está matriculado (RF-MIG-02)', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({
      id: 'turma-1',
      googleCourseId: 'c1',
      microsoftTeamId: 't1',
    });
    matriculaService.listByTurma.mockResolvedValue([
      { alunoId: 'aluno-a', googleUserId: 'g-a', microsoftUserId: 'm-a' },
    ]);
    (googleClassroomClient as any).listCourseWork = jest
      .fn()
      .mockResolvedValue([
        {
          externalId: 'cw1',
          title: 'Tarefa Google',
          description: null,
          dueDateIso: null,
          points: 10,
          materialLinks: [],
        },
      ]);
    (googleClassroomClient as any).listSubmissions = jest
      .fn()
      .mockResolvedValue([
        {
          googleUserId: 'g-a',
          assignedGrade: 8,
          late: false,
          state: 'TURNED_IN',
        },
      ]);
    (microsoftTeamsClient as any).listAssignments = jest
      .fn()
      .mockResolvedValue([
        {
          externalId: 'a1',
          title: 'Tarefa Microsoft',
          description: null,
          dueDateIso: null,
          points: 10,
          materialLinks: [],
        },
      ]);
    (microsoftTeamsClient as any).listAssignmentSubmissions = jest
      .fn()
      .mockResolvedValue([
        { microsoftUserId: 'm-a', points: 7, status: 'returned' },
      ]);
    tarefaService.importFromExternal.mockImplementation(async (input: any) => ({
      id: `tarefa-${input.title}`,
      ...input,
    }));

    const result = await withTenant(() =>
      service.importHistory('turma-1', 'prof-1'),
    );

    expect(result.tarefasImportadas).toBe(2);
    expect(notaService.setGrade).toHaveBeenCalledWith(
      'tarefa-Tarefa Google',
      'aluno-a',
      'prof-1',
      {
        grade: 8,
        status: 'SUBMITTED',
      },
    );
    expect(notaService.setGrade).toHaveBeenCalledWith(
      'tarefa-Tarefa Microsoft',
      'aluno-a',
      'prof-1',
      { grade: 7 },
    );
  });

  it('importHistory ignora entrega de aluno sem matrícula mapeada naquele provedor', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({
      id: 'turma-1',
      googleCourseId: 'c1',
      microsoftTeamId: null,
    });
    matriculaService.listByTurma.mockResolvedValue([]);
    (googleClassroomClient as any).listCourseWork = jest
      .fn()
      .mockResolvedValue([
        {
          externalId: 'cw1',
          title: 'Tarefa Google',
          description: null,
          dueDateIso: null,
          points: 10,
          materialLinks: [],
        },
      ]);
    (googleClassroomClient as any).listSubmissions = jest
      .fn()
      .mockResolvedValue([
        {
          googleUserId: 'g-desconhecido',
          assignedGrade: 8,
          late: false,
          state: 'TURNED_IN',
        },
      ]);
    tarefaService.importFromExternal.mockResolvedValue({ id: 'tarefa-1' });

    await withTenant(() => service.importHistory('turma-1', 'prof-1'));

    expect(notaService.setGrade).not.toHaveBeenCalled();
  });
});
