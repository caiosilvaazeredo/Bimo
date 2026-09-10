import { Controller, Delete, Get, Param, ParseEnumPipe, Req, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { GoogleAuthGuard, MicrosoftAuthGuard } from './guards/oauth-init.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { OAuthProfile } from './strategies/oauth-profile';
import { BimoJwtPayload } from './bimo-jwt-payload';
import { TenantContext } from '../tenant/tenant-context';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  /** Inicia o login Google. Uso: GET /auth/google?tenant=<slug> */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // O redirect para o Google é feito pelo Passport antes de chegar aqui.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request & { user: OAuthProfile }, @Res() res: Response) {
    const result = await this.authService.completeOAuthLogin(req.user, ExternalProvider.GOOGLE);
    this.redirectToFrontend(res, result.accessToken);
  }

  /** Inicia o login Microsoft. Uso: GET /auth/microsoft?tenant=<slug> */
  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  microsoftLogin() {
    // O redirect para o Microsoft Entra ID é feito pelo Passport antes de chegar aqui.
  }

  @Get('microsoft/callback')
  @UseGuards(MicrosoftAuthGuard)
  async microsoftCallback(@Req() req: Request & { user: OAuthProfile }, @Res() res: Response) {
    const result = await this.authService.completeOAuthLogin(req.user, ExternalProvider.MICROSOFT);
    this.redirectToFrontend(res, result.accessToken);
  }

  @Delete('accounts/:provider')
  @UseGuards(JwtAuthGuard)
  async unlinkAccount(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('provider', new ParseEnumPipe(ExternalProvider)) provider: ExternalProvider,
  ) {
    const { sub: professorId, tenantId } = req.user;
    return TenantContext.run({ tenantId }, () => this.authService.unlinkAccount(professorId, provider));
  }

  /** Devolve o navegador para o painel Bimo com a sessão (JWT) na URL. */
  private redirectToFrontend(res: Response, accessToken: string): void {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    res.redirect(`${frontendUrl}/auth/callback?token=${encodeURIComponent(accessToken)}`);
  }
}
