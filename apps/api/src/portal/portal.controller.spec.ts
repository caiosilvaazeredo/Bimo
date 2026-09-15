import { PortalController } from './portal.controller';

describe('PortalController (RF-STU-01/02/03)', () => {
  const matriculaService = {
    listTurmaIdsByAluno: jest.fn(),
  };
  const turmaEspelhadaService = {
    findById: jest.fn(),
  };
  const entregaContingenciaService = {
    submit: jest.fn(),
  };
  const tarefaService = {
    listByTurma: jest.fn(),
  };
  const notaService = {
    findByTarefaAndAluno: jest.fn(),
  };

  let controller: PortalController;
  const req = { user: { sub: 'aluno-1', tenantId: 'tenant-1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new PortalController(
      matriculaService as any,
      turmaEspelhadaService as any,
      entregaContingenciaService as any,
      tarefaService as any,
      notaService as any,
    );
  });

  it('lista as turmas do aluno resolvendo cada matrícula', async () => {
    matriculaService.listTurmaIdsByAluno.mockResolvedValue([
      'turma-1',
      'turma-2',
    ]);
    turmaEspelhadaService.findById.mockImplementation(async (id: string) => ({
      id,
    }));

    const result = await controller.minhasTurmas(req);

    expect(result).toEqual([{ id: 'turma-1' }, { id: 'turma-2' }]);
    expect(matriculaService.listTurmaIdsByAluno).toHaveBeenCalledWith(
      'aluno-1',
    );
  });

  it('busca uma turma específica', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({ id: 'turma-1' });

    const result = await controller.turma(req, 'turma-1');

    expect(result).toEqual({ id: 'turma-1' });
    expect(turmaEspelhadaService.findById).toHaveBeenCalledWith('turma-1');
  });

  it('lista tarefas de uma turma em modo leitura', async () => {
    tarefaService.listByTurma.mockResolvedValue([{ id: 'tarefa-1' }]);

    const result = await controller.tarefas(req, 'turma-1');

    expect(result).toEqual([{ id: 'tarefa-1' }]);
    expect(tarefaService.listByTurma).toHaveBeenCalledWith('turma-1');
  });

  it('busca a nota do próprio aluno em uma tarefa', async () => {
    notaService.findByTarefaAndAluno.mockResolvedValue({ grade: 9 });

    const result = await controller.minhaNota(req, 'tarefa-1');

    expect(result).toEqual({ grade: 9 });
    expect(notaService.findByTarefaAndAluno).toHaveBeenCalledWith(
      'tarefa-1',
      'aluno-1',
    );
  });

  it('submete uma entrega de contingência', async () => {
    entregaContingenciaService.submit.mockResolvedValue({ id: 'entrega-1' });

    const result = await controller.submeterEntrega(req, {
      turmaEspelhadaId: 'turma-1',
      link: 'http://link',
    });

    expect(result).toEqual({ id: 'entrega-1' });
    expect(entregaContingenciaService.submit).toHaveBeenCalledWith({
      alunoId: 'aluno-1',
      turmaEspelhadaId: 'turma-1',
      link: 'http://link',
    });
  });
});
