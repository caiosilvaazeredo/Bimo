import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { TenantsService } from './tenants.service';
import { TenantContext } from './tenant-context';

/**
 * Resolve o tenant da requisição e expõe o tenant_id pelo resto da call chain
 * via TenantContext (AsyncLocalStorage). Nenhuma query de dados de tenant deve
 * rodar fora desse contexto (RNF-ARCH-01 / RNF-SEC-03).
 *
 * TODO(Fase 1 - RF-AUTH): trocar a resolução por header pelo tenant_id
 * embutido no token JWT autenticado, mantendo o header só como fallback
 * de desenvolvimento/teste local.
 */
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  constructor(private readonly tenantsService: TenantsService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const slug = req.header('x-tenant-slug');
    if (!slug) {
      res.status(400).json({ message: 'Header x-tenant-slug é obrigatório' });
      return;
    }

    const tenant = await this.tenantsService.findActiveBySlug(slug);

    TenantContext.run({ tenantId: tenant.id }, () => next());
  }
}
