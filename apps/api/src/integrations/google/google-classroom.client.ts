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

export interface RosterStudent {
  email: string;
  googleUserId: string;
}

export interface CreatedCourseWork {
  externalId: string;
  alternateLink: string | null;
}

export interface CourseWorkInput {
  title: string;
  description?: string;
  dueDateIso?: string | null;
  points?: number | null;
  materialLinks?: string[];
}

export interface ExistingCourseWork {
  externalId: string;
  title: string;
  description: string | null;
  dueDateIso: string | null;
  points: number | null;
  materialLinks: string[];
}

export interface ExistingSubmission {
  googleUserId: string;
  assignedGrade: number | null;
  late: boolean;
  state: string;
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

  /** RF-MIG-03/RF-INT-03: roster da turma, com o id do aluno no Google (necessário para lançar nota). */
  async listStudents(
    accessToken: string,
    courseId: string,
  ): Promise<RosterStudent[]> {
    const response = await this.request(
      accessToken,
      'GET',
      `${CLASSROOM_API_BASE}/courses/${courseId}/students`,
    );
    const body = (await response.json()) as {
      students?: {
        userId?: string;
        profile?: { id?: string; emailAddress?: string };
      }[];
    };
    return (body.students ?? [])
      .map((s) => ({
        email: s.profile?.emailAddress,
        googleUserId: s.userId ?? s.profile?.id,
      }))
      .filter((s): s is RosterStudent => Boolean(s.email && s.googleUserId));
  }

  /** RF-SYNC-01: publica a tarefa no Classroom. Materiais vão por link (RF-INT-04), nunca por cópia. */
  async createCourseWork(
    accessToken: string,
    courseId: string,
    input: CourseWorkInput,
  ): Promise<CreatedCourseWork> {
    const response = await this.request(
      accessToken,
      'POST',
      `${CLASSROOM_API_BASE}/courses/${courseId}/courseWork`,
      {
        title: input.title,
        description: input.description,
        workType: 'ASSIGNMENT',
        state: 'PUBLISHED',
        maxPoints: input.points ?? undefined,
        dueDate: input.dueDateIso ? toGoogleDate(input.dueDateIso) : undefined,
        dueTime: input.dueDateIso ? toGoogleTime(input.dueDateIso) : undefined,
        materials: (input.materialLinks ?? []).map((link) => ({
          link: { url: link },
        })),
      },
    );
    const body = (await response.json()) as {
      id: string;
      alternateLink?: string;
    };
    return { externalId: body.id, alternateLink: body.alternateLink ?? null };
  }

  /** RF-SYNC-02: edita a tarefa já publicada, preservando entregas/notas já lançadas. */
  async updateCourseWork(
    accessToken: string,
    courseId: string,
    courseWorkId: string,
    input: CourseWorkInput,
  ): Promise<void> {
    const updateMask = [
      'title',
      'description',
      'maxPoints',
      'dueDate',
      'dueTime',
    ].join(',');
    await this.request(
      accessToken,
      'PATCH',
      `${CLASSROOM_API_BASE}/courses/${courseId}/courseWork/${courseWorkId}?updateMask=${updateMask}`,
      {
        title: input.title,
        description: input.description,
        maxPoints: input.points ?? undefined,
        dueDate: input.dueDateIso ? toGoogleDate(input.dueDateIso) : undefined,
        dueTime: input.dueDateIso ? toGoogleTime(input.dueDateIso) : undefined,
      },
    );
  }

  /**
   * RF-SYNC-04: lança a nota do aluno. O Classroom cria uma StudentSubmission
   * por aluno automaticamente quando a tarefa é publicada; é preciso achar
   * o id dela (por userId) antes de poder aplicar a nota.
   */
  async setGrade(
    accessToken: string,
    courseId: string,
    courseWorkId: string,
    googleUserId: string,
    grade: number,
  ): Promise<void> {
    const listResponse = await this.request(
      accessToken,
      'GET',
      `${CLASSROOM_API_BASE}/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions?userId=${googleUserId}`,
    );
    const body = (await listResponse.json()) as {
      studentSubmissions?: { id: string }[];
    };
    const submissionId = body.studentSubmissions?.[0]?.id;
    if (!submissionId) {
      throw new Error(
        `Nenhuma StudentSubmission encontrada para userId=${googleUserId} na tarefa ${courseWorkId}`,
      );
    }

    await this.request(
      accessToken,
      'PATCH',
      `${CLASSROOM_API_BASE}/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions/${submissionId}?updateMask=assignedGrade,draftGrade`,
      { assignedGrade: grade, draftGrade: grade },
    );
  }

  /** RF-MIG-02: histórico de tarefas já publicadas na turma (para migração). */
  async listCourseWork(
    accessToken: string,
    courseId: string,
  ): Promise<ExistingCourseWork[]> {
    const response = await this.request(
      accessToken,
      'GET',
      `${CLASSROOM_API_BASE}/courses/${courseId}/courseWork`,
    );
    const body = (await response.json()) as {
      courseWork?: {
        id: string;
        title: string;
        description?: string;
        maxPoints?: number;
        dueDate?: { year: number; month: number; day: number };
        dueTime?: { hours?: number; minutes?: number };
        materials?: { link?: { url?: string } }[];
      }[];
    };
    return (body.courseWork ?? []).map((cw) => ({
      externalId: cw.id,
      title: cw.title,
      description: cw.description ?? null,
      dueDateIso: cw.dueDate
        ? fromGoogleDateTime(cw.dueDate, cw.dueTime)
        : null,
      points: cw.maxPoints ?? null,
      materialLinks: (cw.materials ?? [])
        .map((m) => m.link?.url)
        .filter((url): url is string => Boolean(url)),
    }));
  }

  /** RF-SYNC-03: estado atual de uma tarefa específica, para checar divergência. */
  async getCourseWork(
    accessToken: string,
    courseId: string,
    courseWorkId: string,
  ): Promise<ExistingCourseWork> {
    const response = await this.request(
      accessToken,
      'GET',
      `${CLASSROOM_API_BASE}/courses/${courseId}/courseWork/${courseWorkId}`,
    );
    const cw = (await response.json()) as {
      id: string;
      title: string;
      description?: string;
      maxPoints?: number;
      dueDate?: { year: number; month: number; day: number };
      dueTime?: { hours?: number; minutes?: number };
      materials?: { link?: { url?: string } }[];
    };
    return {
      externalId: cw.id,
      title: cw.title,
      description: cw.description ?? null,
      dueDateIso: cw.dueDate
        ? fromGoogleDateTime(cw.dueDate, cw.dueTime)
        : null,
      points: cw.maxPoints ?? null,
      materialLinks: (cw.materials ?? [])
        .map((m) => m.link?.url)
        .filter((url): url is string => Boolean(url)),
    };
  }

  /** RF-MIG-02: entregas/notas já lançadas para essa tarefa (para migração). */
  async listSubmissions(
    accessToken: string,
    courseId: string,
    courseWorkId: string,
  ): Promise<ExistingSubmission[]> {
    const response = await this.request(
      accessToken,
      'GET',
      `${CLASSROOM_API_BASE}/courses/${courseId}/courseWork/${courseWorkId}/studentSubmissions`,
    );
    const body = (await response.json()) as {
      studentSubmissions?: {
        userId: string;
        assignedGrade?: number;
        late?: boolean;
        state?: string;
      }[];
    };
    return (body.studentSubmissions ?? []).map((s) => ({
      googleUserId: s.userId,
      assignedGrade: s.assignedGrade ?? null,
      late: s.late ?? false,
      state: s.state ?? 'CREATED',
    }));
  }

  /** RF-SYNC-06: exclui a tarefa no Classroom (chamado só depois de confirmação explícita do professor). */
  async deleteCourseWork(
    accessToken: string,
    courseId: string,
    courseWorkId: string,
  ): Promise<void> {
    await this.request(
      accessToken,
      'DELETE',
      `${CLASSROOM_API_BASE}/courses/${courseId}/courseWork/${courseWorkId}`,
    );
  }

  private async request(
    accessToken: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
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

function toGoogleDate(iso: string): {
  year: number;
  month: number;
  day: number;
} {
  const date = new Date(iso);
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  };
}

function toGoogleTime(iso: string): { hours: number; minutes: number } {
  const date = new Date(iso);
  return { hours: date.getUTCHours(), minutes: date.getUTCMinutes() };
}

function fromGoogleDateTime(
  date: { year: number; month: number; day: number },
  time?: { hours?: number; minutes?: number },
): string {
  return new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day,
      time?.hours ?? 0,
      time?.minutes ?? 0,
    ),
  ).toISOString();
}
