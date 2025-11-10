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
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const isProd = config.get('NODE_ENV') === 'production';
        const databaseUrl = config.get<string>('DATABASE_URL');
        const sync = config.get('TYPEORM_SYNC') === 'true';

        return {
          type: 'postgres',
          url: databaseUrl,
          autoLoadEntities: true,
          synchronize: isProd ? false : sync,
          migrationsRun: isProd,
          ssl: isProd ? { rejectUnauthorized: false } : undefined,
        };
      },
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
