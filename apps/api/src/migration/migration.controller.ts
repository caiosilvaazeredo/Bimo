import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfessorOnlyGuard } from '../auth/guards/kind.guard';
import { BimoJwtPayload } from '../auth/bimo-jwt-payload';
import { TenantContext } from '../tenant/tenant-context';
import { MigrationService, LinkExistingInput } from './migration.service';

interface LinkExistingDto {
  googleCourseId?: string;
  microsoftTeamId?: string;
  confirmedSameClass?: boolean;
}

@Controller('migrations')
@UseGuards(JwtAuthGuard, ProfessorOnlyGuard)
export class MigrationController {
  constructor(private readonly migrationService: MigrationService) {}

  @Post('turmas-existentes')
  async linkExisting(
    @Req() req: Request & { user: BimoJwtPayload },
    @Body() dto: LinkExistingDto,
  ) {
    const { sub: professorId, tenantId } = req.user;
    const input: LinkExistingInput = { professorId, ...dto };
    return TenantContext.run({ tenantId }, () =>
      this.migrationService.linkExisting(input),
    );
  }

  @Post('turmas-existentes/:turmaId/roster')
  async reconcileRoster(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('turmaId') turmaId: string,
  ) {
    const { sub: professorId, tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.migrationService.reconcileRoster(turmaId, professorId),
    );
  }

  /** RF-MIG-02: importa histórico de tarefas/notas. Rode depois de /roster. */
  @Post('turmas-existentes/:turmaId/historico')
  async importHistory(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('turmaId') turmaId: string,
  ) {
    const { sub: professorId, tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.migrationService.importHistory(turmaId, professorId),
    );
  }
}
