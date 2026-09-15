import { MatriculaController } from './matricula.controller';

describe('MatriculaController', () => {
  const turmaEspelhadaService = {
    findById: jest.fn(),
  };
  const alunosService = {
    findOrCreateByInstitutionalEmail: jest.fn(),
  };
  const matriculaService = {
    enroll: jest.fn(),
  };

  let controller: MatriculaController;
  const req = { user: { sub: 'prof-1', tenantId: 'tenant-1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MatriculaController(
      turmaEspelhadaService as any,
      alunosService as any,
      matriculaService as any,
    );
  });

  it('vincula um aluno (criando/reconciliando pelo e-mail) à turma', async () => {
    turmaEspelhadaService.findById.mockResolvedValue({ id: 'turma-1' });
    alunosService.findOrCreateByInstitutionalEmail.mockResolvedValue({
      id: 'aluno-1',
    });
    matriculaService.enroll.mockResolvedValue({ id: 'matricula-1' });

    const result = await controller.enroll(req, 'turma-1', {
      institutionalEmail: 'aluno@escola.edu.br',
      displayName: 'Aluno',
    });

    expect(result).toEqual({ id: 'matricula-1' });
    expect(turmaEspelhadaService.findById).toHaveBeenCalledWith('turma-1');
    expect(alunosService.findOrCreateByInstitutionalEmail).toHaveBeenCalledWith(
      { institutionalEmail: 'aluno@escola.edu.br', displayName: 'Aluno' },
    );
    expect(matriculaService.enroll).toHaveBeenCalledWith('aluno-1', 'turma-1');
  });
});
