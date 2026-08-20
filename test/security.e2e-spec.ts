import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('aegisAPI Security E2E Tests', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('🧪 Should reject registration with unknown fields (Mass Assignment Prevention)', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'attacker@example.com',
        password: 'P@ssword123',
        fullName: 'Attacker',
        role: 'ADMIN', // Unknown / Forbidden field for registration DTO
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
  });

  it('🧪 Should reject weak password during registration', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email: 'weakpass@example.com',
        password: '123', // Weak password
        fullName: 'Weak Password User',
      });

    expect(response.status).toBe(400);
  });
});
