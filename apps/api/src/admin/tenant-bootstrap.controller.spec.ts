import { TenantBootstrapController } from './tenant-bootstrap.controller';
import { ProfessorRole } from '../professor/professor-role.enum';

describe('TenantBootstrapController (RF-ADMIN-01)', () => {
  const tenantsService = {
    create: jest.fn(),
  };
  const professorsService = {
    createWithRole: jest.fn().mockResolvedValue(undefined),
  };

  let controller: TenantBootstrapController;

  beforeEach(() => {
    jest.clearAllMocks();
    professorsService.createWithRole.mockResolvedValue(undefined);
    controller = new TenantBootstrapController(
      tenantsService as any,
      professorsService as any,
    );
  });

  it('cria o tenant e o admin institucional inicial', async () => {
    tenantsService.create.mockResolvedValue({ id: 'tenant-1', name: 'UFRJ' });

    const result = await controller.bootstrap({
      name: 'UFRJ',
      slug: 'ufrj',
      adminEmail: 'admin@ufrj.br',
      adminDisplayName: 'Admin',
    });

    expect(result).toEqual({ id: 'tenant-1', name: 'UFRJ' });
    expect(tenantsService.create).toHaveBeenCalledWith({
      name: 'UFRJ',
      slug: 'ufrj',
    });
    expect(professorsService.createWithRole).toHaveBeenCalledWith({
      institutionalEmail: 'admin@ufrj.br',
      displayName: 'Admin',
      role: ProfessorRole.INSTITUTIONAL_ADMIN,
    });
  });
});
