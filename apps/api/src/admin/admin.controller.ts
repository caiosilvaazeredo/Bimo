import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfessorOnlyGuard } from '../auth/guards/kind.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { BimoJwtPayload } from '../auth/bimo-jwt-payload';
import { ProfessorRole } from '../professor/professor-role.enum';
import { TenantContext } from '../tenant/tenant-context';
import { TenantsService } from '../tenant/tenants.service';
import { ProfessorsService } from '../professor/professors.service';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { SyncEventLogService } from '../sync-event-log/sync-event-log.service';

/**
 * Administração institucional (RF-ADMIN-02/03/05): visão de todas as
 * turmas e professores do tenant do administrador logado. O isolamento
 * entre tenants (RF-ADMIN-03) vem de baixo — TenantContext + tenant_id
 * em toda query — não é algo que este controller precise reforçar.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, ProfessorOnlyGuard, RolesGuard)
@Roles(ProfessorRole.INSTITUTIONAL_ADMIN, ProfessorRole.NETWORK_ADMIN)
export class AdminController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly professorsService: ProfessorsService,
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly syncEventLogService: SyncEventLogService,
  ) {}

  @Get('turmas')
  async listTurmas(@Req() req: Request & { user: BimoJwtPayload }) {
    return TenantContext.run({ tenantId: req.user.tenantId }, () =>
      this.turmaEspelhadaService.listByTenant(),
    );
  }

  @Get('professores')
  async listProfessores(@Req() req: Request & { user: BimoJwtPayload }) {
    return TenantContext.run({ tenantId: req.user.tenantId }, () =>
      this.professorsService.listByTenant(),
    );
  }

  /** RNF-SEC-04: ação administrativa sensível, registrada em log de auditoria imutável. */
  @Post('professores/:id/revoke')
  async revokeProfessor(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('id') id: string,
  ) {
    const { tenantId } = req.user;
    await TenantContext.run({ tenantId }, () =>
      this.professorsService.revoke(id),
    );
    await this.syncEventLogService.record({
      tenantId,
      jobType: 'ADMIN_REVOKE_PROFESSOR',
      resourceId: id,
      result: 'SUCCESS',
      detail: `Revogado por admin=${req.user.sub}`,
    });
  }

  /** RNF-SEC-04: ação administrativa sensível, registrada em log de auditoria imutável. */
  @Patch('tenant/contingencia')
  async setContingency(
    @Req() req: Request & { user: BimoJwtPayload },
    @Body() body: { enabled: boolean },
  ) {
    const { tenantId } = req.user;
    await this.tenantsService.setContingencyEnabled(tenantId, body.enabled);
    await this.syncEventLogService.record({
      tenantId,
      jobType: 'ADMIN_SET_CONTINGENCY',
      resourceId: tenantId,
      result: 'SUCCESS',
      detail: `enabled=${body.enabled} por admin=${req.user.sub}`,
    });
  }
}
