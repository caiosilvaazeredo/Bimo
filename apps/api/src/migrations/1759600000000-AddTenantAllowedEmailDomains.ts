import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RF-AUTH-03/RNF-SEC: domínios de e-mail institucional aceitos no login,
 * por tenant (ex: "uva.br,veigadealmeida.edu.br"). CLOB porque é
 * simple-array no TypeORM (mesmo mapeamento usado em Tarefa.materialLinks
 * e ExternalAccount.scopes na migration inicial).
 */
export class AddTenantAllowedEmailDomains1759600000000 implements MigrationInterface {
  name = 'AddTenantAllowedEmailDomains1759600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant"
      ADD "allowed_email_domains" CLOB DEFAULT '' NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "tenant" DROP COLUMN "allowed_email_domains"
    `);
  }
}
