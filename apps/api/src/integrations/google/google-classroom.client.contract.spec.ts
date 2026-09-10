import {
  GoogleApiRateLimitedError,
  GoogleClassroomClient,
} from './google-classroom.client';
import * as createCourseFixture from './__fixtures__/create-course.response.json';

/**
 * Contract test (RNF-MAINT-02): valida que o client continua sabendo
 * interpretar uma resposta real e gravada da Classroom API. Se o Google
 * mudar o formato do payload, este teste quebra antes de afetar produção
 * — sem depender de uma chamada de rede real em cada execução de CI.
 */
describe('GoogleClassroomClient (contract)', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('interpreta corretamente a resposta gravada de criação de curso', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => createCourseFixture,
    }) as unknown as typeof fetch;

    const client = new GoogleClassroomClient();
    const result = await client.createCourse('fake-access-token', {
      name: 'Turma Exemplo - Matemática',
    });

    expect(result).toEqual({
      externalId: '123456789012',
      name: 'Turma Exemplo - Matemática',
      alternateLink: 'https://classroom.google.com/c/MTIzNDU2Nzg5MDEy',
    });
  });

  it('trata 429 como rate limit para o motor de sincronização decidir o retry (RF-INT-05)', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 429 }) as unknown as typeof fetch;

    const client = new GoogleClassroomClient();
    await expect(
      client.createCourse('fake-access-token', { name: 'Turma' }),
    ).rejects.toBeInstanceOf(GoogleApiRateLimitedError);
  });

  it('trata 503 como rate limit', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue({ ok: false, status: 503 }) as unknown as typeof fetch;

    const client = new GoogleClassroomClient();
    await expect(
      client.createCourse('fake-access-token', { name: 'Turma' }),
    ).rejects.toBeInstanceOf(GoogleApiRateLimitedError);
  });

  it('lança erro genérico para outros status de falha', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Forbidden',
    }) as unknown as typeof fetch;

    const client = new GoogleClassroomClient();
    await expect(
      client.createCourse('fake-access-token', { name: 'Turma' }),
    ).rejects.toThrow(/HTTP 403/);
  });
});
