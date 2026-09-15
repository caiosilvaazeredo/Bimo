import { NotFoundException } from '@nestjs/common';
import { TenantMiddleware } from './tenant.middleware';
import { TenantContext } from './tenant-context';

describe('TenantMiddleware', () => {
  const tenantsService = {
    findActiveBySlug: jest.fn(),
  };

  let middleware: TenantMiddleware;

  beforeEach(() => {
    jest.clearAllMocks();
    middleware = new TenantMiddleware(tenantsService as any);
  });

  function buildRes() {
    return {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  }

  it('retorna 400 quando o header x-tenant-slug está ausente', async () => {
    const req = { header: jest.fn().mockReturnValue(undefined) } as any;
    const res = buildRes();
    const next = jest.fn();

    await middleware.use(req, res as any, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: 'Header x-tenant-slug é obrigatório',
    });
    expect(next).not.toHaveBeenCalled();
    expect(tenantsService.findActiveBySlug).not.toHaveBeenCalled();
  });

  it('resolve o tenant, expõe o tenant_id no TenantContext e chama next()', async () => {
    tenantsService.findActiveBySlug.mockResolvedValue({ id: 'tenant-1' });
    const req = { header: jest.fn().mockReturnValue('ufrj') } as any;
    const res = buildRes();
    let capturedTenantId: string | undefined;
    const next = jest.fn(() => {
      capturedTenantId = TenantContext.getTenantId();
    });

    await middleware.use(req, res as any, next);

    expect(tenantsService.findActiveBySlug).toHaveBeenCalledWith('ufrj');
    expect(next).toHaveBeenCalled();
    expect(capturedTenantId).toBe('tenant-1');
  });

  it('propaga o NotFoundException quando o tenant não existe/está inativo', async () => {
    tenantsService.findActiveBySlug.mockRejectedValue(
      new NotFoundException('Tenant "x" não encontrado ou inativo'),
    );
    const req = { header: jest.fn().mockReturnValue('x') } as any;
    const res = buildRes();
    const next = jest.fn();

    await expect(middleware.use(req, res as any, next)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(next).not.toHaveBeenCalled();
  });
});
