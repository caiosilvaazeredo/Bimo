import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SessionJwtPayload } from '../auth/bimo-jwt-payload';
import { DataSubjectRequestsService } from './data-subject-requests.service';

/**
 * RNF-PRIV-03: qualquer titular (professor ou aluno) pede a exclusão
 * dos próprios dados, independentemente de plano/cobrança ou de a
 * instituição ter cancelado o Bimo.
 */
@Controller('me')
@UseGuards(JwtAuthGuard)
export class DataSubjectRequestsController {
  constructor(
    private readonly dataSubjectRequestsService: DataSubjectRequestsService,
  ) {}

  @Post('delete-request')
  async deleteMyData(@Req() req: Request & { user: SessionJwtPayload }) {
    const { tenantId, sub, kind } = req.user;
    await this.dataSubjectRequestsService.deleteOwnData(tenantId, kind, sub);
    return { status: 'processado' };
  }
}
