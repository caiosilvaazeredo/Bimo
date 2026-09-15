import {
  GraphApiRateLimitedError,
  MicrosoftTeamsClient,
} from './microsoft-teams.client';

function mockFetchOnce(
  status: number,
  jsonBody?: unknown,
  ok = status >= 200 && status < 300,
) {
  return {
    ok,
    status,
    json: async () => jsonBody,
    text: async () => 'erro',
  };
}

describe('MicrosoftTeamsClient', () => {
  const originalFetch = global.fetch;
  let client: MicrosoftTeamsClient;

  beforeEach(() => {
    client = new MicrosoftTeamsClient();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getGroup (RF-MIG-01)', () => {
    it('retorna o grupo existente', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockFetchOnce(200, { id: 'g1', displayName: 'Turma A' }),
        ) as unknown as typeof fetch;

      const result = await client.getGroup('token', 'g1');

      expect(result).toEqual({ id: 'g1', displayName: 'Turma A' });
    });
  });

  describe('listMembers (RF-MIG-03/RF-INT-03)', () => {
    it('mapeia e filtra membros sem email/id', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockFetchOnce(200, {
          value: [
            { id: 'm1', mail: 'a@x.com' },
            { id: 'm2', userPrincipalName: 'b@x.com' },
            { mail: 'sem-id@x.com' },
          ],
        }),
      ) as unknown as typeof fetch;

      const result = await client.listMembers('token', 'g1');

      expect(result).toEqual([
        { email: 'a@x.com', microsoftUserId: 'm1' },
        { email: 'b@x.com', microsoftUserId: 'm2' },
      ]);
    });

    it('retorna lista vazia quando não há value no body', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockFetchOnce(200, {})) as unknown as typeof fetch;

      const result = await client.listMembers('token', 'g1');

      expect(result).toEqual([]);
    });
  });

  describe('createAssignment (RF-SYNC-01)', () => {
    it('cria e publica a tarefa, chamando o endpoint de publish', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          mockFetchOnce(200, { id: 'a1', webUrl: 'http://a1' }),
        )
        .mockResolvedValueOnce(mockFetchOnce(200, {}));
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await client.createAssignment('token', 'class-1', {
        title: 'Tarefa 1',
        description: 'desc',
        points: 10,
        materialLinks: ['http://material'],
      });

      expect(result).toEqual({ externalId: 'a1', webUrl: 'http://a1' });
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/assignments/a1/publish'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
  });

  describe('updateAssignment (RF-SYNC-02)', () => {
    it('envia PATCH com os campos atualizados', async () => {
      const fetchMock = jest.fn().mockResolvedValue(mockFetchOnce(200, {}));
      global.fetch = fetchMock as unknown as typeof fetch;

      await client.updateAssignment('token', 'class-1', 'a1', {
        title: 'Novo título',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assignments/a1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('deleteAssignment (RF-SYNC-06)', () => {
    it('chama DELETE na url esperada', async () => {
      const fetchMock = jest.fn().mockResolvedValue(mockFetchOnce(200, {}));
      global.fetch = fetchMock as unknown as typeof fetch;

      await client.deleteAssignment('token', 'class-1', 'a1');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/assignments/a1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('listAssignments (RF-MIG-02)', () => {
    it('mapeia o histórico de tarefas', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockFetchOnce(200, {
          value: [
            {
              id: 'a1',
              displayName: 'Tarefa 1',
              instructions: { content: 'desc' },
              dueDateTime: '2026-01-01T00:00:00.000Z',
              grading: { maxPoints: 10 },
              resources: [{ link: 'http://a' }, {}],
            },
            { id: 'a2', displayName: 'Sem detalhes' },
          ],
        }),
      ) as unknown as typeof fetch;

      const result = await client.listAssignments('token', 'class-1');

      expect(result).toEqual([
        {
          externalId: 'a1',
          title: 'Tarefa 1',
          description: 'desc',
          dueDateIso: '2026-01-01T00:00:00.000Z',
          points: 10,
          materialLinks: ['http://a'],
        },
        {
          externalId: 'a2',
          title: 'Sem detalhes',
          description: null,
          dueDateIso: null,
          points: null,
          materialLinks: [],
        },
      ]);
    });
  });

  describe('getAssignment (RF-SYNC-03)', () => {
    it('retorna o estado atual de uma tarefa', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockFetchOnce(200, { id: 'a1', displayName: 'Tarefa 1' }),
        ) as unknown as typeof fetch;

      const result = await client.getAssignment('token', 'class-1', 'a1');

      expect(result).toEqual({
        externalId: 'a1',
        title: 'Tarefa 1',
        description: null,
        dueDateIso: null,
        points: null,
        materialLinks: [],
      });
    });
  });

  describe('listAssignmentSubmissions (RF-MIG-02)', () => {
    it('mapeia e filtra submissions sem recipient', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockFetchOnce(200, {
          value: [
            {
              recipient: { userId: 'u1' },
              grade: { points: 9 },
              status: 'returned',
            },
            { recipient: {} },
          ],
        }),
      ) as unknown as typeof fetch;

      const result = await client.listAssignmentSubmissions(
        'token',
        'class-1',
        'a1',
      );

      expect(result).toEqual([
        { microsoftUserId: 'u1', points: 9, status: 'returned' },
      ]);
    });
  });

  describe('setGrade (RF-SYNC-04)', () => {
    it('busca a submission do aluno e aplica a nota', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          mockFetchOnce(200, {
            value: [{ id: 'sub-1', recipient: { userId: 'u1' } }],
          }),
        )
        .mockResolvedValueOnce(mockFetchOnce(200, {}));
      global.fetch = fetchMock as unknown as typeof fetch;

      await client.setGrade('token', 'class-1', 'a1', 'u1', 9.5);

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/submissions/sub-1'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });

    it('lança erro quando não encontra submission do aluno', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockFetchOnce(200, { value: [] }),
        ) as unknown as typeof fetch;

      await expect(
        client.setGrade('token', 'class-1', 'a1', 'u1', 9),
      ).rejects.toThrow(/Nenhuma submission encontrada/);
    });
  });

  describe('createTeamFromGroup (via createTeam)', () => {
    it('retorna webUrl null quando o Graph não retorna corpo válido', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          mockFetchOnce(200, { id: 'g1', displayName: 'Turma A' }),
        )
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => {
            throw new Error('sem corpo');
          },
        });
      global.fetch = fetchMock as unknown as typeof fetch;

      const result = await client.createTeam('token', { name: 'Turma A' });

      expect(result).toEqual({
        externalId: 'g1',
        name: 'Turma A',
        webUrl: null,
      });
    });
  });

  describe('erros de rede/HTTP compartilhados entre métodos', () => {
    it('trata 429 como rate limit em getGroup', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockFetchOnce(429, undefined, false),
        ) as unknown as typeof fetch;

      await expect(client.getGroup('token', 'g1')).rejects.toBeInstanceOf(
        GraphApiRateLimitedError,
      );
    });

    it('trata 503 como rate limit em listMembers', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockFetchOnce(503, undefined, false),
        ) as unknown as typeof fetch;

      await expect(client.listMembers('token', 'g1')).rejects.toBeInstanceOf(
        GraphApiRateLimitedError,
      );
    });

    it('lança erro genérico para status de falha não relacionado a rate limit', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockFetchOnce(500, undefined, false),
        ) as unknown as typeof fetch;

      await expect(
        client.deleteAssignment('token', 'class-1', 'a1'),
      ).rejects.toThrow(/HTTP 500/);
    });
  });
});
