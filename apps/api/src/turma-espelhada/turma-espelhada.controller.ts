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
import { TurmaEspelhadaService } from './turma-espelhada.service';

interface CreateTurmaEspelhadaDto {
  name: string;
  academicPeriod?: string;
}

@Controller('turmas-espelhadas')
@UseGuards(JwtAuthGuard, ProfessorOnlyGuard)
export class TurmaEspelhadaController {
  constructor(private readonly turmaEspelhadaService: TurmaEspelhadaService) {}

  @Post()
  async create(
    @Req() req: Request & { user: BimoJwtPayload },
    @Body() dto: CreateTurmaEspelhadaDto,
  ) {
    const { sub: professorId, tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.turmaEspelhadaService.create({
        professorId,
        name: dto.name,
        academicPeriod: dto.academicPeriod,
      }),
    );
  }

  @Get()
  async list(@Req() req: Request & { user: BimoJwtPayload }) {
    const { tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.turmaEspelhadaService.listByTenant(),
    );
  }

  @Get(':id')
  async findOne(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('id') id: string,
  ) {
    const { tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.turmaEspelhadaService.findById(id),
    );
  }
}
