import { ConfigService } from '@nestjs/config';
import { MicrosoftTokenRefresher } from './microsoft-token-refresher';
import { ExternalProvider } from '../../professor/external-provider.enum';

describe('MicrosoftTokenRefresher', () => {
  const originalFetch = global.fetch;
  const config = {
    get: jest.fn((key: string) => `${key}-value`),
  } as unknown as ConfigService;

  let refresher: MicrosoftTokenRefresher;

  beforeEach(() => {
    refresher = new MicrosoftTokenRefresher(config);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('expõe o provider correto', () => {
    expect(refresher.provider).toBe(ExternalProvider.MICROSOFT);
  });

  it('renova o token e converte expires_in em Date', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: 'novo-access',
        refresh_token: 'novo-refresh',
        expires_in: 3600,
      }),
    }) as unknown as typeof fetch;

    const before = Date.now();
    const result = await refresher.refresh('refresh-antigo');

    expect(result.accessToken).toBe('novo-access');
    expect(result.refreshToken).toBe('novo-refresh');
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(result.expiresAt!.getTime()).toBeGreaterThanOrEqual(
      before + 3600 * 1000,
    );
  });

  it('usa null para refreshToken/expiresAt quando ausentes na resposta', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ access_token: 'novo-access' }),
    }) as unknown as typeof fetch;

    const result = await refresher.refresh('refresh-antigo');

    expect(result.refreshToken).toBeNull();
    expect(result.expiresAt).toBeNull();
  });

  it('lança erro quando a chamada falha', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 401 }) as unknown as typeof fetch;

    await expect(refresher.refresh('refresh-antigo')).rejects.toThrow(
      /HTTP 401/,
    );
  });
});
