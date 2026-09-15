import { NotificationsController } from './notifications.controller';

describe('NotificationsController', () => {
  const notificationsService = {
    listForRecipient: jest.fn(),
    markRead: jest.fn(),
  };

  let controller: NotificationsController;
  const req = { user: { sub: 'prof-1', tenantId: 'tenant-1' } } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new NotificationsController(notificationsService as any);
  });

  it('lista notificações do destinatário autenticado', async () => {
    notificationsService.listForRecipient.mockResolvedValue([
      { id: 'notif-1' },
    ]);

    const result = await controller.list(req);

    expect(result).toEqual([{ id: 'notif-1' }]);
    expect(notificationsService.listForRecipient).toHaveBeenCalledWith(
      'prof-1',
    );
  });

  it('marca uma notificação como lida', async () => {
    notificationsService.markRead.mockResolvedValue({
      id: 'notif-1',
      read: true,
    });

    const result = await controller.markRead(req, 'notif-1');

    expect(result).toEqual({ id: 'notif-1', read: true });
    expect(notificationsService.markRead).toHaveBeenCalledWith('notif-1');
  });
});
