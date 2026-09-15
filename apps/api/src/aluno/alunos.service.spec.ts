import { NotFoundException } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { AlunosService } from './alunos.service';

function buildRepositoryMock() {
  const store = new Map<string, any>();
  let counter = 0;
  return {
    create: jest.fn((data: any) => ({ id: `aluno-${++counter}`, ...data })),
    save: jest.fn(async (entity: any) => {
      store.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => {
      for (const item of store.values()) {
        if (
          item.tenantId === where.tenantId &&
          (where.id === undefined || item.id === where.id) &&
          (where.institutionalEmail === undefined ||
            item.institutionalEmail === where.institutionalEmail)
        ) {
          return item;
        }
      }
      return null;
    }),
    update: jest.fn(async ({ id, tenantId }: any, patch: any) => {
      const item = [...store.values()].find(
        (a) => a.id === id && a.tenantId === tenantId,
      );
      if (item) Object.assign(item, patch);
    }),
    _store: store,
  };
}

describe('AlunosService (RF-STU-01)', () => {
  const TENANT = 'tenant-1';
  let repository: ReturnType<typeof buildRepositoryMock>;
  let service: AlunosService;

  beforeEach(() => {
    repository = buildRepositoryMock();
    service = new AlunosService(repository as any);
  });

  const withTenant = <T>(fn: () => Promise<T>) =>
    TenantContext.run({ tenantId: TENANT }, fn);

  it('cria um aluno novo por e-mail institucional', async () => {
    const aluno = await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'aluno@escola.edu.br',
        displayName: 'Aluno',
      }),
    );

    expect(aluno.institutionalEmail).toBe('aluno@escola.edu.br');
  });

  it('reconcilia pelo mesmo e-mail em vez de duplicar', async () => {
    const first = await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'aluno@escola.edu.br',
        displayName: 'Aluno',
      }),
    );
    const second = await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'aluno@escola.edu.br',
        displayName: 'Aluno',
      }),
    );

    expect(second.id).toBe(first.id);
  });

  it('findById retorna o aluno encontrado', async () => {
    const created = await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'aluno@escola.edu.br',
        displayName: 'Aluno',
      }),
    );

    const found = await withTenant(() => service.findById(created.id));

    expect(found.id).toBe(created.id);
  });

  it('findById lança NotFoundException quando não encontra o aluno', async () => {
    await expect(
      withTenant(() => service.findById('inexistente')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('anonymize apaga e-mail/nome do aluno (RNF-PRIV-03)', async () => {
    const created = await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'aluno@escola.edu.br',
        displayName: 'Aluno',
      }),
    );

    await withTenant(() => service.anonymize(created.id));

    const updated = repository._store.get(created.id);
    expect(updated.institutionalEmail).toBe(
      `titular-removido-${created.id}@anonimizado.bimo`,
    );
    expect(updated.displayName).toBe('Titular removido a pedido (LGPD)');
  });
});
