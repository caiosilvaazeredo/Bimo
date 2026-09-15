import { ProfessorContingenciaController } from './professor-contingencia.controller';

describe('ProfessorContingenciaController (RF-STU-05)', () => {
  const turmaEspelhadaService = {
    findById: jest.fn(),
  };
  const entregaContingenciaService = {
    listByTurma: jest.fn(),
  };

  let controller: ProfessorContingenciaController;
  const req = { user: { sub: 'prof-1', tenantId: 'tenant-1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ProfessorContingenciaController(
      turmaEspelhadaService as any,
      entregaContingenciaService as any,
    );
  });

  it('lista apenas entregas de contingência ainda não propagadas', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({ id: 'turma-1' });
    entregaContingenciaService.listByTurma.mockResolvedValue([
      { id: 'e1', propagatedAt: null },
      { id: 'e2', propagatedAt: new Date() },
    ]);

    const result = await controller.list(req, 'turma-1');

    expect(result).toEqual([{ id: 'e1', propagatedAt: null }]);
    expect(turmaEspelhadaService.findById).toHaveBeenCalledWith('turma-1');
    expect(entregaContingenciaService.listByTurma).toHaveBeenCalledWith(
      'turma-1',
    );
  });
});
