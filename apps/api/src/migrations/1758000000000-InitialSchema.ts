import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Schema inicial de todas as 13 entidades do Bimo. Escrita à mão (em vez de
 * `typeorm migration:generate`) porque essa geração precisa de uma conexão
 * viva com o banco para introspecção/diff, e o Autonomous Database exige
 * mTLS — não dá pra gerar isso sem a Wallet e acesso de rede à instância
 * real. O DDL abaixo segue exatamente o mapeamento de tipos que o driver
 * Oracle do TypeORM usa (ver node_modules/typeorm/driver/oracle/OracleDriver.js
 * normalizeType/dataTypeDefaults), para não divergir se `migration:generate`
 * for rodado no futuro contra o banco real.
 *
 * Convenções replicadas das entidades:
 * - id: VARCHAR2(255), gerado pelo TypeORM no lado da aplicação (uuid v4),
 *   não por DEFAULT do banco.
 * - boolean -> NUMBER, sem CHECK (mesmo comportamento do driver: grava 0/1).
 * - enum -> VARCHAR2(255) (TypeORM não usa CHECK/tipo nativo pra enum no Oracle).
 * - text/simple-array -> CLOB.
 * - timestamp -> TIMESTAMP(6).
 */
export class InitialSchema1758000000000 implements MigrationInterface {
  name = 'InitialSchema1758000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "tenant" (
        "id" VARCHAR2(255) NOT NULL,
        "name" VARCHAR2(255) NOT NULL,
        "slug" VARCHAR2(255) NOT NULL,
        "active" NUMBER DEFAULT 1 NOT NULL,
        "contingency_enabled" NUMBER DEFAULT 1 NOT NULL,
        "consent_region" VARCHAR2(255) DEFAULT 'BR-LGPD' NOT NULL,
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_tenant" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_tenant_name" UNIQUE ("name"),
        CONSTRAINT "UQ_tenant_slug" UNIQUE ("slug")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "professor" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "institutional_email" VARCHAR2(255) NOT NULL,
        "display_name" VARCHAR2(255) NOT NULL,
        "role" VARCHAR2(255) DEFAULT 'PROFESSOR' NOT NULL,
        "active" NUMBER DEFAULT 1 NOT NULL,
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_professor" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "external_account" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "professor_id" VARCHAR2(255) NOT NULL,
        "provider" VARCHAR2(255) NOT NULL,
        "external_account_email" VARCHAR2(255) NOT NULL,
        "access_token_encrypted" CLOB NOT NULL,
        "refresh_token_encrypted" CLOB,
        "scopes" CLOB DEFAULT '' NOT NULL,
        "expires_at" TIMESTAMP(6),
        "needs_reauth" NUMBER DEFAULT 0 NOT NULL,
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_external_account" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_external_account_tenant_prof_provider" UNIQUE ("tenant_id", "professor_id", "provider"),
        CONSTRAINT "FK_external_account_professor" FOREIGN KEY ("professor_id") REFERENCES "professor" ("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sync_job" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "job_type" VARCHAR2(255) NOT NULL,
        "payload" CLOB NOT NULL,
        "status" VARCHAR2(255) DEFAULT 'PENDING' NOT NULL,
        "attempt_count" NUMBER DEFAULT 0 NOT NULL,
        "max_attempts" NUMBER DEFAULT 5 NOT NULL,
        "next_attempt_at" TIMESTAMP(6) NOT NULL,
        "last_error" CLOB,
        "locked_by" VARCHAR2(255),
        "locked_at" TIMESTAMP(6),
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_sync_job" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_sync_job_status_next_attempt" ON "sync_job" ("status", "next_attempt_at")
    `);

    await queryRunner.query(`
      CREATE TABLE "sync_event_log" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "job_type" VARCHAR2(255) NOT NULL,
        "resource_id" VARCHAR2(255),
        "result" VARCHAR2(255) NOT NULL,
        "detail" CLOB,
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_sync_event_log" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "turma_espelhada" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "professor_id" VARCHAR2(255) NOT NULL,
        "name" VARCHAR2(255) NOT NULL,
        "academic_period" VARCHAR2(255),
        "google_course_id" VARCHAR2(255),
        "microsoft_team_id" VARCHAR2(255),
        "google_course_url" VARCHAR2(255),
        "microsoft_team_url" VARCHAR2(255),
        "sync_status" VARCHAR2(255) DEFAULT 'SYNCING' NOT NULL,
        "last_error" CLOB,
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_turma_espelhada" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "sync_conflict" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "resource_type" VARCHAR2(255) NOT NULL,
        "resource_id" VARCHAR2(255) NOT NULL,
        "field_name" VARCHAR2(255) NOT NULL,
        "google_value" CLOB,
        "google_updated_at" TIMESTAMP(6),
        "microsoft_value" CLOB,
        "microsoft_updated_at" TIMESTAMP(6),
        "resolved" NUMBER DEFAULT 0 NOT NULL,
        "resolved_value" CLOB,
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_sync_conflict" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "notification" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "recipient_id" VARCHAR2(255) NOT NULL,
        "kind" VARCHAR2(255) NOT NULL,
        "message" VARCHAR2(255) NOT NULL,
        "read" NUMBER DEFAULT 0 NOT NULL,
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_notification" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "aluno" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "institutional_email" VARCHAR2(255) NOT NULL,
        "display_name" VARCHAR2(255) NOT NULL,
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_aluno" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "matricula" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "aluno_id" VARCHAR2(255) NOT NULL,
        "turma_espelhada_id" VARCHAR2(255) NOT NULL,
        "google_user_id" VARCHAR2(255),
        "microsoft_user_id" VARCHAR2(255),
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_matricula" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_matricula_tenant_aluno_turma" UNIQUE ("tenant_id", "aluno_id", "turma_espelhada_id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "entrega_contingencia" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "turma_espelhada_id" VARCHAR2(255) NOT NULL,
        "aluno_id" VARCHAR2(255) NOT NULL,
        "link" VARCHAR2(255) NOT NULL,
        "propagated_at" TIMESTAMP(6),
        "submitted_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_entrega_contingencia" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "tarefa" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "turma_espelhada_id" VARCHAR2(255) NOT NULL,
        "title" VARCHAR2(255) NOT NULL,
        "description" CLOB,
        "due_date" TIMESTAMP(6),
        "points" NUMBER,
        "material_links" CLOB DEFAULT '' NOT NULL,
        "google_course_work_id" VARCHAR2(255),
        "microsoft_assignment_id" VARCHAR2(255),
        "sync_status" VARCHAR2(255) DEFAULT 'SYNCING' NOT NULL,
        "last_error" CLOB,
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_tarefa" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "nota" (
        "id" VARCHAR2(255) NOT NULL,
        "tenant_id" VARCHAR2(255) NOT NULL,
        "tarefa_id" VARCHAR2(255) NOT NULL,
        "aluno_id" VARCHAR2(255) NOT NULL,
        "grade" FLOAT(126),
        "comment" CLOB,
        "status" VARCHAR2(255) DEFAULT 'MISSING' NOT NULL,
        "sync_status" VARCHAR2(255) DEFAULT 'SYNCING' NOT NULL,
        "last_error" CLOB,
        "created_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        "updated_at" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP NOT NULL,
        CONSTRAINT "PK_nota" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_nota_tenant_tarefa_aluno" UNIQUE ("tenant_id", "tarefa_id", "aluno_id")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Ordem inversa da criação, por causa da FK external_account -> professor.
    await queryRunner.query(`DROP TABLE "nota"`);
    await queryRunner.query(`DROP TABLE "tarefa"`);
    await queryRunner.query(`DROP TABLE "entrega_contingencia"`);
    await queryRunner.query(`DROP TABLE "matricula"`);
    await queryRunner.query(`DROP TABLE "aluno"`);
    await queryRunner.query(`DROP TABLE "notification"`);
    await queryRunner.query(`DROP TABLE "sync_conflict"`);
    await queryRunner.query(`DROP TABLE "turma_espelhada"`);
    await queryRunner.query(`DROP TABLE "sync_event_log"`);
    await queryRunner.query(`DROP INDEX "IDX_sync_job_status_next_attempt"`);
    await queryRunner.query(`DROP TABLE "sync_job"`);
    await queryRunner.query(`DROP TABLE "external_account"`);
    await queryRunner.query(`DROP TABLE "professor"`);
    await queryRunner.query(`DROP TABLE "tenant"`);
  }
}
