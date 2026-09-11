import { ConfigService } from '@nestjs/config';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { BootstrapSecretGuard } from './bootstrap-secret.guard';

function buildContext(headerValue: string | undefined): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        header: (name: string) =>
          name === 'x-admin-bootstrap-secret' ? headerValue : undefined,
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('BootstrapSecretGuard', () => {
  it('permite quando o header bate com o segredo configurado', () => {
    const config = {
      get: jest.fn().mockReturnValue('segredo-123'),
    } as unknown as ConfigService;
    const guard = new BootstrapSecretGuard(config);
    expect(guard.canActivate(buildContext('segredo-123'))).toBe(true);
  });

  it('bloqueia quando o header não bate', () => {
    const config = {
      get: jest.fn().mockReturnValue('segredo-123'),
    } as unknown as ConfigService;
    const guard = new BootstrapSecretGuard(config);
    expect(() => guard.canActivate(buildContext('errado'))).toThrow(
      UnauthorizedException,
    );
  });

  it('bloqueia quando o segredo não está configurado, mesmo que o header exista', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const guard = new BootstrapSecretGuard(config);
    expect(() => guard.canActivate(buildContext('qualquer-coisa'))).toThrow(
      UnauthorizedException,
    );
  });
});
