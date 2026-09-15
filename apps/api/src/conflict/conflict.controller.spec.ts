import { ConflictController } from './conflict.controller';

describe('ConflictController', () => {
  const conflictService = {
    listOpenByTenant: jest.fn(),
    resolve: jest.fn(),
  };

  let controller: ConflictController;
  const req = { user: { sub: 'prof-1', tenantId: 'tenant-1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new ConflictController(conflictService as any);
  });

  it('lista conflitos abertos do tenant', async () => {
    conflictService.listOpenByTenant.mockResolvedValue([{ id: 'conflict-1' }]);

    const result = await controller.list(req);

    expect(result).toEqual([{ id: 'conflict-1' }]);
    expect(conflictService.listOpenByTenant).toHaveBeenCalled();
  });

  it('resolve um conflito escolhendo um lado', async () => {
    conflictService.resolve.mockResolvedValue({
      id: 'conflict-1',
      resolved: true,
    });

    const result = await controller.resolve(req, 'conflict-1', {
      chosenSide: 'GOOGLE',
    });

    expect(result).toEqual({ id: 'conflict-1', resolved: true });
    expect(conflictService.resolve).toHaveBeenCalledWith(
      'conflict-1',
      'GOOGLE',
    );
  });
});
