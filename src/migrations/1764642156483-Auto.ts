import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1764642156483 implements MigrationInterface {
    name = 'Auto1764642156483'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "mission_chat_analyses" ("id" SERIAL NOT NULL, "chatId" integer NOT NULL, "globalIntent" character varying(40) NOT NULL, "confidence" double precision NOT NULL DEFAULT '0.8', "slots" jsonb NOT NULL, "slotCount" integer NOT NULL, "hasTaskCode" boolean NOT NULL DEFAULT false, "hasQuestion" boolean NOT NULL DEFAULT false, "taskTypes" jsonb, "questionTypes" jsonb, "hasLoopIntent" boolean NOT NULL DEFAULT false, "avgLoopCount" integer, "maxLoopCount" integer, "hasAmbiguity" boolean NOT NULL DEFAULT false, "ambiguityTypes" jsonb, "rawIntent" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "REL_8fd75b0a6417c3473e7641db75" UNIQUE ("chatId"), CONSTRAINT "PK_dbdad783cbebdcc320a0a30490f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "mission_chat_analyses" ADD CONSTRAINT "FK_8fd75b0a6417c3473e7641db753" FOREIGN KEY ("chatId") REFERENCES "mission_chats"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "mission_chat_analyses" DROP CONSTRAINT "FK_8fd75b0a6417c3473e7641db753"`);
        await queryRunner.query(`DROP TABLE "mission_chat_analyses"`);
    }

}
