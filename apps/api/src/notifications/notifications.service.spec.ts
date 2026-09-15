import { TenantContext } from '../tenant/tenant-context';
import { NotificationsService } from './notifications.service';
import { NotificationKind } from './notification.entity';
import { ExternalProvider } from '../professor/external-provider.enum';

function buildRepositoryMock() {
  const store = new Map<string, any>();
  let counter = 0;
  return {
    create: jest.fn((data: any) => ({ id: `notif-${++counter}`, ...data })),
    save: jest.fn(async (entity: any) => {
      store.set(entity.id, entity);
      return entity;
    }),
    find: jest.fn(async ({ where }: any) =>
      [...store.values()].filter(
        (n) =>
          n.tenantId === where.tenantId && n.recipientId === where.recipientId,
      ),
    ),
    update: jest.fn(async ({ id, tenantId }: any, patch: any) => {
      const item = [...store.values()].find(
        (n) => n.id === id && n.tenantId === tenantId,
      );
      if (item) Object.assign(item, patch);
    }),
    _store: store,
  };
}

describe('NotificationsService', () => {
  const TENANT = 'tenant-1';
  let repository: ReturnType<typeof buildRepositoryMock>;
  let service: NotificationsService;

  beforeEach(() => {
    repository = buildRepositoryMock();
    service = new NotificationsService(repository as any);
  });

  const withTenant = <T>(fn: () => Promise<T>) =>
    TenantContext.run({ tenantId: TENANT }, fn);

  it('cria notificação de reautenticação para o professor certo', async () => {
    await withTenant(() =>
      service.notifyReauthRequired('prof-1', ExternalProvider.GOOGLE),
    );

    const list = await withTenant(() => service.listForRecipient('prof-1'));
    expect(list).toHaveLength(1);
    expect(list[0].kind).toBe(NotificationKind.REAUTH_REQUIRED);
    expect(list[0].read).toBe(false);
  });

  it('cria notificação de conflito (RF-NOTIF-01)', async () => {
    await withTenant(() => service.notifyConflict('prof-1', 'turma-1'));

    const list = await withTenant(() => service.listForRecipient('prof-1'));
    expect(list[0].kind).toBe(NotificationKind.SYNC_CONFLICT);
  });

  it('markRead marca como lida', async () => {
    await withTenant(() => service.notifyConflict('prof-1', 'turma-1'));
    const [notif] = await withTenant(() => service.listForRecipient('prof-1'));

    await withTenant(() => service.markRead(notif.id));

    expect(repository._store.get(notif.id).read).toBe(true);
  });

  it('cria notificação de falha recorrente para o admin (RF-NOTIF-03)', async () => {
    await withTenant(() =>
      service.notifyAdminRecurringFailure('admin-1', 'falha ao sincronizar'),
    );

    const list = await withTenant(() => service.listForRecipient('admin-1'));
    expect(list[0].kind).toBe(NotificationKind.ADMIN_RECURRING_FAILURE);
    expect(list[0].message).toBe('falha ao sincronizar');
  });

  it('cria notificação de resumo periódico (RF-DASH-06)', async () => {
    await withTenant(() =>
      service.notifyPeriodicSummary('prof-1', 'resumo da semana'),
    );

    const list = await withTenant(() => service.listForRecipient('prof-1'));
    expect(list[0].kind).toBe(NotificationKind.PERIODIC_SUMMARY);
  });

  it('cria notificação de sinal de acesso de contingência (RF-STU-04/05)', async () => {
    await withTenant(() =>
      service.notifyContingencySignal('prof-1', 'turma-1', 'aluno-1', 3),
    );

    const list = await withTenant(() => service.listForRecipient('prof-1'));
    expect(list[0].kind).toBe(NotificationKind.CONTINGENCY_SIGNAL);
    expect(list[0].message).toContain('3 vezes');
  });
});
