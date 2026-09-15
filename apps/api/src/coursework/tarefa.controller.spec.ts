import { TarefaController } from './tarefa.controller';

describe('TarefaController', () => {
  const tarefaService = {
    publish: jest.fn(),
    listByTurma: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    requestDeletion: jest.fn(),
  };
  const conflictCheckService = {
    checkTarefa: jest.fn(),
  };

  let controller: TarefaController;
  const req = { user: { sub: 'prof-1', tenantId: 'tenant-1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new TarefaController(
      tarefaService as any,
      conflictCheckService as any,
    );
  });

  it('publica uma tarefa convertendo o dto para input do serviço', async () => {
    tarefaService.publish.mockResolvedValue({ id: 'tarefa-1' });

    const result = await controller.publish(req, 'turma-1', {
      title: 'Trabalho 1',
      description: 'desc',
      dueDate: '2026-01-01T00:00:00.000Z',
      points: 10,
      materialLinks: ['http://a'],
    });

    expect(result).toEqual({ id: 'tarefa-1' });
    expect(tarefaService.publish).toHaveBeenCalledWith(
      'turma-1',
      'prof-1',
      expect.objectContaining({
        title: 'Trabalho 1',
        description: 'desc',
        dueDate: new Date('2026-01-01T00:00:00.000Z'),
        points: 10,
        materialLinks: ['http://a'],
      }),
    );
  });

  it('lista tarefas de uma turma', async () => {
    tarefaService.listByTurma.mockResolvedValue([{ id: 'tarefa-1' }]);

    const result = await controller.list(req, 'turma-1');

    expect(result).toEqual([{ id: 'tarefa-1' }]);
    expect(tarefaService.listByTurma).toHaveBeenCalledWith('turma-1');
  });

  it('busca uma tarefa por id', async () => {
    tarefaService.findById.mockResolvedValue({ id: 'tarefa-1' });

    const result = await controller.findOne(req, 'tarefa-1');

    expect(result).toEqual({ id: 'tarefa-1' });
    expect(tarefaService.findById).toHaveBeenCalledWith('tarefa-1');
  });

  it('atualiza uma tarefa', async () => {
    tarefaService.update.mockResolvedValue({ id: 'tarefa-1', title: 'Novo' });

    const result = await controller.update(req, 'tarefa-1', { title: 'Novo' });

    expect(result).toEqual({ id: 'tarefa-1', title: 'Novo' });
    expect(tarefaService.update).toHaveBeenCalledWith(
      'tarefa-1',
      'prof-1',
      expect.objectContaining({ title: 'Novo' }),
    );
  });

  it('dispara a checagem de conflito (RF-SYNC-03)', async () => {
    conflictCheckService.checkTarefa.mockResolvedValue({ hasConflict: false });

    const result = await controller.checkConflict(req, 'tarefa-1');

    expect(result).toEqual({ hasConflict: false });
    expect(conflictCheckService.checkTarefa).toHaveBeenCalledWith(
      'tarefa-1',
      'prof-1',
    );
  });

  it('solicita exclusão repassando a confirmação (RF-SYNC-06)', async () => {
    tarefaService.requestDeletion.mockResolvedValue({ deleted: true });

    const result = await controller.delete(req, 'tarefa-1', { confirm: true });

    expect(result).toEqual({ deleted: true });
    expect(tarefaService.requestDeletion).toHaveBeenCalledWith(
      'tarefa-1',
      'prof-1',
      true,
    );
  });

  it('trata confirm ausente como false', async () => {
    tarefaService.requestDeletion.mockResolvedValue({ deleted: false });

    await controller.delete(req, 'tarefa-1', {});

    expect(tarefaService.requestDeletion).toHaveBeenCalledWith(
      'tarefa-1',
      'prof-1',
      false,
    );
  });
});
