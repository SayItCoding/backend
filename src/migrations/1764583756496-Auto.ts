import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1764583756496 implements MigrationInterface {
    name = 'Auto1764583756496'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "user_study_sessions" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "missionId" integer, "durationSeconds" integer NOT NULL, "startedAt" TIMESTAMP NOT NULL DEFAULT now(), "endedAt" TIMESTAMP, CONSTRAINT "PK_0c077a8a9a6374292838bc990e9" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user_study_sessions" ADD CONSTRAINT "FK_d28e271cad184e3794b253af7be" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_study_sessions" ADD CONSTRAINT "FK_700278469cd814898c9145834af" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_study_sessions" DROP CONSTRAINT "FK_700278469cd814898c9145834af"`);
        await queryRunner.query(`ALTER TABLE "user_study_sessions" DROP CONSTRAINT "FK_d28e271cad184e3794b253af7be"`);
        await queryRunner.query(`DROP TABLE "user_study_sessions"`);
    }

}
