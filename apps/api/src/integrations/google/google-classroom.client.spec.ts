import {
  GoogleApiRateLimitedError,
  GoogleClassroomClient,
} from './google-classroom.client';

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

describe('GoogleClassroomClient', () => {
  const originalFetch = global.fetch;
  let client: GoogleClassroomClient;

  beforeEach(() => {
    client = new GoogleClassroomClient();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getCourse (RF-MIG-01)', () => {
    it('retorna o curso existente', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockFetchOnce(200, {
          id: 'c1',
          name: 'Turma A',
          alternateLink: 'http://link',
        }),
      ) as unknown as typeof fetch;

      const result = await client.getCourse('token', 'c1');

      expect(result).toEqual({
        externalId: 'c1',
        name: 'Turma A',
        alternateLink: 'http://link',
      });
    });
  });

  describe('listStudents (RF-MIG-03/RF-INT-03)', () => {
    it('mapeia e filtra alunos sem email/id', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockFetchOnce(200, {
          students: [
            {
              userId: 'u1',
              profile: { emailAddress: 'a@x.com' },
            },
            { profile: { id: 'u2' } },
            {},
          ],
        }),
      ) as unknown as typeof fetch;

      const result = await client.listStudents('token', 'c1');

      expect(result).toEqual([{ email: 'a@x.com', googleUserId: 'u1' }]);
    });

    it('retorna lista vazia quando não há students no body', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockFetchOnce(200, {})) as unknown as typeof fetch;

      const result = await client.listStudents('token', 'c1');

      expect(result).toEqual([]);
    });
  });

  describe('createCourseWork (RF-SYNC-01)', () => {
    it('publica a tarefa e retorna o id externo', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockFetchOnce(200, { id: 'cw1', alternateLink: 'http://cw' }),
        ) as unknown as typeof fetch;

      const result = await client.createCourseWork('token', 'c1', {
        title: 'Tarefa 1',
        dueDateIso: '2026-01-01T10:30:00.000Z',
        points: 10,
        materialLinks: ['http://material'],
      });

      expect(result).toEqual({ externalId: 'cw1', alternateLink: 'http://cw' });
    });
  });

  describe('updateCourseWork (RF-SYNC-02)', () => {
    it('envia o PATCH com o updateMask esperado', async () => {
      const fetchMock = jest.fn().mockResolvedValue(mockFetchOnce(200, {}));
      global.fetch = fetchMock as unknown as typeof fetch;

      await client.updateCourseWork('token', 'c1', 'cw1', {
        title: 'Novo título',
      });

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining(
          'updateMask=title,description,maxPoints,dueDate,dueTime',
        ),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  describe('deleteCourseWork (RF-SYNC-06)', () => {
    it('chama DELETE na url esperada', async () => {
      const fetchMock = jest.fn().mockResolvedValue(mockFetchOnce(200, {}));
      global.fetch = fetchMock as unknown as typeof fetch;

      await client.deleteCourseWork('token', 'c1', 'cw1');

      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/courses/c1/courseWork/cw1'),
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });

  describe('listCourseWork (RF-MIG-02)', () => {
    it('mapeia o histórico de tarefas, com data/hora convertidas', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockFetchOnce(200, {
          courseWork: [
            {
              id: 'cw1',
              title: 'Tarefa 1',
              description: 'desc',
              maxPoints: 10,
              dueDate: { year: 2026, month: 1, day: 5 },
              dueTime: { hours: 23, minutes: 59 },
              materials: [{ link: { url: 'http://a' } }, {}],
            },
            { id: 'cw2', title: 'Sem prazo' },
          ],
        }),
      ) as unknown as typeof fetch;

      const result = await client.listCourseWork('token', 'c1');

      expect(result).toEqual([
        {
          externalId: 'cw1',
          title: 'Tarefa 1',
          description: 'desc',
          dueDateIso: new Date(Date.UTC(2026, 0, 5, 23, 59)).toISOString(),
          points: 10,
          materialLinks: ['http://a'],
        },
        {
          externalId: 'cw2',
          title: 'Sem prazo',
          description: null,
          dueDateIso: null,
          points: null,
          materialLinks: [],
        },
      ]);
    });
  });

  describe('getCourseWork (RF-SYNC-03)', () => {
    it('retorna o estado atual de uma tarefa', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockFetchOnce(200, {
          id: 'cw1',
          title: 'Tarefa 1',
        }),
      ) as unknown as typeof fetch;

      const result = await client.getCourseWork('token', 'c1', 'cw1');

      expect(result).toEqual({
        externalId: 'cw1',
        title: 'Tarefa 1',
        description: null,
        dueDateIso: null,
        points: null,
        materialLinks: [],
      });
    });
  });

  describe('listSubmissions (RF-MIG-02)', () => {
    it('mapeia entregas com defaults quando campos faltam', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        mockFetchOnce(200, {
          studentSubmissions: [
            { userId: 'u1', assignedGrade: 9, late: true, state: 'RETURNED' },
            { userId: 'u2' },
          ],
        }),
      ) as unknown as typeof fetch;

      const result = await client.listSubmissions('token', 'c1', 'cw1');

      expect(result).toEqual([
        { googleUserId: 'u1', assignedGrade: 9, late: true, state: 'RETURNED' },
        {
          googleUserId: 'u2',
          assignedGrade: null,
          late: false,
          state: 'CREATED',
        },
      ]);
    });
  });

  describe('setGrade (RF-SYNC-04)', () => {
    it('busca a submission do aluno e aplica a nota', async () => {
      const fetchMock = jest
        .fn()
        .mockResolvedValueOnce(
          mockFetchOnce(200, { studentSubmissions: [{ id: 'sub-1' }] }),
        )
        .mockResolvedValueOnce(mockFetchOnce(200, {}));
      global.fetch = fetchMock as unknown as typeof fetch;

      await client.setGrade('token', 'c1', 'cw1', 'u1', 9.5);

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('/studentSubmissions/sub-1'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify({ assignedGrade: 9.5, draftGrade: 9.5 }),
        }),
      );
    });

    it('lança erro quando não encontra StudentSubmission do aluno', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockFetchOnce(200, { studentSubmissions: [] }),
        ) as unknown as typeof fetch;

      await expect(
        client.setGrade('token', 'c1', 'cw1', 'u1', 9),
      ).rejects.toThrow(/Nenhuma StudentSubmission encontrada/);
    });
  });

  describe('erros de rede/HTTP compartilhados entre métodos', () => {
    it('trata 429 como rate limit em getCourse', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockFetchOnce(429, undefined, false),
        ) as unknown as typeof fetch;

      await expect(client.getCourse('token', 'c1')).rejects.toBeInstanceOf(
        GoogleApiRateLimitedError,
      );
    });

    it('trata 503 como rate limit em listStudents', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockFetchOnce(503, undefined, false),
        ) as unknown as typeof fetch;

      await expect(client.listStudents('token', 'c1')).rejects.toBeInstanceOf(
        GoogleApiRateLimitedError,
      );
    });

    it('lança erro genérico para status de falha não relacionado a rate limit', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockFetchOnce(500, undefined, false),
        ) as unknown as typeof fetch;

      await expect(
        client.deleteCourseWork('token', 'c1', 'cw1'),
      ).rejects.toThrow(/HTTP 500/);
    });
  });
});
