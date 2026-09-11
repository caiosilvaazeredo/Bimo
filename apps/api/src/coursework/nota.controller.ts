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
import { ProfessorOnlyGuard } from '../auth/guards/kind.guard';
import { BimoJwtPayload } from '../auth/bimo-jwt-payload';
import { TenantContext } from '../tenant/tenant-context';
import { NotaService } from './nota.service';
import { SubmissionStatus } from './submission-status.enum';

interface SetGradeDto {
  grade?: number;
  comment?: string;
  status?: SubmissionStatus;
}

/** RF-SYNC-04 + RF-DASH-04: professor lança nota em uma tela única. */
@Controller('tarefas/:tarefaId/notas')
@UseGuards(JwtAuthGuard, ProfessorOnlyGuard)
export class NotaController {
  constructor(private readonly notaService: NotaService) {}

  @Post(':alunoId')
  async setGrade(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('tarefaId') tarefaId: string,
    @Param('alunoId') alunoId: string,
    @Body() dto: SetGradeDto,
  ) {
    const { sub: professorId, tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.notaService.setGrade(tarefaId, alunoId, professorId, dto),
    );
  }

  @Get()
  async list(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('tarefaId') tarefaId: string,
  ) {
    return TenantContext.run({ tenantId: req.user.tenantId }, () =>
      this.notaService.listByTarefa(tarefaId),
    );
  }
}
