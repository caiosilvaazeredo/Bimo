import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfessorOnlyGuard } from '../auth/guards/kind.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ProfessorRole } from '../professor/professor-role.enum';
import { BimoJwtPayload } from '../auth/bimo-jwt-payload';
import { TenantContext } from '../tenant/tenant-context';
import { BillingService } from './billing.service';
import { ReportsService } from './reports.service';

@Controller('admin')
@UseGuards(JwtAuthGuard, ProfessorOnlyGuard, RolesGuard)
@Roles(ProfessorRole.INSTITUTIONAL_ADMIN, ProfessorRole.NETWORK_ADMIN)
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly reportsService: ReportsService,
  ) {}

  /** RF-BILL-01/03: consumo (alunos ativos) do período corrente. */
  @Get('billing/usage')
  async usage(@Req() req: Request & { user: BimoJwtPayload }) {
    return TenantContext.run({ tenantId: req.user.tenantId }, async () => ({
      activeStudents: await this.billingService.countActiveAlunos(),
    }));
  }

  /** RF-REPORT-02 */
  @Get('reports/adocao')
  async adoption(@Req() req: Request & { user: BimoJwtPayload }) {
    return TenantContext.run({ tenantId: req.user.tenantId }, () =>
      this.reportsService.institutionalAdoption(),
    );
  }

  /** RF-REPORT-01 (parcial, ver ReportsService) */
  @Get('reports/turmas/:id')
  async turmaReport(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('id') id: string,
  ) {
    return TenantContext.run({ tenantId: req.user.tenantId }, () =>
      this.reportsService.turmaSummary(id),
    );
  }
}
