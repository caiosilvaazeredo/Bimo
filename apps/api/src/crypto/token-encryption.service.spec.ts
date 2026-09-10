import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { TokenEncryptionService } from './token-encryption.service';

function buildService(
  key = randomBytes(32).toString('base64'),
): TokenEncryptionService {
  const config = {
    get: jest.fn().mockReturnValue(key),
  } as unknown as ConfigService;
  const service = new TokenEncryptionService(config);
  service.onModuleInit();
  return service;
}

describe('TokenEncryptionService', () => {
  it('lança erro se KMS_DATA_KEY não estiver configurada', () => {
    const config = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as ConfigService;
    const service = new TokenEncryptionService(config);
    expect(() => service.onModuleInit()).toThrow(
      /KMS_DATA_KEY não configurada/,
    );
  });

  it('lança erro se a chave não tiver 32 bytes', () => {
    const config = {
      get: jest.fn().mockReturnValue(Buffer.from('curta').toString('base64')),
    } as unknown as ConfigService;
    const service = new TokenEncryptionService(config);
    expect(() => service.onModuleInit()).toThrow(/32 bytes/);
  });

  it('faz roundtrip de encrypt/decrypt corretamente', () => {
    const service = buildService();
    const plainText = 'ya29.a0AfH6SMB_access_token_de_exemplo';

    const encrypted = service.encrypt(plainText);

    expect(encrypted).not.toContain(plainText);
    expect(service.decrypt(encrypted)).toBe(plainText);
  });

  it('gera ciphertexts diferentes para o mesmo texto (IV aleatório)', () => {
    const service = buildService();
    const a = service.encrypt('mesmo-token');
    const b = service.encrypt('mesmo-token');
    expect(a).not.toBe(b);
  });

  it('falha ao descriptografar payload adulterado', () => {
    const service = buildService();
    const encrypted = service.encrypt('token-sensivel');
    const [iv, authTag, cipherText] = encrypted.split('.');
    const tampered = [iv, authTag, cipherText.slice(0, -2) + 'AA'].join('.');

    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('não consegue descriptografar com uma chave diferente', () => {
    const serviceA = buildService();
    const serviceB = buildService();
    const encrypted = serviceA.encrypt('token-sensivel');

    expect(() => serviceB.decrypt(encrypted)).toThrow();
  });
});
