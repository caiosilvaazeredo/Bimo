import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfessorOnlyGuard } from '../auth/guards/kind.guard';
import { BimoJwtPayload } from '../auth/bimo-jwt-payload';
import { TenantContext } from '../tenant/tenant-context';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { EntregaContingenciaService } from './entrega-contingencia.service';

/** RF-STU-05: professor acompanha quem está usando o acesso de contingência. */
@Controller('turmas-espelhadas/:turmaId/contingencia')
@UseGuards(JwtAuthGuard, ProfessorOnlyGuard)
export class ProfessorContingenciaController {
  constructor(
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly entregaContingenciaService: EntregaContingenciaService,
  ) {}

  @Get()
  async list(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('turmaId') turmaId: string,
  ) {
    const { tenantId } = req.user;
    return TenantContext.run({ tenantId }, async () => {
      await this.turmaEspelhadaService.findById(turmaId);
      const entregas =
        await this.entregaContingenciaService.listByTurma(turmaId);
      return entregas.filter((entrega) => entrega.propagatedAt === null);
    });
  }
}
