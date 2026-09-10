import { TenantContext } from './tenant-context';

describe('TenantContext', () => {
  it('lança erro quando acessado fora de uma requisição com tenant resolvido', () => {
    expect(() => TenantContext.getTenantId()).toThrow(/fora de uma requisição/);
  });

  it('retorna undefined em tryGetTenantId fora de contexto', () => {
    expect(TenantContext.tryGetTenantId()).toBeUndefined();
  });

  it('isola o tenant_id entre execuções concorrentes (async)', async () => {
    const results: string[] = [];

    const runFor = (tenantId: string) =>
      TenantContext.run({ tenantId }, async () => {
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 10));
        results.push(TenantContext.getTenantId());
      });

    await Promise.all([
      runFor('tenant-a'),
      runFor('tenant-b'),
      runFor('tenant-c'),
    ]);

    expect(results.sort()).toEqual(['tenant-a', 'tenant-b', 'tenant-c']);
  });

  it('não vaza tenant_id de um contexto pai para código fora do run()', () => {
    TenantContext.run({ tenantId: 'tenant-x' }, () => {
      expect(TenantContext.getTenantId()).toBe('tenant-x');
    });

    expect(TenantContext.tryGetTenantId()).toBeUndefined();
  });
});
