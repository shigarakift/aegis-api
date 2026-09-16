import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Multi-Device Session Management E2E Tests (FEAT-8.1)', () => {
  let app: INestApplication;
  let userToken: string;
  let userCookies: string[];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api/v1');
    await app.init();

    // Login as Demo User
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'user@aegis.local',
        password: 'UserSecure2026!',
      });

    userToken = loginRes.body.data.accessToken;
    const rawCookies = loginRes.headers['set-cookie'];
    userCookies = Array.isArray(rawCookies) ? rawCookies : [rawCookies || ''];
  });

  afterAll(async () => {
    await app.close();
  });

  it('🧪 Skenario Active Sessions Listing: Retrieve list with device metadata', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Cookie', userCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    const currentSession = res.body.data.find((s: any) => s.isCurrent === true);
    expect(currentSession).toBeDefined();
    expect(currentSession).toHaveProperty('id');
    expect(currentSession).toHaveProperty('createdAt');
  });

  it('🧪 Skenario Remote Logout IDOR Defense: Cannot revoke non-existent or foreign session', async () => {
    const fakeSessionId = '00000000-0000-0000-0000-000000000000';

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/auth/sessions/${fakeSessionId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('🧪 Skenario Revoke Other Sessions: Revokes all except current session', async () => {
    const res = await request(app.getHttpServer())
      .delete('/api/v1/auth/sessions')
      .set('Authorization', `Bearer ${userToken}`)
      .set('Cookie', userCookies);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
