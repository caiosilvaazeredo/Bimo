import { Controller, Get, Param } from '@nestjs/common';
import { TenantsService } from '../tenant/tenants.service';
import { ConsentTextsService } from './consent-texts.service';

/**
 * RNF-PRIV-02: consulta pública (sem sessão) do texto de consentimento do
 * tenant, para exibir na tela de login antes do OAuth — mesmo motivo pelo
 * qual /auth/* resolve o tenant pelo slug em vez de um header autenticado.
 */
@Controller('tenants')
export class ConsentTextController {
  constructor(
    private readonly tenantsService: TenantsService,
    private readonly consentTextsService: ConsentTextsService,
  ) {}

  @Get(':slug/consent-text')
  async getConsentText(@Param('slug') slug: string) {
    const tenant = await this.tenantsService.findActiveBySlug(slug);
    return this.consentTextsService.getFor(tenant.consentRegion);
  }
}
