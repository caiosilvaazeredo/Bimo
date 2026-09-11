import { Body, Controller, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfessorOnlyGuard } from '../auth/guards/kind.guard';
import { BimoJwtPayload } from '../auth/bimo-jwt-payload';
import { TenantContext } from '../tenant/tenant-context';
import { TurmaEspelhadaService } from '../turma-espelhada/turma-espelhada.service';
import { AlunosService } from './alunos.service';
import { MatriculaService } from './matricula.service';

interface EnrollDto {
  institutionalEmail: string;
  displayName: string;
}

/**
 * Vínculo manual de aluno à turma, enquanto a reconciliação automática
 * de roster (RF-INT-03) não existe neste código. O professor informa o
 * e-mail institucional do aluno e o Bimo cria/reconcilia o Aluno.
 */
@Controller('turmas-espelhadas/:turmaId/matriculas')
@UseGuards(JwtAuthGuard, ProfessorOnlyGuard)
export class MatriculaController {
  constructor(
    private readonly turmaEspelhadaService: TurmaEspelhadaService,
    private readonly alunosService: AlunosService,
    private readonly matriculaService: MatriculaService,
  ) {}

  @Post()
  async enroll(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('turmaId') turmaId: string,
    @Body() dto: EnrollDto,
  ) {
    const { tenantId } = req.user;
    return TenantContext.run({ tenantId }, async () => {
      await this.turmaEspelhadaService.findById(turmaId);
      const aluno =
        await this.alunosService.findOrCreateByInstitutionalEmail(dto);
      return this.matriculaService.enroll(aluno.id, turmaId);
    });
  }
}
