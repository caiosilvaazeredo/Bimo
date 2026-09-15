import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { TokenEncryptionService } from '../crypto/token-encryption.service';
import { ExternalAccountsService } from './external-accounts.service';
import { ExternalAccount } from './external-account.entity';
import { ExternalProvider } from './external-provider.enum';

function buildRepositoryMock() {
  const store = new Map<string, ExternalAccount>();

  return {
    findOne: jest.fn(async ({ where }: any) => {
      for (const account of store.values()) {
        if (
          account.tenantId === where.tenantId &&
          (where.id === undefined || account.id === where.id) &&
          (where.professorId === undefined ||
            account.professorId === where.professorId) &&
          (where.provider === undefined || account.provider === where.provider)
        ) {
          return account;
        }
      }
      return null;
    }),
    create: jest.fn(
      (data: Partial<ExternalAccount>) =>
        ({ id: `acc-${store.size + 1}`, ...data }) as ExternalAccount,
    ),
    save: jest.fn(async (entity: ExternalAccount) => {
      store.set(entity.id, entity);
      return entity;
    }),
    delete: jest.fn(async ({ tenantId, professorId, provider }: any) => {
      const matches = [...store.values()].filter(
        (a) =>
          a.tenantId === tenantId &&
          a.professorId === professorId &&
          (provider === undefined || a.provider === provider),
      );
      matches.forEach((a) => store.delete(a.id));
      return { affected: matches.length };
    }),
    find: jest.fn(async ({ where }: any) =>
      [...store.values()].filter(
        (a) =>
          a.tenantId === where.tenantId && a.professorId === where.professorId,
      ),
    ),
    count: jest.fn(
      async ({ where }: any) =>
        [...store.values()].filter(
          (a) =>
            a.tenantId === where.tenantId &&
            a.professorId === where.professorId &&
            a.provider === where.provider,
        ).length,
    ),
    update: jest.fn(
      async ({ id, tenantId }: any, patch: Partial<ExternalAccount>) => {
        const match = [...store.values()].find(
          (a) => a.id === id && a.tenantId === tenantId,
        );
        if (match) Object.assign(match, patch);
      },
    ),
  } as unknown as Repository<ExternalAccount>;
}

function buildTokenEncryption(): TokenEncryptionService {
  const config = {
    get: jest.fn().mockReturnValue(randomBytes(32).toString('base64')),
  } as unknown as ConfigService;
  const service = new TokenEncryptionService(config);
  service.onModuleInit();
  return service;
}

describe('ExternalAccountsService', () => {
  const TENANT = 'tenant-1';
  let service: ExternalAccountsService;
  let repository: Repository<ExternalAccount>;

  beforeEach(() => {
    repository = buildRepositoryMock();
    service = new ExternalAccountsService(repository, buildTokenEncryption());
  });

  const withTenant = <T>(fn: () => Promise<T>) =>
    TenantContext.run({ tenantId: TENANT }, fn);

  it('vincula uma conta Google nova e nunca guarda o token em texto plano', async () => {
    const account = await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.GOOGLE,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'access-token-secreto',
        refreshToken: 'refresh-token-secreto',
        scopes: ['classroom.courses'],
        expiresAt: null,
      }),
    );

    expect(account.accessTokenEncrypted).not.toContain('access-token-secreto');
    expect(account.refreshTokenEncrypted).not.toContain(
      'refresh-token-secreto',
    );
  });

  it('um professor pode vincular Google e Microsoft simultaneamente (RF-AUTH-03)', async () => {
    await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.GOOGLE,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'tok-google',
        refreshToken: null,
        scopes: [],
        expiresAt: null,
      }),
    );
    await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.MICROSOFT,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'tok-microsoft',
        refreshToken: null,
        scopes: [],
        expiresAt: null,
      }),
    );

    const hasGoogle = await withTenant(() =>
      service.hasProvider('prof-1', ExternalProvider.GOOGLE),
    );
    const hasMicrosoft = await withTenant(() =>
      service.hasProvider('prof-1', ExternalProvider.MICROSOFT),
    );

    expect(hasGoogle).toBe(true);
    expect(hasMicrosoft).toBe(true);
  });

  it('religar o mesmo provider atualiza o token em vez de duplicar', async () => {
    await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.GOOGLE,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'tok-antigo',
        refreshToken: null,
        scopes: [],
        expiresAt: null,
      }),
    );
    await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.GOOGLE,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'tok-novo',
        refreshToken: null,
        scopes: [],
        expiresAt: null,
      }),
    );

    const accounts = await withTenant(() => service.listByProfessor('prof-1'));
    expect(accounts).toHaveLength(1);
    expect(service.getDecryptedAccessToken(accounts[0])).toBe('tok-novo');
  });

  it('desvincula uma conta sem apagar as demais (RF-AUTH-03)', async () => {
    await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.GOOGLE,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'tok-google',
        refreshToken: null,
        scopes: [],
        expiresAt: null,
      }),
    );
    await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.MICROSOFT,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'tok-microsoft',
        refreshToken: null,
        scopes: [],
        expiresAt: null,
      }),
    );

    await withTenant(() => service.unlink('prof-1', ExternalProvider.GOOGLE));

    const remaining = await withTenant(() => service.listByProfessor('prof-1'));
    expect(remaining).toHaveLength(1);
    expect(remaining[0].provider).toBe(ExternalProvider.MICROSOFT);
  });

  it('lança NotFoundException ao desvincular provider inexistente', async () => {
    await expect(
      withTenant(() => service.unlink('prof-1', ExternalProvider.GOOGLE)),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removeAllForProfessor remove todas as contas do titular (RNF-PRIV-03)', async () => {
    await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.GOOGLE,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'tok',
        refreshToken: null,
        scopes: [],
        expiresAt: null,
      }),
    );

    await withTenant(() => service.removeAllForProfessor('prof-1'));

    const remaining = await withTenant(() => service.listByProfessor('prof-1'));
    expect(remaining).toHaveLength(0);
  });

  it('findById retorna a conta e null quando não encontrada', async () => {
    const account = await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.GOOGLE,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'tok',
        refreshToken: null,
        scopes: [],
        expiresAt: null,
      }),
    );

    const found = await withTenant(() => service.findById(account.id));
    const notFound = await withTenant(() => service.findById('inexistente'));

    expect(found?.id).toBe(account.id);
    expect(notFound).toBeNull();
  });

  it('markNeedsReauth marca a conta como precisando reautenticação (RF-AUTH-04)', async () => {
    const account = await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.GOOGLE,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'tok',
        refreshToken: null,
        scopes: [],
        expiresAt: null,
      }),
    );

    await withTenant(() => service.markNeedsReauth(account.id));

    const updated = await withTenant(() => service.findById(account.id));
    expect(updated?.needsReauth).toBe(true);
  });

  it('getDecryptedRefreshToken retorna null quando não há refresh token', async () => {
    const account = await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.GOOGLE,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'tok',
        refreshToken: null,
        scopes: [],
        expiresAt: null,
      }),
    );

    expect(service.getDecryptedRefreshToken(account)).toBeNull();
  });

  it('getDecryptedRefreshToken decodifica quando há refresh token', async () => {
    const account = await withTenant(() =>
      service.link({
        professorId: 'prof-1',
        provider: ExternalProvider.GOOGLE,
        externalAccountEmail: 'prof@escola.edu.br',
        accessToken: 'tok',
        refreshToken: 'refresh-secreto',
        scopes: [],
        expiresAt: null,
      }),
    );

    expect(service.getDecryptedRefreshToken(account)).toBe('refresh-secreto');
  });

  describe('updateTokensAfterRefresh (RF-AUTH-04)', () => {
    it('atualiza o access token e mantém o refresh token quando não informado', async () => {
      const account = await withTenant(() =>
        service.link({
          professorId: 'prof-1',
          provider: ExternalProvider.GOOGLE,
          externalAccountEmail: 'prof@escola.edu.br',
          accessToken: 'tok-antigo',
          refreshToken: 'refresh-antigo',
          scopes: [],
          expiresAt: null,
        }),
      );
      const expiresAt = new Date('2026-01-01T00:00:00.000Z');

      await withTenant(() =>
        service.updateTokensAfterRefresh(account.id, {
          accessToken: 'tok-novo',
          expiresAt,
        }),
      );

      const updated = await withTenant(() => service.findById(account.id));
      expect(service.getDecryptedAccessToken(updated!)).toBe('tok-novo');
      expect(service.getDecryptedRefreshToken(updated!)).toBe('refresh-antigo');
      expect(updated?.needsReauth).toBe(false);
      expect(updated?.expiresAt).toEqual(expiresAt);
    });

    it('atualiza também o refresh token quando informado', async () => {
      const account = await withTenant(() =>
        service.link({
          professorId: 'prof-1',
          provider: ExternalProvider.GOOGLE,
          externalAccountEmail: 'prof@escola.edu.br',
          accessToken: 'tok-antigo',
          refreshToken: 'refresh-antigo',
          scopes: [],
          expiresAt: null,
        }),
      );

      await withTenant(() =>
        service.updateTokensAfterRefresh(account.id, {
          accessToken: 'tok-novo',
          refreshToken: 'refresh-novo',
          expiresAt: null,
        }),
      );

      const updated = await withTenant(() => service.findById(account.id));
      expect(service.getDecryptedRefreshToken(updated!)).toBe('refresh-novo');
    });
  });
});
