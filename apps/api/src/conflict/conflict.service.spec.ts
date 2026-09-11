import { NotFoundException } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { ConflictService } from './conflict.service';

function buildRepositoryMock() {
  const store = new Map<string, any>();
  let counter = 0;
  return {
    create: jest.fn((data: any) => ({ id: `conflict-${++counter}`, ...data })),
    save: jest.fn(async (entity: any) => {
      store.set(entity.id, entity);
      return entity;
    }),
    findOne: jest.fn(async ({ where }: any) => {
      for (const item of store.values()) {
        if (
          item.tenantId === where.tenantId &&
          (where.id === undefined || item.id === where.id) &&
          (where.resourceType === undefined ||
            item.resourceType === where.resourceType) &&
          (where.resourceId === undefined ||
            item.resourceId === where.resourceId) &&
          (where.fieldName === undefined ||
            item.fieldName === where.fieldName) &&
          (where.resolved === undefined || item.resolved === where.resolved)
        ) {
          return item;
        }
      }
      return null;
    }),
    find: jest.fn(async ({ where }: any) =>
      [...store.values()].filter(
        (item) =>
          item.tenantId === where.tenantId &&
          (where.resolved === undefined || item.resolved === where.resolved) &&
          (where.resourceType === undefined ||
            item.resourceType === where.resourceType) &&
          (where.resourceId === undefined ||
            item.resourceId === where.resourceId),
      ),
    ),
    _store: store,
  };
}

describe('ConflictService', () => {
  const TENANT = 'tenant-1';
  let repository: ReturnType<typeof buildRepositoryMock>;
  let service: ConflictService;

  beforeEach(() => {
    repository = buildRepositoryMock();
    service = new ConflictService(repository as any);
  });

  const withTenant = <T>(fn: () => Promise<T>) =>
    TenantContext.run({ tenantId: TENANT }, fn);

  it('cria um conflito novo com as duas versões registradas', async () => {
    const conflict = await withTenant(() =>
      service.raise({
        resourceType: 'TURMA_ESPELHADA',
        resourceId: 'turma-1',
        fieldName: 'name',
        googleValue: 'Turma A',
        googleUpdatedAt: new Date('2026-01-01'),
        microsoftValue: 'Turma A (editada)',
        microsoftUpdatedAt: new Date('2026-01-02'),
      }),
    );

    expect(conflict.resolved).toBe(false);
    expect(conflict.googleValue).toBe('Turma A');
    expect(conflict.microsoftValue).toBe('Turma A (editada)');
  });

  it('não duplica conflito aberto para o mesmo recurso/campo', async () => {
    const input = {
      resourceType: 'TURMA_ESPELHADA',
      resourceId: 'turma-1',
      fieldName: 'name',
      googleValue: 'A',
      googleUpdatedAt: null,
      microsoftValue: 'B',
      microsoftUpdatedAt: null,
    };
    const first = await withTenant(() => service.raise(input));
    const second = await withTenant(() => service.raise(input));

    expect(second.id).toBe(first.id);
    expect(repository._store.size).toBe(1);
  });

  it('resolve escolhendo o lado Google e nunca decide sozinho', async () => {
    const conflict = await withTenant(() =>
      service.raise({
        resourceType: 'TURMA_ESPELHADA',
        resourceId: 'turma-1',
        fieldName: 'name',
        googleValue: 'Valor Google',
        googleUpdatedAt: null,
        microsoftValue: 'Valor Microsoft',
        microsoftUpdatedAt: null,
      }),
    );

    const resolved = await withTenant(() =>
      service.resolve(conflict.id, 'GOOGLE'),
    );

    expect(resolved.resolved).toBe(true);
    expect(resolved.resolvedValue).toBe('Valor Google');
  });

  it('lança NotFoundException ao resolver conflito inexistente', async () => {
    await expect(
      withTenant(() => service.resolve('inexistente', 'GOOGLE')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
