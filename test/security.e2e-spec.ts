import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import * as cookieParser from 'cookie-parser';
import { AppModule } from '../src/app.module';

describe('aegisAPI Security E2E Tests', () => {
  let app: INestApplication;

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

  it('🧪 Should reject paginated users request with limit > 100 (DoS Memory Exhaustion Prevention)', async () => {
    // 1. Login as Admin
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@aegis.local',
        password: 'AdminSecure2026!',
      });

    expect(loginRes.status).toBe(200);
    const adminToken = loginRes.body.data.accessToken;

    // 2. Request users with limit = 500 (DoS attempt)
    const dosRes = await request(app.getHttpServer())
      .get('/api/v1/users?limit=500')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(dosRes.status).toBe(400);
    expect(dosRes.body.success).toBe(false);
  });

  it('🧪 Should reject non-admin users from accessing GET /api/v1/users (RBAC Enforcement)', async () => {
    // 1. Login as standard user
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'user@aegis.local',
        password: 'UserSecure2026!',
      });

    expect(loginRes.status).toBe(200);
    const userToken = loginRes.body.data.accessToken;

    // 2. Standard user tries to access /users
    const userRes = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${userToken}`);

    expect(userRes.status).toBe(403);
  });

  it('🧪 Should return paginated users with metadata for Admin', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@aegis.local',
        password: 'AdminSecure2026!',
      });

    const adminToken = loginRes.body.data.accessToken;

    const res = await request(app.getHttpServer())
      .get('/api/v1/users?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('page', 1);
    expect(res.body.meta).toHaveProperty('limit', 10);
    expect(res.body.meta).toHaveProperty('totalItems');
    expect(res.body.meta).toHaveProperty('totalPages');
    expect(res.body.meta).toHaveProperty('hasNextPage');
    expect(res.body.meta).toHaveProperty('hasPrevPage');

    // Ensure password hash is NEVER leaked in any user item
    res.body.data.forEach((u: any) => {
      expect(u.password).toBeUndefined();
    });
  });

  it('🧪 Should reject non-admin users from accessing GET /api/v1/audit-logs (RBAC Enforcement)', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'user@aegis.local',
        password: 'UserSecure2026!',
      });

    const userToken = loginRes.body.data.accessToken;

    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
  });

  it('🧪 Should allow Admin to query audit logs with pagination metadata', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@aegis.local',
        password: 'AdminSecure2026!',
      });

    const adminToken = loginRes.body.data.accessToken;

    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs?page=1&limit=5')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toHaveProperty('page', 1);
    expect(res.body.meta).toHaveProperty('limit', 5);
    expect(res.body.meta).toHaveProperty('totalItems');
    expect(res.body.meta).toHaveProperty('totalPages');
    expect(res.body.meta).toHaveProperty('hasNextPage');
    expect(res.body.meta).toHaveProperty('hasPrevPage');
  });

  it('🧪 Should allow Admin to retrieve security incident summary statistics', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@aegis.local',
        password: 'AdminSecure2026!',
      });

    const adminToken = loginRes.body.data.accessToken;

    const res = await request(app.getHttpServer())
      .get('/api/v1/audit-logs/summary')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('failedLogins24h');
    expect(res.body.data).toHaveProperty('suspiciousIps');
    expect(res.body.data).toHaveProperty('totalSecurityEvents');
    expect(Array.isArray(res.body.data.suspiciousIps)).toBe(true);
  });

  it('🧪 Should reject change-password when currentPassword is wrong', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'user@aegis.local',
        password: 'UserSecure2026!',
      });

    const userToken = loginRes.body.data.accessToken;

    const res = await request(app.getHttpServer())
      .patch('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        currentPassword: 'WrongPassword123!',
        newPassword: 'NewSecurePassword2026!',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('🧪 Should reject change-password when newPassword is identical to currentPassword', async () => {
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'user@aegis.local',
        password: 'UserSecure2026!',
      });

    const userToken = loginRes.body.data.accessToken;

    const res = await request(app.getHttpServer())
      .patch('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        currentPassword: 'UserSecure2026!',
        newPassword: 'UserSecure2026!',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('🧪 Should allow public access to GET /api/v1/health with probe indicators', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health');

    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('status');
    expect(res.body).toHaveProperty('details');
  });
});
