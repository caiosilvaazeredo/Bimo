import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AlunoOnlyGuard } from '../auth/guards/kind.guard';
import { AlunoJwtPayload } from '../auth/bimo-jwt-payload';
import { TenantContext } from '../tenant/tenant-context';
import { MatriculaService } from '../aluno/matricula.service';
import { EntregaContingenciaService } from '../aluno/entrega-contingencia.service';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';

interface SubmitEntregaDto {
  turmaEspelhadaId: string;
  link: string;
}

/**
 * Portal do aluno (RF-STU-01/02/03): acesso de contingência quando uma
 * das duas plataformas nativas está indisponível. Modo leitura para
 * turmas/status; RF-STU-02 completo (tarefas/notas) depende do módulo
 * de coursework (ainda não implementado nesta base) — por ora devolve
 * a turma e seu status de sincronização.
 */
@Controller('portal')
@UseGuards(JwtAuthGuard, AlunoOnlyGuard)
export class PortalController {
  constructor(
    private readonly matriculaService: MatriculaService,
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly entregaContingenciaService: EntregaContingenciaService,
  ) {}

  @Get('turmas')
  async minhasTurmas(@Req() req: Request & { user: AlunoJwtPayload }) {
    const { sub: alunoId, tenantId } = req.user;
    return TenantContext.run({ tenantId }, async () => {
      const turmaIds = await this.matriculaService.listTurmaIdsByAluno(alunoId);
      const turmas = await Promise.all(
        turmaIds.map((id) => this.turmaEspelhadaService.findById(id)),
      );
      return turmas;
    });
  }

  @Get('turmas/:id')
  async turma(
    @Req() req: Request & { user: AlunoJwtPayload },
    @Param('id') id: string,
  ) {
    const { tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.turmaEspelhadaService.findById(id),
    );
  }

  @Post('entregas')
  async submeterEntrega(
    @Req() req: Request & { user: AlunoJwtPayload },
    @Body() dto: SubmitEntregaDto,
  ) {
    const { sub: alunoId, tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.entregaContingenciaService.submit({
        alunoId,
        turmaEspelhadaId: dto.turmaEspelhadaId,
        link: dto.link,
      }),
    );
  }
}
