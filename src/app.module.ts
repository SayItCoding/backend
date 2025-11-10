import { join } from 'path';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentModule } from './assignment/assignment.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { MissionModule } from './mission/mission.module';
import { AppController } from './app.controller';
import { IntentModule } from './ai/intentclassifier/intent.module';

@Module({
  imports: [
    MissionModule,
    AssignmentModule,
    DashboardModule,
    AuthModule,
    IntentModule,
    ConfigModule.forRoot({
      isGlobal: true, // 모든 모듈에서 process.env 사용 가능
      envFilePath: [`.env.${process.env.NODE_ENV}`, '.env'],
      ignoreEnvFile: process.env.NODE_ENV === 'production',
      cache: true,
      expandVariables: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get('NODE_ENV') === 'production';

        const sync = config.get('TYPEORM_SYNC') === 'true';

        const databaseUrl = config.get<string>('DATABASE_URL');
        if (!databaseUrl) {
          throw new Error('DATABASE_URL is not defined');
        }
        const u = new URL(databaseUrl);
        const isInternal = u.hostname.endsWith('.railway.internal');

        /* 진단 로그
        (() => {
          const raw = process.env.DATABASE_URL || '';
          const safe = raw.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:*****@');
          const h = (() => {
            try {
              return new URL(raw).hostname;
            } catch {
              return '(bad URL)';
            }
          })();
          console.log(
            '[DB] url=',
            safe,
            'host=',
            h,
            'NODE_ENV=',
            process.env.NODE_ENV,
            'NODE_OPTIONS=',
            process.env.NODE_OPTIONS,
          );
        })();
        */

        return {
          type: 'postgres',
          url: databaseUrl,

          // 마이그레이션 경로 등록
          migrations: isProd
            ? [join(__dirname, 'migrations/*.{js}')]
            : ['src/migrations/*.{ts}'],

          autoLoadEntities: true,
          synchronize: isProd ? false : sync,
          migrationsRun: isProd,
          ssl: undefined,
          extra: undefined,

          // 로그에서 마이그레이션 출력
          logging: ['error', 'warn', 'migration'],
          retryAttempts: 10,
          retryDelay: 3000,
        };
      },
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
