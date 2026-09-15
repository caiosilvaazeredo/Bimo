import { TurmaEspelhadaController } from './turma-espelhada.controller';

describe('TurmaEspelhadaController', () => {
  const turmaEspelhadaService = {
    create: jest.fn(),
    listByTenant: jest.fn(),
    findById: jest.fn(),
  };

  let controller: TurmaEspelhadaController;
  const req = { user: { sub: 'prof-1', tenantId: 'tenant-1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TurmaEspelhadaController(turmaEspelhadaService as any);
  });

  it('cria uma turma espelhada', async () => {
    turmaEspelhadaService.create.mockResolvedValue({ id: 'turma-1' });

    const result = await controller.create(req, {
      name: 'Turma A',
      academicPeriod: '2026.1',
    });

    expect(result).toEqual({ id: 'turma-1' });
    expect(turmaEspelhadaService.create).toHaveBeenCalledWith({
      professorId: 'prof-1',
      name: 'Turma A',
      academicPeriod: '2026.1',
    });
  });

  it('lista turmas do tenant', async () => {
    turmaEspelhadaService.listByTenant.mockResolvedValue([{ id: 'turma-1' }]);

    const result = await controller.list(req);

    expect(result).toEqual([{ id: 'turma-1' }]);
    expect(turmaEspelhadaService.listByTenant).toHaveBeenCalled();
  });

  it('busca uma turma por id', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({ id: 'turma-1' });

    const result = await controller.findOne(req, 'turma-1');

    expect(result).toEqual({ id: 'turma-1' });
    expect(turmaEspelhadaService.findById).toHaveBeenCalledWith('turma-1');
  });
});
