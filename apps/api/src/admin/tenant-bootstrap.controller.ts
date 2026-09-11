import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { TenantContext } from '../tenant/tenant-context';
import { TenantsService } from '../tenant/tenants.service';
import { ProfessorsService } from '../professor/professors.service';
import { ProfessorRole } from '../professor/professor-role.enum';
import { BootstrapSecretGuard } from './bootstrap-secret.guard';

interface BootstrapTenantDto {
  name: string;
  slug: string;
  adminEmail: string;
  adminDisplayName: string;
}

/** RF-ADMIN-01: cadastro de uma nova instituição (tenant) no Bimo. */
@Controller('admin/tenants')
@UseGuards(BootstrapSecretGuard)
export class TenantBootstrapController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly professorsService: ProfessorsService,
  ) {}

  @Post()
  async bootstrap(@Body() dto: BootstrapTenantDto) {
    const tenant = await this.tenantsService.create({
      name: dto.name,
      slug: dto.slug,
    });

    await TenantContext.run({ tenantId: tenant.id }, () =>
      this.professorsService.createWithRole({
        institutionalEmail: dto.adminEmail,
        displayName: dto.adminDisplayName,
        role: ProfessorRole.INSTITUTIONAL_ADMIN,
      }),
    );

    return tenant;
  }
}
