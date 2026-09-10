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
    const response = await fetch(`${CLASSROOM_API_BASE}/courses`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: input.name,
        section: input.section,
        ownerId: 'me',
        courseState: 'ACTIVE',
      }),
    });

    if (response.status === 429 || response.status === 503) {
      throw new GoogleApiRateLimitedError(response.status);
    }
    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Falha ao criar Course no Classroom: HTTP ${response.status} - ${body}`,
      );
      throw new Error(
        `Falha ao criar Course no Classroom: HTTP ${response.status}`,
      );
    }

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
}
