import { FindOptionsWhere, ObjectLiteral, Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';

/**
 * Repositório base para toda entidade que pertence a um tenant.
 * Centraliza a injeção do tenant_id do TenantContext em find/save/delete,
 * para que nenhum repositório concreto precise (nem possa esquecer de)
 * filtrar manualmente por tenant_id (RNF-ARCH-01 / RNF-SEC-03).
 *
 * Entidades tenant-scoped devem ter uma coluna `tenantId`.
 */
export abstract class TenantScopedRepository<
  Entity extends ObjectLiteral & { tenantId: string },
> {
  protected constructor(private readonly repository: Repository<Entity>) {}

  private currentTenantId(): string {
    return TenantContext.getTenantId();
  }

  async findOneScoped(
    where: Omit<FindOptionsWhere<Entity>, 'tenantId'>,
  ): Promise<Entity | null> {
    return this.repository.findOne({
      where: {
        ...where,
        tenantId: this.currentTenantId(),
      } as FindOptionsWhere<Entity>,
    });
  }

  async findManyScoped(
    where: Omit<FindOptionsWhere<Entity>, 'tenantId'> = {} as Omit<
      FindOptionsWhere<Entity>,
      'tenantId'
    >,
  ): Promise<Entity[]> {
    return this.repository.find({
      where: {
        ...where,
        tenantId: this.currentTenantId(),
      } as FindOptionsWhere<Entity>,
    });
  }

  async saveScoped(
    entity: Omit<Entity, 'tenantId'> & Partial<Pick<Entity, 'tenantId'>>,
  ): Promise<Entity> {
    const withTenant = {
      ...entity,
      tenantId: this.currentTenantId(),
    } as Entity;
    return this.repository.save(withTenant);
  }
}
