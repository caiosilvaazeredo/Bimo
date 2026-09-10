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
}

interface CreatedGroup {
  id: string;
  displayName: string;
}

/**
 * Cliente do Microsoft Graph para Teams/Education. Isolado neste módulo
 * (RNF-ARCH-03): mudanças na API do Microsoft nunca devem exigir
 * alteração no cliente Google, e vice-versa.
 *
 * Criar um Team no Graph é uma operação em duas etapas: primeiro o grupo
 * Microsoft 365, depois o Team sobre esse grupo (RF-INT-02).
 */
@Injectable()
export class MicrosoftTeamsClient {
  private readonly logger = new Logger(MicrosoftTeamsClient.name);

  async createTeam(
    accessToken: string,
    input: { name: string; description?: string },
  ): Promise<CreatedTeam> {
    const group = await this.createGroup(accessToken, input);
    await this.createTeamFromGroup(accessToken, group.id);
    return { externalId: group.id, name: group.displayName };
  }

  private async createGroup(
    accessToken: string,
    input: { name: string; description?: string },
  ): Promise<CreatedGroup> {
    const response = await this.post(accessToken, `${GRAPH_API_BASE}/groups`, {
      displayName: input.name,
      description: input.description,
      mailNickname:
        input.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 60) || 'turma',
      mailEnabled: false,
      securityEnabled: false,
      groupTypes: ['Unified'],
    });
    const body = (await response.json()) as CreatedGroup;
    return body;
  }

  private async createTeamFromGroup(
    accessToken: string,
    groupId: string,
  ): Promise<void> {
    await this.post(
      accessToken,
      `${GRAPH_API_BASE}/groups/${groupId}/team`,
      {},
    );
  }

  private async post(
    accessToken: string,
    url: string,
    body: unknown,
  ): Promise<Response> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
