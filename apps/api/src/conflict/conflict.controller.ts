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
import { BimoJwtPayload } from '../auth/bimo-jwt-payload';
import { TenantContext } from '../tenant/tenant-context';
import { ConflictService } from './conflict.service';

@Controller('conflicts')
@UseGuards(JwtAuthGuard)
export class ConflictController {
  constructor(private readonly conflictService: ConflictService) {}

  @Get()
  async list(@Req() req: Request & { user: BimoJwtPayload }) {
    return TenantContext.run({ tenantId: req.user.tenantId }, () =>
      this.conflictService.listOpenByTenant(),
    );
  }

  @Post(':id/resolve')
  async resolve(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('id') id: string,
    @Body() body: { chosenSide: 'GOOGLE' | 'MICROSOFT' },
  ) {
    return TenantContext.run({ tenantId: req.user.tenantId }, () =>
      this.conflictService.resolve(id, body.chosenSide),
    );
  }
}
