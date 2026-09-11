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
import { BimoJwtPayload } from '../auth/bimo-jwt-payload';
import { TenantContext } from '../tenant/tenant-context';
import { TarefaService, TarefaInput } from './tarefa.service';
import { CourseworkConflictCheckService } from './coursework-conflict-check.service';

interface TarefaDto {
  title: string;
  description?: string;
  dueDate?: string;
  points?: number;
  materialLinks?: string[];
}

function toInput(dto: TarefaDto): TarefaInput {
  return {
    title: dto.title,
    description: dto.description,
    dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    points: dto.points,
    materialLinks: dto.materialLinks,
  };
}

@Controller()
@UseGuards(JwtAuthGuard, ProfessorOnlyGuard)
export class TarefaController {
  constructor(
    private readonly tarefaService: TarefaService,
    private readonly conflictCheckService: CourseworkConflictCheckService,
  ) {}

  @Post('turmas-espelhadas/:turmaId/tarefas')
  async publish(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('turmaId') turmaId: string,
    @Body() dto: TarefaDto,
  ) {
    const { sub: professorId, tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.tarefaService.publish(turmaId, professorId, toInput(dto)),
    );
  }

  @Get('turmas-espelhadas/:turmaId/tarefas')
  async list(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('turmaId') turmaId: string,
  ) {
    return TenantContext.run({ tenantId: req.user.tenantId }, () =>
      this.tarefaService.listByTurma(turmaId),
    );
  }

  @Get('tarefas/:id')
  async findOne(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('id') id: string,
  ) {
    return TenantContext.run({ tenantId: req.user.tenantId }, () =>
      this.tarefaService.findById(id),
    );
  }

  @Patch('tarefas/:id')
  async update(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('id') id: string,
    @Body() dto: TarefaDto,
  ) {
    const { sub: professorId, tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.tarefaService.update(id, professorId, toInput(dto)),
    );
  }

  /** RF-SYNC-03: checa sob demanda se Google e Microsoft divergiram (ver RF-INT-06). */
  @Post('tarefas/:id/check-conflito')
  async checkConflict(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('id') id: string,
  ) {
    const { sub: professorId, tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.conflictCheckService.checkTarefa(id, professorId),
    );
  }
}
