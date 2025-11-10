import 'dotenv/config';
import { DataSource } from 'typeorm';

const isProd = process.env.NODE_ENV === 'production';

// dev에서는 .ts, prod(빌드)에서는 .js 경로를 보도록 분기
const entities = isProd ? ['dist/**/*.entity.js'] : ['src/**/*.entity.ts'];
const migrations = isProd ? ['dist/migrations/*.js'] : ['src/migrations/*.ts'];

export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL, // Railway Variables or .env
  ssl: isProd ? { rejectUnauthorized: false } : undefined, // 공용 URL일 때 필요
  entities,
  migrations,
  // 필요 시 logging 조정: ['error','warn','migration']
});
