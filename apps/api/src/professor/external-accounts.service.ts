import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TenantContext } from '../tenant/tenant-context';
import { TokenEncryptionService } from '../crypto/token-encryption.service';
import { ExternalAccount } from './external-account.entity';
import { ExternalProvider } from './external-provider.enum';

export interface LinkExternalAccountInput {
  professorId: string;
  provider: ExternalProvider;
  externalAccountEmail: string;
  accessToken: string;
  refreshToken: string | null;
  scopes: string[];
  expiresAt: Date | null;
}

@Injectable()
export class ExternalAccountsService {
  constructor(
    @InjectRepository(ExternalAccount)
    private readonly repository: Repository<ExternalAccount>,
    private readonly tokenEncryption: TokenEncryptionService,
  ) {}

  /**
   * Cria ou atualiza a credencial de um provedor para o professor
   * (um professor tem no máximo uma conta por provider - RF-AUTH-03).
   * Tokens são sempre cifrados antes de persistir (RNF-SEC-01).
   */
  async link(input: LinkExternalAccountInput): Promise<ExternalAccount> {
    const tenantId = TenantContext.getTenantId();

    const existing = await this.repository.findOne({
      where: {
        tenantId,
        professorId: input.professorId,
        provider: input.provider,
      },
    });

    const encryptedAccessToken = this.tokenEncryption.encrypt(
      input.accessToken,
    );
    const encryptedRefreshToken = input.refreshToken
      ? this.tokenEncryption.encrypt(input.refreshToken)
      : null;

    if (existing) {
      existing.externalAccountEmail = input.externalAccountEmail;
      existing.accessTokenEncrypted = encryptedAccessToken;
      existing.refreshTokenEncrypted =
        encryptedRefreshToken ?? existing.refreshTokenEncrypted;
      existing.scopes = input.scopes;
      existing.expiresAt = input.expiresAt;
      existing.needsReauth = false;
      return this.repository.save(existing);
    }

    return this.repository.save(
      this.repository.create({
        tenantId,
        professorId: input.professorId,
        provider: input.provider,
        externalAccountEmail: input.externalAccountEmail,
        accessTokenEncrypted: encryptedAccessToken,
        refreshTokenEncrypted: encryptedRefreshToken,
        scopes: input.scopes,
        expiresAt: input.expiresAt,
        needsReauth: false,
      }),
    );
  }

  /** Desvincula uma conta externa sem apagar o perfil Bimo (RF-AUTH-03). */
  async unlink(professorId: string, provider: ExternalProvider): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    const result = await this.repository.delete({
      tenantId,
      professorId,
      provider,
    });
    if (result.affected === 0) {
      throw new NotFoundException(
        `Professor não possui conta ${provider} vinculada`,
      );
    }
  }

  async listByProfessor(professorId: string): Promise<ExternalAccount[]> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.find({ where: { tenantId, professorId } });
  }

  async findByProfessorAndProvider(
    professorId: string,
    provider: ExternalProvider,
  ): Promise<ExternalAccount | null> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.findOne({
      where: { tenantId, professorId, provider },
    });
  }

  async hasProvider(
    professorId: string,
    provider: ExternalProvider,
  ): Promise<boolean> {
    const tenantId = TenantContext.getTenantId();
    const count = await this.repository.count({
      where: { tenantId, professorId, provider },
    });
    return count > 0;
  }

  getDecryptedAccessToken(account: ExternalAccount): string {
    return this.tokenEncryption.decrypt(account.accessTokenEncrypted);
  }

  getDecryptedRefreshToken(account: ExternalAccount): string | null {
    return account.refreshTokenEncrypted
      ? this.tokenEncryption.decrypt(account.refreshTokenEncrypted)
      : null;
  }

  async markNeedsReauth(accountId: string): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    await this.repository.update(
      { id: accountId, tenantId },
      { needsReauth: true },
    );
  }

  async findById(accountId: string): Promise<ExternalAccount | null> {
    const tenantId = TenantContext.getTenantId();
    return this.repository.findOne({ where: { id: accountId, tenantId } });
  }

  /** Substitui o access/refresh token após uma renovação bem-sucedida (RF-AUTH-04). */
  async updateTokensAfterRefresh(
    accountId: string,
    tokens: {
      accessToken: string;
      refreshToken?: string | null;
      expiresAt: Date | null;
    },
  ): Promise<void> {
    const tenantId = TenantContext.getTenantId();
    const patch: Partial<ExternalAccount> = {
      accessTokenEncrypted: this.tokenEncryption.encrypt(tokens.accessToken),
      expiresAt: tokens.expiresAt,
      needsReauth: false,
    };
    if (tokens.refreshToken) {
      patch.refreshTokenEncrypted = this.tokenEncryption.encrypt(
        tokens.refreshToken,
      );
    }
    await this.repository.update({ id: accountId, tenantId }, patch);
  }
}
