import { MigrationController } from './migration.controller';

describe('MigrationController', () => {
  const migrationService = {
    linkExisting: jest.fn(),
    linkExistingBatch: jest.fn(),
    reconcileRoster: jest.fn(),
    importHistory: jest.fn(),
  };

  let controller: MigrationController;
  const req = { user: { sub: 'prof-1', tenantId: 'tenant-1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MigrationController(migrationService as any);
  });

  it('vincula uma turma existente', async () => {
    migrationService.linkExisting.mockResolvedValue({ id: 'turma-1' });

    const result = await controller.linkExisting(req, {
      googleCourseId: 'c1',
      confirmedSameClass: true,
    });

    expect(result).toEqual({ id: 'turma-1' });
    expect(migrationService.linkExisting).toHaveBeenCalledWith({
      professorId: 'prof-1',
      googleCourseId: 'c1',
      confirmedSameClass: true,
    });
  });

  it('vincula várias turmas existentes em lote (RF-MIG-06)', async () => {
    migrationService.linkExistingBatch.mockResolvedValue([{ id: 'turma-1' }]);

    const result = await controller.linkExistingBatch(req, {
      turmas: [{ googleCourseId: 'c1' }, { microsoftTeamId: 't1' }],
    });

    expect(result).toEqual([{ id: 'turma-1' }]);
    expect(migrationService.linkExistingBatch).toHaveBeenCalledWith([
      { professorId: 'prof-1', googleCourseId: 'c1' },
      { professorId: 'prof-1', microsoftTeamId: 't1' },
    ]);
  });

  it('trata lote vazio quando turmas não é informado', async () => {
    migrationService.linkExistingBatch.mockResolvedValue([]);

    await controller.linkExistingBatch(req, {} as any);

    expect(migrationService.linkExistingBatch).toHaveBeenCalledWith([]);
  });

  it('reconcilia o roster de uma turma', async () => {
    migrationService.reconcileRoster.mockResolvedValue({ added: 1 });

    const result = await controller.reconcileRoster(req, 'turma-1');

    expect(result).toEqual({ added: 1 });
    expect(migrationService.reconcileRoster).toHaveBeenCalledWith(
      'turma-1',
      'prof-1',
    );
  });

  it('importa histórico de tarefas/notas (RF-MIG-02)', async () => {
    migrationService.importHistory.mockResolvedValue({ imported: 5 });

    const result = await controller.importHistory(req, 'turma-1');

    expect(result).toEqual({ imported: 5 });
    expect(migrationService.importHistory).toHaveBeenCalledWith(
      'turma-1',
      'prof-1',
    );
  });
});
