import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS 설정
  app.enableCors({
    origin: true, // 모든 도메인 허용
    // origin: ['https://..'], 배포용 허용 도메인 지정
    credentials: true, // 쿠키, 세션 등 인증정보 포함 허용
  });

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;

  await app.listen(port, '0.0.0.0');

  console.log(`Server running on port ${process.env.PORT}`);
}
bootstrap();
