import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProfessorOnlyGuard } from '../auth/guards/kind.guard';
import { BimoJwtPayload } from '../auth/bimo-jwt-payload';
import { TenantContext } from '../tenant/tenant-context';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(JwtAuthGuard, ProfessorOnlyGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async list(@Req() req: Request & { user: BimoJwtPayload }) {
    const { sub, tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.notificationsService.listForRecipient(sub),
    );
  }

  @Post(':id/read')
  async markRead(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('id') id: string,
  ) {
    return TenantContext.run({ tenantId: req.user.tenantId }, () =>
      this.notificationsService.markRead(id),
    );
  }
}
