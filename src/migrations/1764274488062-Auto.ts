import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1764274488062 implements MigrationInterface {
    name = 'Auto1764274488062'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mission_codes" DROP CONSTRAINT "FK_2c47b0698b18bedd8a8876aa9d9"`);
        await queryRunner.query(`ALTER TABLE "mission_codes" ALTER COLUMN "userMissionId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "mission_codes" ADD CONSTRAINT "FK_2c47b0698b18bedd8a8876aa9d9" FOREIGN KEY ("userMissionId") REFERENCES "user_missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mission_codes" DROP CONSTRAINT "FK_2c47b0698b18bedd8a8876aa9d9"`);
        await queryRunner.query(`ALTER TABLE "mission_codes" ALTER COLUMN "userMissionId" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "mission_codes" ADD CONSTRAINT "FK_2c47b0698b18bedd8a8876aa9d9" FOREIGN KEY ("userMissionId") REFERENCES "user_missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
