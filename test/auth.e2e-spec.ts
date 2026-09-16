import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Authentication & Token Security E2E Tests (FEAT-8.1)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.getHttpAdapter().getInstance().set('trust proxy', true);
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
  });

  afterAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, 500));
    await app.close();
  });

  it('🧪 Skenario Token Rotation & Automatic Family Revocation on Reuse', async () => {
    // 1. Login to obtain access token & initial refresh token cookie
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'user@aegis.local',
        password: 'UserSecure2026!',
      });

    expect(loginRes.status).toBe(200);
    const initialCookies = loginRes.headers['set-cookie'];
    expect(initialCookies).toBeDefined();

    // 2. Rotate token for the first time
    const refreshRes1 = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', initialCookies);

    expect(refreshRes1.status).toBe(200);
    expect(refreshRes1.body.data).toHaveProperty('accessToken');
    const newCookies = refreshRes1.headers['set-cookie'];
    expect(newCookies).toBeDefined();

    // 3. REPLAY ATTACK: Attacker re-uses the old (already-rotated) refresh token
    const replayAttackRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', initialCookies);

    // Must be rejected with 401 and trigger Family Revocation
    expect(replayAttackRes.status).toBe(401);
    expect(replayAttackRes.body.success).toBe(false);

    // 4. FAMILY REVOCATION CHECK: Even the new token must now be invalid
    const postRevocationRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', newCookies);

    expect(postRevocationRes.status).toBe(401);
    expect(postRevocationRes.body.success).toBe(false);
  });

  it('🧪 Skenario Brute-Force Rate Limiting (Throttle Protection)', async () => {
    const bruteForceIp = '198.51.100.99';
    // Attempt 5 logins with bad credentials (allowed by limit 5 per min)
    for (let i = 0; i < 5; i++) {
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .set('X-Forwarded-For', bruteForceIp)
        .send({
          email: 'user@aegis.local',
          password: `WrongPasswordAttempt${i}!`,
        });
    }

    // 6th attempt must be blocked by ThrottlerGuard with 429 Too Many Requests
    const throttledRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', bruteForceIp)
      .send({
        email: 'user@aegis.local',
        password: 'WrongPasswordAttempt6!',
      });

    expect(throttledRes.status).toBe(429);
  });
});
