import { MigrationInterface, QueryRunner } from "typeorm";

export class Auto1763736910288 implements MigrationInterface {
    name = 'Auto1763736910288'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "missions" ("id" SERIAL NOT NULL, "title" character varying NOT NULL, "description" character varying, "thumbnailUrl" character varying, "category" character varying, "difficulty" integer NOT NULL, "projectData" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_787aebb1ac5923c9904043c6309" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "user_missions" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "missionId" integer NOT NULL, "latestMissionCodeId" integer, "isCompleted" boolean NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "completedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_97f7687552e721dbf1c82a6eae6" UNIQUE ("userId", "missionId"), CONSTRAINT "PK_252d92542f9926e799c0161ac46" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "email" character varying(80) NOT NULL, "name" character varying(80) NOT NULL, "password" character varying NOT NULL, "roles" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "mission_codes" ("id" SERIAL NOT NULL, "userMissionId" integer NOT NULL, "missionId" integer NOT NULL, "projectData" jsonb NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_685feb5322ac2ca1a2c22a1dea8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "mission_chats" ("id" SERIAL NOT NULL, "userMissionId" integer NOT NULL, "missionCodeId" integer, "content" character varying NOT NULL, "role" character varying NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_7db4b418920b844119d2a975013" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "intent_logs" ("id" SERIAL NOT NULL, "userId" integer NOT NULL, "utterance" text NOT NULL, "primaryIntent" character varying(32) NOT NULL, "intents" jsonb, "slots" jsonb, "needsClarification" boolean NOT NULL DEFAULT false, "assistantMessage" text, "projectDataSnapshot" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_08a5ea0c1b3726a8cc468a9664a" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "user_missions" ADD CONSTRAINT "FK_d91466f651650ed5ca0423027cb" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_missions" ADD CONSTRAINT "FK_cedb05f0e3f7fc3c5cad9ceca00" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_missions" DROP CONSTRAINT "FK_cedb05f0e3f7fc3c5cad9ceca00"`);
        await queryRunner.query(`ALTER TABLE "user_missions" DROP CONSTRAINT "FK_d91466f651650ed5ca0423027cb"`);
        await queryRunner.query(`DROP TABLE "intent_logs"`);
        await queryRunner.query(`DROP TABLE "mission_chats"`);
        await queryRunner.query(`DROP TABLE "mission_codes"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "user_missions"`);
        await queryRunner.query(`DROP TABLE "missions"`);
    }

}
