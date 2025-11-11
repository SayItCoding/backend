import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('missions')
export class Mission {
  @PrimaryGeneratedColumn()
  id: number;

  // 미션 제목
  @Column()
  name: string;

  // 미션 설명
  @Column({ type: 'text', nullable: true })
  description?: string;

  // 미션 카테고리
  @Column({ type: 'varchar', nullable: true })
  category?: string;

  // Entry 프로젝트 데이터 (JSON)
  @Column({ type: 'jsonb', name: 'projectdata' })
  projectData: {
    speed: number; // 작품 실행 속도 (FPS)
    objects: any[]; // 오브젝트 정보
    variables: any[]; // 변수 정보
    messages: any[]; // 신호 정보
    functions: any[]; // 함수 정보
    scenes: any[]; // 장면 정보
    interface: any[]; // 인터페이스 정보
    tables: any[]; // 데이터 테이블 목록
    learning: string | null; // 학습 모델 ID
    aiUtilizeBlocks: string[]; // AI 블록 목록
    expansionBlocks: string[]; // 확장 블록 목록
    hardwareLiteBlocks: string[]; // 브라우저 하드웨어 블록 목록
  };

  // 생성 시각
  @Column({
    type: 'timestamp',
    name: 'createdat',
    default: () => 'CURRENT_TIMESTAMP',
  })
  createdAt: Date;

  // 수정 시각
  @Column({
    type: 'timestamp',
    name: 'updatedat',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP',
  })
  updatedAt: Date;
}
