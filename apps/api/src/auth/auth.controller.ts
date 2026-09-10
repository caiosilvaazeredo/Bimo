import {
  Controller,
  Delete,
  Get,
  Param,
  ParseEnumPipe,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { GoogleAuthGuard, MicrosoftAuthGuard } from './guards/oauth-init.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './auth.service';
import { ExternalProvider } from '../professor/external-provider.enum';
import { OAuthProfile } from './strategies/oauth-profile';
import { BimoJwtPayload } from './bimo-jwt-payload';
import { TenantContext } from '../tenant/tenant-context';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /** Inicia o login Google. Uso: GET /auth/google?tenant=<slug> */
  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleLogin() {
    // O redirect para o Google é feito pelo Passport antes de chegar aqui.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleCallback(@Req() req: Request & { user: OAuthProfile }) {
    return this.authService.completeOAuthLogin(
      req.user,
      ExternalProvider.GOOGLE,
    );
  }

  /** Inicia o login Microsoft. Uso: GET /auth/microsoft?tenant=<slug> */
  @Get('microsoft')
  @UseGuards(MicrosoftAuthGuard)
  microsoftLogin() {
    // O redirect para o Microsoft Entra ID é feito pelo Passport antes de chegar aqui.
  }

  @Get('microsoft/callback')
  @UseGuards(MicrosoftAuthGuard)
  async microsoftCallback(@Req() req: Request & { user: OAuthProfile }) {
    return this.authService.completeOAuthLogin(
      req.user,
      ExternalProvider.MICROSOFT,
    );
  }

  @Delete('accounts/:provider')
  @UseGuards(JwtAuthGuard)
  async unlinkAccount(
    @Req() req: Request & { user: BimoJwtPayload },
    @Param('provider', new ParseEnumPipe(ExternalProvider))
    provider: ExternalProvider,
  ) {
    const { sub: professorId, tenantId } = req.user;
    return TenantContext.run({ tenantId }, () =>
      this.authService.unlinkAccount(professorId, provider),
    );
  }
}
