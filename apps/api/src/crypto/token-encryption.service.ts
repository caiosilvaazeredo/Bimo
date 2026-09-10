import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12;

/**
 * Criptografa/descriptografa segredos (tokens OAuth, credenciais de app)
 * antes de persistir (RNF-SEC-01: nunca texto plano em banco ou log).
 *
 * A chave vem de KMS_DATA_KEY (base64, 32 bytes). Em produção essa chave
 * deve ser gerenciada por um KMS (Oracle Cloud Vault/KMS); este serviço
 * já isola o ponto de troca para uma integração real de KMS depois,
 * sem precisar mudar quem o consome.
 */
@Injectable()
export class TokenEncryptionService implements OnModuleInit {
  private key: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const base64Key = this.config.get<string>('KMS_DATA_KEY');
    if (!base64Key) {
      throw new Error(
        'KMS_DATA_KEY não configurada. Gere uma chave de 32 bytes em base64 (ex: openssl rand -base64 32).',
      );
    }
    const key = Buffer.from(base64Key, 'base64');
    if (key.length !== 32) {
      throw new Error(
        'KMS_DATA_KEY deve decodificar para exatamente 32 bytes (AES-256).',
      );
    }
    this.key = key;
  }

  encrypt(plainText: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plainText, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return [
      iv.toString('base64'),
      authTag.toString('base64'),
      encrypted.toString('base64'),
    ].join('.');
  }

  decrypt(payload: string): string {
    const [ivB64, authTagB64, cipherTextB64] = payload.split('.');
    if (!ivB64 || !authTagB64 || !cipherTextB64) {
      throw new Error('Payload cifrado em formato inválido.');
    }

    const decipher = createDecipheriv(
      ALGORITHM,
      this.key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(authTagB64, 'base64'));

    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(cipherTextB64, 'base64')),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
