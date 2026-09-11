import { Injectable, Logger } from '@nestjs/common';

const CLASSROOM_API_BASE = 'https://classroom.googleapis.com/v1';

export class GoogleApiRateLimitedError extends Error {
  constructor(public readonly status: number) {
    super(`Google Classroom API rate limited (HTTP ${status})`);
  }
}

export interface CreatedCourse {
  externalId: string;
  name: string;
  alternateLink: string | null;
}

/**
 * Cliente da Google Classroom API. Isolado neste módulo (RNF-ARCH-03):
 * mudanças na API do Google nunca devem exigir alteração no cliente
 * Microsoft, e vice-versa.
 */
@Injectable()
export class GoogleClassroomClient {
  private readonly logger = new Logger(GoogleClassroomClient.name);

  /** RF-INT-01: cria o Course no Classroom correspondente à turma espelhada. */
  async createCourse(
    accessToken: string,
    input: { name: string; section?: string },
  ): Promise<CreatedCourse> {
    const response = await this.request(
      accessToken,
      'POST',
      `${CLASSROOM_API_BASE}/courses`,
      {
        name: input.name,
        section: input.section,
        ownerId: 'me',
        courseState: 'ACTIVE',
      },
    );

    const body = (await response.json()) as {
      id: string;
      name: string;
      alternateLink?: string;
    };
    return {
      externalId: body.id,
      name: body.name,
      alternateLink: body.alternateLink ?? null,
    };
  }

  /** RF-MIG-01: busca uma turma já existente no Classroom para vincular. */
  async getCourse(
    accessToken: string,
    courseId: string,
  ): Promise<CreatedCourse> {
    const response = await this.request(
      accessToken,
      'GET',
      `${CLASSROOM_API_BASE}/courses/${courseId}`,
    );
    const body = (await response.json()) as {
      id: string;
      name: string;
      alternateLink?: string;
    };
    return {
      externalId: body.id,
      name: body.name,
      alternateLink: body.alternateLink ?? null,
    };
  }

  /** RF-MIG-03: roster da turma existente, para reconciliar por e-mail. */
  async listStudentEmails(
    accessToken: string,
    courseId: string,
  ): Promise<string[]> {
    const response = await this.request(
      accessToken,
      'GET',
      `${CLASSROOM_API_BASE}/courses/${courseId}/students`,
    );
    const body = (await response.json()) as {
      students?: { profile?: { emailAddress?: string } }[];
    };
    return (body.students ?? [])
      .map((s) => s.profile?.emailAddress)
      .filter((email): email is string => Boolean(email));
  }

  private async request(
    accessToken: string,
    method: 'GET' | 'POST',
    url: string,
    body?: unknown,
  ): Promise<Response> {
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (response.status === 429 || response.status === 503) {
      throw new GoogleApiRateLimitedError(response.status);
    }
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `Falha na chamada à Classroom API (${url}): HTTP ${response.status} - ${text}`,
      );
      throw new Error(
        `Falha na chamada à Classroom API: HTTP ${response.status}`,
      );
    }
    return response;
  }
}
