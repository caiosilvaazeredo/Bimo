import { Injectable, Logger } from '@nestjs/common';

const GRAPH_API_BASE = 'https://graph.microsoft.com/v1.0';

export class GraphApiRateLimitedError extends Error {
  constructor(public readonly status: number) {
    super(`Microsoft Graph API rate limited (HTTP ${status})`);
  }
}

export interface CreatedTeam {
  externalId: string;
  name: string;
  /** RF-DASH-05: link nativo para abrir o Team direto no app do Teams. */
  webUrl: string | null;
}

interface GroupInfo {
  id: string;
  displayName: string;
}

export interface RosterMember {
  email: string;
  microsoftUserId: string;
}

export interface CreatedAssignment {
  externalId: string;
  webUrl: string | null;
}

export interface AssignmentInput {
  title: string;
  description?: string;
  dueDateIso?: string | null;
  points?: number | null;
  materialLinks?: string[];
}

export interface ExistingAssignment {
  externalId: string;
  title: string;
  description: string | null;
  dueDateIso: string | null;
  points: number | null;
  materialLinks: string[];
}

export interface ExistingSubmission {
  microsoftUserId: string;
  points: number | null;
  status: string;
}

/**
 * Cliente do Microsoft Graph para Teams/Education. Isolado neste módulo
 * (RNF-ARCH-03): mudanças na API do Microsoft nunca devem exigir
 * alteração no cliente Google, e vice-versa.
 *
 * Criar um Team no Graph é uma operação em duas etapas: primeiro o grupo
 * Microsoft 365, depois o Team sobre esse grupo (RF-INT-02).
 *
 * Simplificação assumida (validar contra um tenant EDU real antes de
 * produção): o id da "education class" usado para tarefas/assignments
 * é o mesmo id do grupo/Team criado em createTeam. Em muitos tenants
 * EDU a classe é provisionada junto com o grupo, mas isso não é
 * garantido pela documentação pública do Graph.
 */
@Injectable()
export class MicrosoftTeamsClient {
  private readonly logger = new Logger(MicrosoftTeamsClient.name);

  async createTeam(
    accessToken: string,
    input: { name: string; description?: string },
  ): Promise<CreatedTeam> {
    const group = await this.createGroup(accessToken, input);
    const webUrl = await this.createTeamFromGroup(accessToken, group.id);
    return { externalId: group.id, name: group.displayName, webUrl };
  }

  /** RF-MIG-01: busca um Team/grupo já existente para vincular. */
  async getGroup(accessToken: string, groupId: string): Promise<GroupInfo> {
    const response = await this.request(
      accessToken,
      'GET',
      `${GRAPH_API_BASE}/groups/${groupId}`,
    );
    return (await response.json()) as GroupInfo;
  }

  /** RF-MIG-03/RF-INT-03: roster do grupo, com o id do aluno no Graph (necessário para lançar nota). */
  async listMembers(
    accessToken: string,
    groupId: string,
  ): Promise<RosterMember[]> {
    const response = await this.request(
      accessToken,
      'GET',
      `${GRAPH_API_BASE}/groups/${groupId}/members`,
    );
    const body = (await response.json()) as {
      value?: { id: string; mail?: string; userPrincipalName?: string }[];
    };
    return (body.value ?? [])
      .map((member) => ({
        email: member.mail ?? member.userPrincipalName,
        microsoftUserId: member.id,
      }))
      .filter((m): m is RosterMember => Boolean(m.email && m.microsoftUserId));
  }

  /** RF-SYNC-01: publica a tarefa no Teams/Education. Materiais vão por link (RF-INT-04). */
  async createAssignment(
    accessToken: string,
    classId: string,
    input: AssignmentInput,
  ): Promise<CreatedAssignment> {
    const response = await this.request(
      accessToken,
      'POST',
      `${GRAPH_API_BASE}/education/classes/${classId}/assignments`,
      {
        displayName: input.title,
        instructions: input.description
          ? { contentType: 'text', content: input.description }
          : undefined,
        dueDateTime: input.dueDateIso ?? undefined,
        grading: input.points
          ? {
              '@odata.type':
                '#microsoft.graph.educationAssignmentPointsGradeType',
              maxPoints: input.points,
            }
          : undefined,
        resources: (input.materialLinks ?? []).map((link) => ({
          '@odata.type': '#microsoft.graph.educationLinkResource',
          link,
          displayName: link,
        })),
      },
    );
    const body = (await response.json()) as { id: string; webUrl?: string };

    await this.request(
      accessToken,
      'POST',
      `${GRAPH_API_BASE}/education/classes/${classId}/assignments/${body.id}/publish`,
    );

    return { externalId: body.id, webUrl: body.webUrl ?? null };
  }

  /** RF-SYNC-02: edita a tarefa já publicada, preservando entregas/notas já lançadas. */
  async updateAssignment(
    accessToken: string,
    classId: string,
    assignmentId: string,
    input: AssignmentInput,
  ): Promise<void> {
    await this.request(
      accessToken,
      'PATCH',
      `${GRAPH_API_BASE}/education/classes/${classId}/assignments/${assignmentId}`,
      {
        displayName: input.title,
        instructions: input.description
          ? { contentType: 'text', content: input.description }
          : undefined,
        dueDateTime: input.dueDateIso ?? undefined,
      },
    );
  }

  /**
   * RF-SYNC-04: lança a nota do aluno. Cada assignment tem uma submission
   * por aluno criada automaticamente; é preciso achar a dele antes de
   * poder aplicar a nota.
   */
  async setGrade(
    accessToken: string,
    classId: string,
    assignmentId: string,
    microsoftUserId: string,
    grade: number,
  ): Promise<void> {
    const listResponse = await this.request(
      accessToken,
      'GET',
      `${GRAPH_API_BASE}/education/classes/${classId}/assignments/${assignmentId}/submissions`,
    );
    const body = (await listResponse.json()) as {
      value?: { id: string; recipient?: { userId?: string } }[];
    };
    const submission = (body.value ?? []).find(
      (s) => s.recipient?.userId === microsoftUserId,
    );
    if (!submission) {
      throw new Error(
        `Nenhuma submission encontrada para userId=${microsoftUserId} na tarefa ${assignmentId}`,
      );
    }

    await this.request(
      accessToken,
      'PATCH',
      `${GRAPH_API_BASE}/education/classes/${classId}/assignments/${assignmentId}/submissions/${submission.id}`,
      {
        grade: {
          '@odata.type': '#microsoft.graph.educationAssignmentPointsGrade',
          points: grade,
        },
      },
    );
  }

  /** RF-MIG-02: histórico de tarefas já publicadas na turma (para migração). */
  async listAssignments(
    accessToken: string,
    classId: string,
  ): Promise<ExistingAssignment[]> {
    const response = await this.request(
      accessToken,
      'GET',
      `${GRAPH_API_BASE}/education/classes/${classId}/assignments`,
    );
    const body = (await response.json()) as {
      value?: {
        id: string;
        displayName: string;
        instructions?: { content?: string };
        dueDateTime?: string;
        grading?: { maxPoints?: number };
        resources?: { link?: string }[];
      }[];
    };
    return (body.value ?? []).map((a) => ({
      externalId: a.id,
      title: a.displayName,
      description: a.instructions?.content ?? null,
      dueDateIso: a.dueDateTime ?? null,
      points: a.grading?.maxPoints ?? null,
      materialLinks: (a.resources ?? [])
        .map((r) => r.link)
        .filter((link): link is string => Boolean(link)),
    }));
  }

  /** RF-SYNC-03: estado atual de uma tarefa específica, para checar divergência. */
  async getAssignment(
    accessToken: string,
    classId: string,
    assignmentId: string,
  ): Promise<ExistingAssignment> {
    const response = await this.request(
      accessToken,
      'GET',
      `${GRAPH_API_BASE}/education/classes/${classId}/assignments/${assignmentId}`,
    );
    const a = (await response.json()) as {
      id: string;
      displayName: string;
      instructions?: { content?: string };
      dueDateTime?: string;
      grading?: { maxPoints?: number };
      resources?: { link?: string }[];
    };
    return {
      externalId: a.id,
      title: a.displayName,
      description: a.instructions?.content ?? null,
      dueDateIso: a.dueDateTime ?? null,
      points: a.grading?.maxPoints ?? null,
      materialLinks: (a.resources ?? [])
        .map((r) => r.link)
        .filter((link): link is string => Boolean(link)),
    };
  }

  /** RF-MIG-02: entregas/notas já lançadas para essa tarefa (para migração). */
  async listAssignmentSubmissions(
    accessToken: string,
    classId: string,
    assignmentId: string,
  ): Promise<ExistingSubmission[]> {
    const response = await this.request(
      accessToken,
      'GET',
      `${GRAPH_API_BASE}/education/classes/${classId}/assignments/${assignmentId}/submissions`,
    );
    const body = (await response.json()) as {
      value?: {
        recipient?: { userId?: string };
        grade?: { points?: number };
        status?: string;
      }[];
    };
    return (body.value ?? [])
      .filter((s) => s.recipient?.userId)
      .map((s) => ({
        microsoftUserId: s.recipient!.userId as string,
        points: s.grade?.points ?? null,
        status: s.status ?? 'assigned',
      }));
  }

  private async createGroup(
    accessToken: string,
    input: { name: string; description?: string },
  ): Promise<GroupInfo> {
    const response = await this.request(
      accessToken,
      'POST',
      `${GRAPH_API_BASE}/groups`,
      {
        displayName: input.name,
        description: input.description,
        mailNickname:
          input.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 60) || 'turma',
        mailEnabled: false,
        securityEnabled: false,
        groupTypes: ['Unified'],
      },
    );
    return (await response.json()) as GroupInfo;
  }

  private async createTeamFromGroup(
    accessToken: string,
    groupId: string,
  ): Promise<string | null> {
    const response = await this.request(
      accessToken,
      'POST',
      `${GRAPH_API_BASE}/groups/${groupId}/team`,
      {},
    );
    const body = (await response.json().catch(() => null)) as {
      webUrl?: string;
    } | null;
    return body?.webUrl ?? null;
  }

  /**
   * RF-SYNC-06: exclui a tarefa no Teams (chamado só depois de confirmação
   * explícita do professor). Simplificação assumida (validar contra um
   * tenant EDU real): o Graph pode recusar excluir um assignment já
   * publicado/atribuído a alunos — nesse caso a chamada abaixo relança o
   * erro HTTP normalmente, e o Bimo trata como falha de propagação
   * (mesmo tratamento de erro dos demais jobs de sincronização).
   */
  async deleteAssignment(
    accessToken: string,
    classId: string,
    assignmentId: string,
  ): Promise<void> {
    await this.request(
      accessToken,
      'DELETE',
      `${GRAPH_API_BASE}/education/classes/${classId}/assignments/${assignmentId}`,
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
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (response.status === 429 || response.status === 503) {
      throw new GraphApiRateLimitedError(response.status);
    }
    if (!response.ok) {
      const text = await response.text();
      this.logger.error(
        `Falha na chamada ao Microsoft Graph (${url}): HTTP ${response.status} - ${text}`,
      );
      throw new Error(
        `Falha na chamada ao Microsoft Graph: HTTP ${response.status}`,
      );
    }

    return response;
  }
}
