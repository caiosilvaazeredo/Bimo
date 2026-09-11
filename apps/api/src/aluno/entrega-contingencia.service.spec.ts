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

  beforeEach(() => {
    repository = buildRepositoryMock();
    matriculaService = { isEnrolled: jest.fn() };
    tenantsService = { findById: jest.fn() };
    service = new EntregaContingenciaService(
      repository as any,
      matriculaService,
      tenantsService,
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
});
