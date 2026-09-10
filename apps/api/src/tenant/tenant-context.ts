import { AsyncLocalStorage } from 'node:async_hooks';

export interface TenantContextStore {
  tenantId: string;
}

/**
 * Carrega o tenant_id da requisição atual por toda a call chain,
 * sem precisar passá-lo explicitamente por cada camada.
 * Toda query de dados de tenant deve ler daqui via TenantContext.getTenantId().
 */
export class TenantContext {
  private static readonly storage = new AsyncLocalStorage<TenantContextStore>();

  static run<T>(store: TenantContextStore, fn: () => T): T {
    return this.storage.run(store, fn);
  }

  static getTenantId(): string {
    const store = this.storage.getStore();
    if (!store) {
      throw new Error(
        'TenantContext acessado fora de uma requisição com tenant resolvido. ' +
          'Verifique se o TenantMiddleware está aplicado à rota.',
      );
    }
    return store.tenantId;
  }

  static tryGetTenantId(): string | undefined {
    return this.storage.getStore()?.tenantId;
  }
}
