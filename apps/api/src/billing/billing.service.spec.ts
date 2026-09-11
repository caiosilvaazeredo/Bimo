import { BillingService } from './billing.service';
import { SyncStatus } from '../turma-espelhada/sync-status.enum';

describe('BillingService', () => {
  const turmaEspelhadaService = { listByTenant: jest.fn() };
  const matriculaService = { listAlunoIdsByTurma: jest.fn() };

  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BillingService(
      turmaEspelhadaService as any,
      matriculaService as any,
    );
  });

  it('conta alunos únicos matriculados em turmas sincronizadas (RF-BILL-01)', async () => {
    turmaEspelhadaService.listByTenant.mockResolvedValue([
      { id: 'turma-1', syncStatus: SyncStatus.SYNCED },
      { id: 'turma-2', syncStatus: SyncStatus.SYNCED },
      { id: 'turma-3', syncStatus: SyncStatus.SYNCING },
    ]);
    matriculaService.listAlunoIdsByTurma.mockImplementation(
      async (turmaId: string) => {
        if (turmaId === 'turma-1') return ['aluno-1', 'aluno-2'];
        if (turmaId === 'turma-2') return ['aluno-2', 'aluno-3'];
        return ['aluno-nao-conta'];
      },
    );

    const count = await service.countActiveAlunos();

    expect(count).toBe(3);
    expect(matriculaService.listAlunoIdsByTurma).not.toHaveBeenCalledWith(
      'turma-3',
    );
  });

  it('retorna 0 quando não há turmas sincronizadas', async () => {
    turmaEspelhadaService.listByTenant.mockResolvedValue([
      { id: 'turma-1', syncStatus: SyncStatus.ERROR },
    ]);

    expect(await service.countActiveAlunos()).toBe(0);
  });
});
