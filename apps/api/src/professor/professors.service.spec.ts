import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { ProfessorsService } from './professors.service';
import { ProfessorRole } from './professor-role.enum';

function buildRepositoryMock() {
  const store = new Map<string, any>();
  let counter = 0;
  return {
    create: jest.fn((data: any) => ({ id: `prof-${++counter}`, ...data })),
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
    find: jest.fn(async ({ where }: any) =>
      [...store.values()].filter((p) => p.tenantId === where.tenantId),
    ),
    update: jest.fn(async ({ id, tenantId }: any, patch: any) => {
      const item = [...store.values()].find(
        (p) => p.id === id && p.tenantId === tenantId,
      );
      if (item) Object.assign(item, patch);
    }),
    _store: store,
  };
}

describe('ProfessorsService', () => {
  const TENANT = 'tenant-1';
  let repository: ReturnType<typeof buildRepositoryMock>;
  let service: ProfessorsService;

  beforeEach(() => {
    repository = buildRepositoryMock();
    service = new ProfessorsService(repository as any);
  });

  const withTenant = <T>(fn: () => Promise<T>) =>
    TenantContext.run({ tenantId: TENANT }, fn);

  it('bloqueia login de professor revogado (RF-ADMIN-05)', async () => {
    const professor = await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'p@escola.edu.br',
        displayName: 'Prof',
      }),
    );
    await withTenant(() => service.revoke(professor.id));

    await expect(
      withTenant(() =>
        service.findOrCreateByInstitutionalEmail({
          institutionalEmail: 'p@escola.edu.br',
          displayName: 'Prof',
        }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('revogar um professor não afeta os demais (RF-ADMIN-05)', async () => {
    const a = await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'a@escola.edu.br',
        displayName: 'A',
      }),
    );
    await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'b@escola.edu.br',
        displayName: 'B',
      }),
    );

    await withTenant(() => service.revoke(a.id));

    const stillWorks = await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'b@escola.edu.br',
        displayName: 'B',
      }),
    );
    expect(stillWorks.institutionalEmail).toBe('b@escola.edu.br');
  });

  it('createWithRole pré-cadastra um admin institucional (RF-ADMIN-01)', async () => {
    const admin = await withTenant(() =>
      service.createWithRole({
        institutionalEmail: 'admin@escola.edu.br',
        displayName: 'Admin',
        role: ProfessorRole.INSTITUTIONAL_ADMIN,
      }),
    );

    expect(admin.role).toBe(ProfessorRole.INSTITUTIONAL_ADMIN);

    const foundOnLogin = await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'admin@escola.edu.br',
        displayName: 'Admin',
      }),
    );
    expect(foundOnLogin.id).toBe(admin.id);
    expect(foundOnLogin.role).toBe(ProfessorRole.INSTITUTIONAL_ADMIN);
  });

  it('findById retorna o professor encontrado', async () => {
    const created = await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'p@escola.edu.br',
        displayName: 'Prof',
      }),
    );

    const found = await withTenant(() => service.findById(created.id));

    expect(found.id).toBe(created.id);
  });

  it('findById lança NotFoundException quando não encontra o professor', async () => {
    await expect(
      withTenant(() => service.findById('inexistente')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('listByTenant lista apenas professores do tenant corrente', async () => {
    await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'a@escola.edu.br',
        displayName: 'A',
      }),
    );

    const list = await withTenant(() => service.listByTenant());

    expect(list).toHaveLength(1);
    expect(list[0].institutionalEmail).toBe('a@escola.edu.br');
  });

  it('anonymize apaga e-mail/nome e desativa o professor (RNF-PRIV-03)', async () => {
    const created = await withTenant(() =>
      service.findOrCreateByInstitutionalEmail({
        institutionalEmail: 'p@escola.edu.br',
        displayName: 'Prof',
      }),
    );

    await withTenant(() => service.anonymize(created.id));

    const updated = repository._store.get(created.id);
    expect(updated.institutionalEmail).toBe(
      `titular-removido-${created.id}@anonimizado.bimo`,
    );
    expect(updated.displayName).toBe('Titular removido a pedido (LGPD)');
    expect(updated.active).toBe(false);
  });
});
