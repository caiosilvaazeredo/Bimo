import { NotaController } from './nota.controller';

describe('NotaController', () => {
  const notaService = {
    setGrade: jest.fn(),
    listByTarefa: jest.fn(),
  };

  let controller: NotaController;
  const req = { user: { sub: 'prof-1', tenantId: 'tenant-1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new NotaController(notaService as any);
  });

  it('lança nota para um aluno (RF-SYNC-04)', async () => {
    notaService.setGrade.mockResolvedValue({ id: 'nota-1', grade: 9 });

    const result = await controller.setGrade(req, 'tarefa-1', 'aluno-1', {
      grade: 9,
      comment: 'bom',
    });

    expect(result).toEqual({ id: 'nota-1', grade: 9 });
    expect(notaService.setGrade).toHaveBeenCalledWith(
      'tarefa-1',
      'aluno-1',
      'prof-1',
      { grade: 9, comment: 'bom' },
    );
  });

  it('lista notas de uma tarefa', async () => {
    notaService.listByTarefa.mockResolvedValue([{ id: 'nota-1' }]);

    const result = await controller.list(req, 'tarefa-1');

    expect(result).toEqual([{ id: 'nota-1' }]);
    expect(notaService.listByTarefa).toHaveBeenCalledWith('tarefa-1');
  });
});
