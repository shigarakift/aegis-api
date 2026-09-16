import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as cookieParser from 'cookie-parser';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('RBAC Boundary & IDOR Prevention E2E Tests (FEAT-8.1)', () => {
  let app: INestApplication;
  let adminToken: string;
  let adminId: string;
  let userToken: string;
  let userId: string;

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

    // Login as Admin
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'admin@aegis.local',
        password: 'AdminSecure2026!',
      });
    adminToken = adminLogin.body.data.accessToken;
    adminId = adminLogin.body.data.user.id;

    // Login as Standard User
    const userLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({
        email: 'user@aegis.local',
        password: 'UserSecure2026!',
      });
    userToken = userLogin.body.data.accessToken;
    userId = userLogin.body.data.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('🧪 Skenario RBAC Boundary: Non-admin rejected from accessing user management', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('🧪 Skenario RBAC Boundary: Admin granted access to user management', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('🧪 Skenario IDOR Prevention: User cannot read another user by ID', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/users/${adminId}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('IDOR');
  });

  it('🧪 Skenario IDOR Prevention: User cannot update another user profile', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/users/${adminId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        fullName: 'Hacked Administrator Name',
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('IDOR');
  });

  it('🧪 Skenario Ownership Verification: User can update their own profile', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/users/${userId}`)
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        fullName: 'Demo Standard User Updated',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.fullName).toBe('Demo Standard User Updated');
  });
});
