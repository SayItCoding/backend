import { MigrationInterface, QueryRunner, Table, TableIndex } from 'typeorm';

export class InitMission1710240000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Postgres 권장: timestamptz 사용
    await queryRunner.createTable(
      new Table({
        name: 'mission',
        columns: [
          {
            name: 'id',
            type: 'integer',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment', // SERIAL/identity에 대응
          },
          { name: 'name', type: 'varchar', isNullable: false }, // 미션 제목
          { name: 'description', type: 'text', isNullable: true }, // 미션 설명
          { name: 'category', type: 'varchar', isNullable: true }, // 미션 카테고리
          { name: 'projectData', type: 'jsonb', isNullable: false }, // Entry 프로젝트 JSON
          {
            name: 'createdAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
          {
            name: 'updatedAt',
            type: 'timestamptz',
            default: 'now()',
            isNullable: false,
          },
        ],
      }),
      true,
    );

    // 카테고리 검색 최적화(선택)
    await queryRunner.createIndex(
      'mission',
      new TableIndex({
        name: 'IDX_mission_category',
        columnNames: ['category'],
      }),
    );

    // updatedAt 자동 갱신 트리거(선택: Postgres는 onUpdate가 기본 지원되지 않음)
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION set_updated_at()
      RETURNS TRIGGER AS $$
      BEGIN
        NEW."updatedAt" = NOW();
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    await queryRunner.query(`
      CREATE TRIGGER trg_mission_updated_at
      BEFORE UPDATE ON "mission"
      FOR EACH ROW
      EXECUTE FUNCTION set_updated_at();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_mission_updated_at ON "mission";`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS set_updated_at;`);
    await queryRunner.dropIndex('mission', 'IDX_mission_category');
    await queryRunner.dropTable('mission');
  }
}
