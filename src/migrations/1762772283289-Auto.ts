import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1762772283289 implements MigrationInterface {
    name = 'Auto1762772283289'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_mission_category"`);
        await queryRunner.query(`ALTER TABLE "mission" DROP COLUMN "projectData"`);
        await queryRunner.query(`ALTER TABLE "mission" DROP COLUMN "createdAt"`);
        await queryRunner.query(`ALTER TABLE "mission" DROP COLUMN "updatedAt"`);
        await queryRunner.query(`ALTER TABLE "mission" ADD "projectdata" jsonb NOT NULL`);
        await queryRunner.query(`ALTER TABLE "mission" ADD "createdat" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "mission" ADD "updatedat" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mission" DROP COLUMN "updatedat"`);
        await queryRunner.query(`ALTER TABLE "mission" DROP COLUMN "createdat"`);
        await queryRunner.query(`ALTER TABLE "mission" DROP COLUMN "projectdata"`);
        await queryRunner.query(`ALTER TABLE "mission" ADD "updatedAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "mission" ADD "createdAt" TIMESTAMP NOT NULL DEFAULT now()`);
        await queryRunner.query(`ALTER TABLE "mission" ADD "projectData" jsonb NOT NULL`);
        await queryRunner.query(`CREATE INDEX "IDX_mission_category" ON "mission" ("category") `);
    }

}
