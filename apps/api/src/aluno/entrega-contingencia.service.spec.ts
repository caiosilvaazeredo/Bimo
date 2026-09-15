import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { EntregaContingenciaService } from './entrega-contingencia.service';

function buildRepositoryMock() {
  const store: any[] = [];
  let counter = 0;
  return {
    create: jest.fn((data: any) => ({ id: `entrega-${++counter}`, ...data })),
    save: jest.fn(async (entity: any) => {
      store.push(entity);
      return entity;
    }),
    find: jest.fn(async ({ where }: any) =>
      store.filter(
        (e) =>
          e.tenantId === where.tenantId &&
          (where.turmaEspelhadaId === undefined ||
            e.turmaEspelhadaId === where.turmaEspelhadaId) &&
          (where.alunoId === undefined || e.alunoId === where.alunoId),
      ),
    ),
    _store: store,
  };
}

describe('EntregaContingenciaService', () => {
  const TENANT = 'tenant-1';
  let repository: ReturnType<typeof buildRepositoryMock>;
  let matriculaService: any;
  let tenantsService: any;
  let service: EntregaContingenciaService;

  let turmaEspelhadaService: any;
  let notificationsService: any;

  beforeEach(() => {
    repository = buildRepositoryMock();
    matriculaService = { isEnrolled: jest.fn() };
    tenantsService = { findById: jest.fn() };
    turmaEspelhadaService = {
      findById: jest.fn().mockResolvedValue({ professorId: 'prof-1' }),
    };
    notificationsService = {
      notifyContingencySignal: jest.fn().mockResolvedValue(undefined),
    };
    service = new EntregaContingenciaService(
      repository as any,
      matriculaService,
      tenantsService,
      turmaEspelhadaService,
      notificationsService,
    );
  });

  const withTenant = <T>(fn: () => Promise<T>) =>
    TenantContext.run({ tenantId: TENANT }, fn);

  it('recebe a entrega quando aluno está matriculado e contingência habilitada (RF-STU-03)', async () => {
    tenantsService.findById.mockResolvedValue({ contingencyEnabled: true });
    matriculaService.isEnrolled.mockResolvedValue(true);

    const entrega = await withTenant(() =>
      service.submit({
        alunoId: 'aluno-1',
        turmaEspelhadaId: 'turma-1',
        link: 'https://drive.example/x',
      }),
    );

    expect(entrega.link).toBe('https://drive.example/x');
    expect(entrega.propagatedAt).toBeNull();
    expect(notificationsService.notifyContingencySignal).not.toHaveBeenCalled();
  });

  it('rejeita quando a instituição desabilitou a contingência (RF-STU-06)', async () => {
    tenantsService.findById.mockResolvedValue({ contingencyEnabled: false });

    await expect(
      withTenant(() =>
        service.submit({
          alunoId: 'aluno-1',
          turmaEspelhadaId: 'turma-1',
          link: 'x',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejeita quando o aluno não está matriculado na turma', async () => {
    tenantsService.findById.mockResolvedValue({ contingencyEnabled: true });
    matriculaService.isEnrolled.mockResolvedValue(false);

    await expect(
      withTenant(() =>
        service.submit({
          alunoId: 'aluno-1',
          turmaEspelhadaId: 'turma-1',
          link: 'x',
        }),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  describe('sinal de problema de acesso (RF-STU-04)', () => {
    beforeEach(() => {
      tenantsService.findById.mockResolvedValue({ contingencyEnabled: true });
      matriculaService.isEnrolled.mockResolvedValue(true);
    });

    it('avisa o professor quando o aluno cruza o limite de usos na mesma turma', async () => {
      await withTenant(() =>
        service.submit({
          alunoId: 'aluno-1',
          turmaEspelhadaId: 'turma-1',
          link: 'x1',
        }),
      );
      expect(
        notificationsService.notifyContingencySignal,
      ).not.toHaveBeenCalled();

      await withTenant(() =>
        service.submit({
          alunoId: 'aluno-1',
          turmaEspelhadaId: 'turma-1',
          link: 'x2',
        }),
      );

      expect(notificationsService.notifyContingencySignal).toHaveBeenCalledWith(
        'prof-1',
        'turma-1',
        'aluno-1',
        2,
      );
    });

    it('não avisa de novo em usos além do limite (evita spam)', async () => {
      await withTenant(() =>
        service.submit({
          alunoId: 'aluno-1',
          turmaEspelhadaId: 'turma-1',
          link: 'x1',
        }),
      );
      await withTenant(() =>
        service.submit({
          alunoId: 'aluno-1',
          turmaEspelhadaId: 'turma-1',
          link: 'x2',
        }),
      );
      await withTenant(() =>
        service.submit({
          alunoId: 'aluno-1',
          turmaEspelhadaId: 'turma-1',
          link: 'x3',
        }),
      );

      expect(
        notificationsService.notifyContingencySignal,
      ).toHaveBeenCalledTimes(1);
    });

    it('não deixa a entrega falhar se a notificação der erro', async () => {
      notificationsService.notifyContingencySignal.mockRejectedValue(
        new Error('falha ao notificar'),
      );
      await withTenant(() =>
        service.submit({
          alunoId: 'aluno-1',
          turmaEspelhadaId: 'turma-1',
          link: 'x1',
        }),
      );

      const entrega = await withTenant(() =>
        service.submit({
          alunoId: 'aluno-1',
          turmaEspelhadaId: 'turma-1',
          link: 'x2',
        }),
      );

      expect(entrega.link).toBe('x2');
    });

    it('contabiliza turmas separadamente: usar contingência em turmas diferentes não soma para o limite', async () => {
      await withTenant(() =>
        service.submit({
          alunoId: 'aluno-1',
          turmaEspelhadaId: 'turma-1',
          link: 'x1',
        }),
      );
      await withTenant(() =>
        service.submit({
          alunoId: 'aluno-1',
          turmaEspelhadaId: 'turma-2',
          link: 'x2',
        }),
      );

      expect(
        notificationsService.notifyContingencySignal,
      ).not.toHaveBeenCalled();
    });
  });
});
