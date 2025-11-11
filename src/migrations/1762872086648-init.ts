import { MigrationInterface, QueryRunner } from 'typeorm';

export class Init1762872086648 implements MigrationInterface {
  name = 'Init1762872086648';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying(80) NOT NULL, "name" character varying(80) NOT NULL, "password" character varying NOT NULL, "roles" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "missions" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "description" text, "category" character varying, "projectdata" jsonb NOT NULL, "createdat" TIMESTAMP NOT NULL DEFAULT now(), "updatedat" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_787aebb1ac5923c9904043c6309" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "missions"`);
    await queryRunner.query(`DROP TABLE "users"`);
  }
}
