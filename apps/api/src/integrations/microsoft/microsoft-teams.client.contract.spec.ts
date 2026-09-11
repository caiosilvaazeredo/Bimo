import {
  GraphApiRateLimitedError,
  MicrosoftTeamsClient,
} from './microsoft-teams.client';
import * as createGroupFixture from './__fixtures__/create-group.response.json';
import * as createTeamFixture from './__fixtures__/create-team.response.json';

/**
 * Contract test (RNF-MAINT-02): valida que o client continua sabendo
 * interpretar respostas reais e gravadas do Microsoft Graph (grupo +
 * team), sem depender de chamada de rede real em cada execução de CI.
 */
describe('MicrosoftTeamsClient (contract)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('cria o grupo e o team a partir das respostas gravadas do Graph', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createGroupFixture,
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createTeamFixture,
      });
    global.fetch = fetchMock as unknown as typeof fetch;

    const client = new MicrosoftTeamsClient();
    const result = await client.createTeam('fake-access-token', {
      name: 'Turma Exemplo - Matemática',
    });

    expect(result).toEqual({
      externalId: '72f988bf-0000-1111-2222-2d7cd011db47',
      name: 'Turma Exemplo - Matemática',
      webUrl:
        'https://teams.microsoft.com/l/team/19%3Aabcdef1234567890%40thread.tacv2/conversations',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toContain('/groups');
    expect(fetchMock.mock.calls[1][0]).toContain('/team');
  });

  it('trata 429 como rate limit ao criar o grupo (RF-INT-05)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;

    const client = new MicrosoftTeamsClient();
    await expect(
      client.createTeam('fake-access-token', { name: 'Turma' }),
    ).rejects.toBeInstanceOf(GraphApiRateLimitedError);
  });

  it('trata 503 como rate limit ao criar o team a partir do grupo', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => createGroupFixture,
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      }) as unknown as typeof fetch;

    const client = new MicrosoftTeamsClient();
    await expect(
      client.createTeam('fake-access-token', { name: 'Turma' }),
    ).rejects.toBeInstanceOf(GraphApiRateLimitedError);
  });

  it('lança erro genérico para outros status de falha', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    }) as unknown as typeof fetch;

    const client = new MicrosoftTeamsClient();
    await expect(
      client.createTeam('fake-access-token', { name: 'Turma' }),
    ).rejects.toThrow(/HTTP 403/);
  });
});
