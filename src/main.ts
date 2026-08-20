import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Use structured logger
  const logger = app.get(Logger);
  app.useLogger(logger);

  const configService = app.get(ConfigService);

  // 1. Security HTTP Headers via Helmet
  app.use(helmet());

  // 2. Cookie Parser
  app.use(cookieParser());

  // 3. Strict CORS Configuration
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', 'http://localhost:3000'),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // 4. Input Validation & Whitelisting (Mass Assignment Protection)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // 5. Global API Prefix
  app.setGlobalPrefix('api/v1');

  // 6. OpenAPI / Swagger Documentation
  const swaggerConfig = new DocumentBuilder()
    .setTitle('aegisAPI Specification')
    .setDescription(
      'Secured REST API dengan standar OWASP Top 10, Dual JWT Authentication, Argon2, RBAC, & IDOR Protection.',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);

  logger.log(`🛡️ aegisAPI Server running on: http://localhost:${port}/api/v1`);
  logger.log(`📑 OpenAPI Documentation: http://localhost:${port}/api/docs`);
}
bootstrap();
