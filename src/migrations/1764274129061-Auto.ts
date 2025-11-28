import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1764274129061 implements MigrationInterface {
    name = 'Auto1764274129061'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mission_chats" ALTER COLUMN "userMissionId" DROP NOT NULL`);
        await queryRunner.query(`ALTER TABLE "mission_chats" ADD CONSTRAINT "FK_4d83494eaf60f7c01a2802f9b68" FOREIGN KEY ("userMissionId") REFERENCES "user_missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mission_codes" ADD CONSTRAINT "FK_2c47b0698b18bedd8a8876aa9d9" FOREIGN KEY ("userMissionId") REFERENCES "user_missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mission_codes" DROP CONSTRAINT "FK_2c47b0698b18bedd8a8876aa9d9"`);
        await queryRunner.query(`ALTER TABLE "mission_chats" DROP CONSTRAINT "FK_4d83494eaf60f7c01a2802f9b68"`);
        await queryRunner.query(`ALTER TABLE "mission_chats" ALTER COLUMN "userMissionId" SET NOT NULL`);
    }

}
