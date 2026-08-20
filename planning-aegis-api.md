# 🛡️ Blueprint & Roadmap Setup Project: aegisAPI (NestJS + PostgreSQL)

> **Dokumen Panduan Eksekusi (Implementation Blueprint)**  
> **Target Pelaksana:** Junior Programmer / AI Coding Model  
> **Tujuan:** Membuat aegisAPI (Secured REST API siap produksi dengan standar OWASP Top 10, clean architecture, dan dokumentasi threat model).

---

## 📋 DAFTAR ISI
1. [Tech Stack & Architecture Blueprint](#-tech-stack--architecture-blueprint)
2. [Threat Model & Security Decisions Matrix](#-threat-model--security-decisions-matrix)
3. [Struktur Folder Project (NestJS Architecture)](#-struktur-folder-project-nestjs-architecture)
4. [Roadmap Eksekusi Langkah-demi-Langkah (Phase 1 - Phase 8)](#-roadmap-eksekusi-langkah-demi-langkah)
   - [Phase 1: Setup Framework & Environment](#phase-1-setup-framework--environment)
   - [Phase 2: Database Schema & Prisma ORM Configuration](#phase-2-database-schema--prisma-orm-configuration)
   - [Phase 3: Core Security Middleware & Configuration](#phase-3-core-security-middleware--configuration)
   - [Phase 4: Authentication System (Register, Login, JWT, Refresh Token)](#phase-4-authentication-system)
   - [Phase 5: Authorization & Resource Protection (RBAC & IDOR Ownership)](#phase-5-authorization--resource-protection)
   - [Phase 6: Centralized Error Handling & Audit Logging](#phase-6-centralized-error-handling--audit-logging)
   - [Phase 7: API Documentation (OpenAPI / Swagger)](#phase-7-api-documentation)
   - [Phase 8: Testing & Verification (Unit & E2E Security Tests)](#phase-8-testing--verification)
5. [Panduan Pengujian & Checklist Acceptability Criteria](#-panduan-pengujian--checklist-acceptability-criteria)

---

## 🛠️ TECH STACK & ARCHITECTURE BLUEPRINT

| Komponen | Teknologi / Library | Catatan Security / Alasan Pemilihan |
|---|---|---|
| **Framework** | NestJS (TypeScript) | Architecture berbasis Modular, Dependency Injection, Middleware, Guard, dan Filter bawaan. |
| **Database** | PostgreSQL 16 | Relational Database ACID compliant untuk data akun, token hash, dan audit log. |
| **ORM** | Prisma ORM | Automatic Parameterized Queries (mencegah SQL Injection), Type-safe DB Client. |
| **Auth Mechanism** | JWT (Dual Token) | **Access Token**: Short-lived (15 min). **Refresh Token**: Long-lived (7 days), di-hash di DB & dikirim via HTTP-Only Cookie. |
| **Password Hashing** | `argon2` (Argon2id) | OWASP recommended password hashing algorithm (Memory-hard & Resistant terhadap GPU/ASIC brute-force). |
| **Security Headers** | `helmet` | Mengatur HTTP Security Headers (`X-Frame-Options`, `X-Content-Type-Options`, `Content-Security-Policy`, dll). |
| **Rate Limiting** | `@nestjs/throttler` | Mencegah Brute-force & Denial of Service (DoS) attacks. |
| **Input Validation** | `class-validator` & `class-transformer` | Sanitasi input & Whitelisting DTO (membuang properti berbahaya / tak dikenal). |
| **Audit Logging** | `nestjs-pino` | JSON structured logger, otomatis melakukan masking data sensitif (password, authorization token). |
| **Database Service** | PostgreSQL 16 (Lokal Native) | Service relational database lokal (tanpa Docker) untuk data akun, token hash, dan audit log. |

---

## 🛡️ THREAT MODEL & SECURITY DECISIONS MATRIX

| Ancaman / Vulnerability | Dampak / Risiko | Solusi & Mekanisme Pengamanan | Implementasi di Project |
|---|---|---|---|
| **Brute-Force Login** | Pengambilalihan akun pengguna | Rate Limiting ketat pada endpoint `/auth/login` (Max 5 attempts / minute per IP). | `@nestjs/throttler` dengan Guard khusus Auth. |
| **SQL Injection** | Kebocoran / Kerusakan seluruh DB | Parameterized SQL Queries & Prepared Statements. | Prisma ORM (tanpa raw SQL query un-sanitized). |
| **IDOR / BOLA** (Broken Object Level Authorization) | User A bisa mengedit/membaca data User B via URL `/users/:id` | Ownership Check Guard (resource ID harus cocok dengan JWT identity atau role Admin). | `OwnershipGuard` & Policy check di Service. |
| **Pencurian Password (DB Leak)** | Impersonation massal jika DB bocor | Salted & Hashed passwords menggunakan Argon2id. | `argon2.hash(password, { type: argon2.argon2id })`. |
| **Pencurian JWT (XSS)** | Hacker mencuri token dari `localStorage` | Refresh token disimpan dalam `HttpOnly`, `SameSite=Strict`, `Secure` Cookie. Access Token di memory / Authorization Header. | `Cookie-Parser` + Dual Token Architecture. |
| **Mass Assignment Attack** | Attacker mengirim JSON `{ "isAdmin": true }` pada form registrasi biasa | Strict DTO Whitelisting & Strip unknown fields. | `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })`. |
| **Information Leakage via Errors** | Stack trace internal DB/Server bocor ke publik | Global Exception Filter yang menyembunyikan detail exception internal di mode Production. | Custom `AllExceptionsFilter`. |

---

## 📂 STRUKTUR FOLDER PROJECT (NestJS Architecture)

```text
aegisAPI/
├── .env.example
├── .env.test
├── docker-compose.yml          # (Optional: Untuk Production / Staging)
├── Dockerfile                  # (Optional: Untuk Production containerization)
├── package.json
├── nest-cli.json
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── main.ts                     # Entry point (Helmet, Cors, Global Pipe, Swagger)
│   ├── app.module.ts               # Root module
│   ├── config/                     # Configuration & Environment Validation (Joi/Zod)
│   │   ├── env.config.ts
│   │   └── env.validation.ts
│   ├── common/                     # Cross-cutting security concerns
│   │   ├── decorators/             # Custom decorators (@CurrentUser, @Roles, @Public)
│   │   ├── filters/                # Global HttpExceptionFilter
│   │   ├── guards/                 # JwtAuthGuard, RolesGuard, OwnershipGuard, CustomThrottlerGuard
│   │   ├── interceptors/           # ResponseTransformInterceptor, LoggingInterceptor
│   │   └── pipes/                  # Custom sanitization pipes
│   ├── modules/
│   │   ├── prisma/                 # Prisma Module & Service
│   │   ├── logger/                 # Security & Audit Logger Module (Pino)
│   │   ├── auth/                   # Authentication Module
│   │   │   ├── dto/                # RegisterDto, LoginDto, RefreshTokenDto
│   │   │   ├── strategies/         # JwtAccessStrategy, JwtRefreshStrategy
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.module.ts
│   │   └── users/                  # User Management Module
│   │       ├── dto/                # UpdateUserDto, UserResponseDto
│   │       ├── users.controller.ts
│   │       ├── users.service.ts
│   │       └── users.module.ts
└── test/                           # End-to-End Security Tests
    ├── auth.e2e-spec.ts
    ├── rate-limit.e2e-spec.ts
    └── rbac-ownership.e2e-spec.ts
```

---

## 🚀 ROADMAP EKSEKUSI LANGKAH-DEMI-LANGKAH

---

### Phase 1: Setup Framework & Environment

#### 📌 Objective
Inisialisasi project NestJS, setup `.env` validation, `.gitignore`, dan konfigurasi database PostgreSQL Lokal Native.

#### 📝 Step-by-Step Instructions
1. **Inisialisasi Project NestJS**:
   ```bash
   npx @nestjs/cli new aegisAPI --package-manager npm
   cd aegisAPI
   ```
2. **Install Dependencies Utama**:
   ```bash
   npm install @nestjs/config @nestjs/jwt @nestjs/passport passport passport-jwt @nestjs/throttler helmet class-validator class-transformer argon2 cookie-parser netjs-pino pino-http joi
   npm install --save-dev @types/passport-jwt @types/cookie-parser @types/express @types/node prisma
   ```
3. **Setup `.env.example` dan Validation Schema**:
   Buat file `src/config/env.validation.ts`:
   - Validasi variabel wajib: `PORT`, `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CORS_ORIGIN`, `NODE_ENV`.
4. **Setup & Konfigurasi PostgreSQL Lokal Native**:
   - Install PostgreSQL 16 via official installer (Windows/Linux/macOS) atau jalankan service PostgreSQL lokal.
   - Buka pgAdmin 4 atau psql, lalu buat database baru bernama `aegis_api_db`.
   - Pastikan service PostgreSQL aktif dan berjalan di port `5432`.
5. **Konfigurasi `DATABASE_URL` di `.env`**:
   Sesuaikan `DATABASE_URL` pada `.env` dengan credential PostgreSQL lokal Anda:
   ```env
   DATABASE_URL="postgresql://postgres:password_lokal_anda@localhost:5432/aegis_api_db?schema=public"
   ```

#### ✅ Verification Criteria Phase 1
- Service PostgreSQL lokal berjalan dan database `aegis_api_db` terkonfirmasi dapat dihubungi di `localhost:5432`.
- NestJS app dapat melakukan booting tanpa error konfigurasi environment.

---

### Phase 2: Database Schema & Prisma ORM Configuration

#### 📌 Objective
Konfigurasi Prisma ORM dengan PostgreSQL, mendefinisikan schema `User`, `Role`, `RefreshToken`, dan `AuditLog`.

#### 📝 Step-by-Step Instructions
1. **Inisialisasi Prisma**:
   ```bash
   npx prisma init
   ```
2. **Edit `prisma/schema.prisma`**:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }

   generator client {
     provider = "prisma-client-js"
   }

   enum Role {
     USER
     ADMIN
   }

   model User {
     id            String         @id @default(uuid())
     email         String         @unique
     password      String         // Argon2 Hash
     fullName      String
     role          Role           @default(USER)
     isActive      Boolean        @default(true)
     refreshTokens RefreshToken[]
     auditLogs     AuditLog[]
     createdAt     DateTime       @default(now())
     updatedAt     DateTime       @updatedAt

     @@map("users")
   }

   model RefreshToken {
     id        String   @id @default(uuid())
     tokenHash String   // Argon2 Hash dari Refresh Token
     userId    String
     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
     expiresAt DateTime
     isRevoked Boolean  @default(false)
     createdAt DateTime @default(now())

     @@map("refresh_tokens")
   }

   model AuditLog {
     id        String   @id @default(uuid())
     userId    String?
     user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
     action    String   // Contoh: LOGIN_SUCCESS, ACCESS_DENIED, PASSWORD_CHANGE
     ipAddress String
     userAgent String?
     createdAt DateTime @default(now())

     @@map("audit_logs")
   }
   ```
3. **Jalankan Migration Pertama**:
   ```bash
   npx prisma migrate dev --name init_security_schema
   ```
4. **Buat Prisma Service & Module**:
   ```bash
   nest g module modules/prisma
   nest g service modules/prisma
   ```
   Pastikan `PrismaService` mengimplementasikan `OnModuleInit` dan `enableShutdownHooks`.

#### ✅ Verification Criteria Phase 2
- Tabel `users`, `refresh_tokens`, dan `audit_logs` berhasil terbuat di database PostgreSQL.
- Command `npx prisma studio` dapat membuka GUI database tanpa error.

---

### Phase 3: Core Security Middleware & Configuration

#### 📌 Objective
Konfigurasi pengamanan global pada `main.ts` meliputi Helmet, CORS restrict, ValidationPipe sanitization, Rate Limiting, dan Custom Logger.

#### 📝 Step-by-Step Instructions
1. **Konfigurasi `main.ts`**:
   ```typescript
   import { NestFactory } from '@nestjs/core';
   import { AppModule } from './app.module';
   import helmet from 'helmet';
   import * as cookieParser from 'cookie-parser';
   import { ValidationPipe } from '@nestjs/common';

   async function bootstrap() {
     const app = await NestFactory.create(AppModule);

     // 1. Security HTTP Headers
     app.use(helmet());

     // 2. Cookie Parser for secure HTTP-only cookies
     app.use(cookieParser());

     // 3. Strict CORS Configuration
     app.enableCors({
       origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
       credentials: true,
       methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
       allowedHeaders: ['Content-Type', 'Authorization'],
     });

     // 4. Strict Input Validation & Sanitization (Mass Assignment Protection)
     app.useGlobalPipes(
       new ValidationPipe({
         whitelist: true,               // Hapus property yang tidak ada di DTO
         forbidNonWhitelisted: true,    // Reject request jika ada property terlarang
         transform: true,               // Auto transform payload sesuai tipe DTO
         transformOptions: { enableImplicitConversion: true },
       }),
     );

     // 5. Global API Prefixing
     app.setGlobalPrefix('api/v1');

     await app.listen(process.env.PORT || 3000);
   }
   bootstrap();
   ```
2. **Setup Rate Limiting (`@nestjs/throttler`)**:
   Konfigurasi `ThrottlerModule.forRoot` di `app.module.ts`:
   - Limit Standar: 60 request / min per IP.
   - Limit Strict (Auth): 5 request / min per IP (di-apply menggunakan `@Throttle()` decorator di controller auth).

#### ✅ Verification Criteria Phase 3
- Mengirim request dengan property acak yang tidak didefinisikan di DTO mengembalikan status `400 Bad Request`.
- Response headers memuat HTTP Security Headers dari Helmet (`X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`).

---

### Phase 4: Authentication System

#### 📌 Objective
Mengimplementasikan registrasi, login dengan Argon2 hashing, dual JWT token (Access & Refresh), logout (token revocation), dan endpoint refresh token.

#### 📝 Step-by-Step Instructions
1. **Bikin Auth Module, Service, dan Controller**:
   ```bash
   nest g module modules/auth
   nest g controller modules/auth
   nest g service modules/auth
   ```
2. **Buat Argon2 Hashing Helper (`src/modules/auth/argon2.service.ts`)**:
   - `hashPassword(password: string): Promise<string>`
   - `verifyPassword(hash: string, password: string): Promise<boolean>`
3. **Buat DTO dengan Validasi Ketat**:
   - `RegisterDto`:
     - `email`: `@IsEmail()`, `@Transform(({ value }) => value.toLowerCase().trim())`
     - `password`: `@IsString()`, `@MinLength(8)`, `@Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/)` (Strong Password Rule: Huruf Besar, Kecil, Angka/Simbol).
     - `fullName`: `@IsString()`, `@Length(2, 50)`
   - `LoginDto`: `email` dan `password`.
4. **Implementasi Token Strategy**:
   - `JwtAccessStrategy`: Mengecek token dari header `Authorization: Bearer <token>`.
   - `JwtRefreshStrategy`: Mengecek refresh token dari HTTP-Only Cookie.
5. **Alur Kerja Login & Refresh**:
   - Login sukses -> Buat Access Token (15m expire) + Refresh Token (7d expire).
   - Refresh Token di-hash dengan Argon2 lalu disimpan di tabel `RefreshToken`.
   - Refresh Token mentah dikirim ke client via HTTP-Only Cookie (`res.cookie('refresh_token', token, { httpOnly: true, secure: true, sameSite: 'strict' })`).
   - Endpoint `/auth/refresh` mengecek validitas cookie, memverifikasi hash di DB, lalu menerbitkan Access Token baru (serta melakukan rotation pada Refresh Token).

#### ✅ Verification Criteria Phase 4
- Password yang tersimpan di PostgreSQL terbukti terenkripsi format Argon2 (`$argon2id$...`).
- Login gagal mengembalikan `401 Unauthorized` tanpa memberitahu apakah email atau password yang salah (mencegah User Enumeration attack).
- Endpoint `/auth/refresh` menolak token yang sudah di-revoke atau expired.

---

### Phase 5: Authorization & Resource Protection

#### 📌 Objective
Mengimplementasikan Role-Based Access Control (RBAC) dan Resource Ownership Protection (mencegah IDOR/BOLA).

#### 📝 Step-by-Step Instructions
1. **Custom Decorators**:
   - `@Roles(...roles: Role[])`: Menentukan role minimal yang dibutuhkan.
   - `@Public()`: Menandai endpoint yang bebas diakses publik.
   - `@CurrentUser()`: Extract data payload JWT user dari request.
2. **Guards**:
   - `JwtAuthGuard`: Melindungi seluruh endpoint secara default kecuali yang ditandai `@Public()`.
   - `RolesGuard`: Membandingkan `user.role` dari JWT dengan metadata `@Roles()`.
   - `OwnershipGuard`: Memastikan `req.params.id` sesuai dengan `user.id` pada JWT, KECUALI jika `user.role === 'ADMIN'`.
3. **Controller Test (`src/modules/users/users.controller.ts`)**:
   - `GET /api/v1/users/me` -> Accessible oleh Logged-in User.
   - `GET /api/v1/users` -> Accessible KHUSUS Role `ADMIN`.
   - `GET /api/v1/users/:id` -> Accessible KHUSUS Pemilik akun ID tersebut atau `ADMIN` (Protected by `OwnershipGuard`).

#### ✅ Verification Criteria Phase 5
- User biasa (`USER`) mencoba mengakses `GET /api/v1/users` (Admin endpoint) mengembalikan `403 Forbidden`.
- User A mencoba mengakses / mengubah data User B via `GET /api/v1/users/user-b-uuid` mengembalikan `403 Forbidden` (IDOR Prevention Verified).

---

### Phase 6: Centralized Error Handling & Audit Logging

#### 📌 Objective
Membuat Global Exception Filter untuk memastikan respon error seragam dan aman dari kebocoran stack trace, serta mencatat audit log keamanan.

#### 📝 Step-by-Step Instructions
1. **Buat Format Respon Standard (`src/common/filters/http-exception.filter.ts`)**:
   ```json
   {
     "success": false,
     "statusCode": 403,
     "error": "Forbidden",
     "message": "Anda tidak memiliki akses ke resource ini.",
     "timestamp": "2026-08-16T11:25:00.000Z",
     "path": "/api/v1/users/123"
   }
   ```
2. **Sembunyikan Stack Trace Internal**:
   Jika `NODE_ENV === 'production'`, pastikan error 500 hanya mengembalikan `Internal Server Error` tanpa pesan detail exception PostgreSQL/Prisma.
3. **Audit Log Integration**:
   Setiap kali terjadi `ACCESS_DENIED`, `LOGIN_FAILED`, atau `LOGIN_SUCCESS`, simpan entry baru di tabel `audit_logs` melalui `AuditLogService` yang mencatat `userId`, `action`, `ipAddress`, dan `userAgent`.

#### ✅ Verification Criteria Phase 6
- Sengaja memicu error database internal mengembalikan respon 500 yang rapi tanpa menyebarkan detail SQL query ke client.
- Aktivitas kecurigaan seperti percobaan login gagal tercatat di tabel `audit_logs`.

---

### Phase 7: API Documentation

#### 📌 Objective
Integrasi Swagger OpenAPI dengan konfigurasi pengamanan Bearer Auth dan DTO scheme annotations.

#### 📝 Step-by-Step Instructions
1. **Setup `@nestjs/swagger` di `main.ts`**:
   ```typescript
   import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

   const config = new DocumentBuilder()
     .setTitle('aegisAPI Specification')
     .setDescription('Dokumentasi API Teramankan dengan JWT, RBAC, dan Protection Mechanisms')
     .setVersion('1.0')
     .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'access-token')
     .build();

   const document = SwaggerModule.createDocument(app, config);
   SwaggerModule.setup('api/docs', app, document);
   ```
2. **Tambahkan Decorator pada DTO & Controller**:
   Gunakan `@ApiTags()`, `@ApiOperation()`, `@ApiResponse()`, `@ApiProperty()` pada DTO registrasi/login agar dokumentasi rapi dan interactive testing di Swagger berjalan lancar.

#### ✅ Verification Criteria Phase 7
- Akses `http://localhost:3000/api/docs` menampilkan antarmuka Swagger UI.
- Fitur "Authorize" di Swagger dapat menerima JWT Bearer Token dan menguji protected endpoints.

---

### Phase 8: Testing & Verification

#### 📌 Objective
Menulis skenario otomatisasi E2E testing untuk memastikan semua layer keamanan (Rate Limit, Auth, IDOR, Validation) berfungsi 100%.

#### 📝 Step-by-Step Instructions
1. **Buat Security E2E Test Suite (`test/security.e2e-spec.ts`)**:
   Skenario pengujian wajib:
   - 🧪 **Test 1**: Registrasi user baru + Validasi password lemah (harus reject).
   - 🧪 **Test 2**: Login dengan password benar vs password salah.
   - 🧪 **Test 3**: Rate limiting test — Kirim 6 request login beruntun dari IP sama (request ke-6 harus `429 Too Many Requests`).
   - 🧪 **Test 4**: IDOR Test — User A mencoba fetch `/users/:id_user_b` (harus `403 Forbidden`).
   - 🧪 **Test 5**: Mass assignment test — Kirim payload `{ email, password, role: "ADMIN" }` pada registrasi publik (role harus tetap ter-assign `USER`).
2. **Jalankan E2E Test**:
   ```bash
   npm run test:e2e
   ```
3. **Multi-stage Production Dockerfile**:
   Buat `Dockerfile` teroptimasi (non-root user, minimal image size).

#### ✅ Verification Criteria Phase 8
- Seluruh E2E Test Suite berhasil `PASSED` (100% green pass rate).
- Docker image terbangun dengan sukses dan run di container tanpa privileges `root`.

---

## 🧪 PANDUAN PENGUJIANKU & CHECKLIST ACCEPTABILITY CRITERIA

Untuk junior programmer atau AI model yang mengimplementasikan plan ini, pastikan checklist berikut tercentang sepenuhnya sebelum menyerahkan kode:

- [ ] **1. Authentication & Security Hashing**
  - [ ] Password menggunakan Argon2id hash.
  - [ ] Access Token expired dalam 15 menit.
  - [ ] Refresh Token tersimpan dalam hash di DB & HTTP-Only Cookie.
- [ ] **2. Authorization & Data Access Control**
  - [ ] Guard RBAC (`USER` vs `ADMIN`) berjalan dengan presisi.
  - [ ] Ownership Guard mencegah IDOR pada resource user-specific.
- [ ] **3. Protection Middleware**
  - [ ] Helmet aktif di HTTP responses.
  - [ ] CORS terkonfigurasi secara eksplisit.
  - [ ] Rate Limit (Throttler) aktif pada endpoint sensitif.
  - [ ] ValidationPipe menolak payload tak dikenal (`whitelist: true`).
- [ ] **4. Code Quality & Ops**
  - [ ] Error response seragam dan tanpa stack trace leak di production.
  - [ ] Audit log mencatat insiden keamanan.
  - [ ] Swagger API Documentation dapat diakses di `/api/docs`.
  - [ ] Unit & E2E Tests lulus tanpa error.

---

### 📌 Contoh README Threat Model (Untuk Dimasukkan ke Root Repository)

```markdown
## 🛡️ Threat Model & Security Decisions

Project ini dirancang dengan memprioritaskan keamanan backend sesuai OWASP Top 10 guidelines.

### Security Highlights:
1. **Password Hashing**: Menggunakan Argon2id untuk mencegah brute-force offline berbasis GPU/ASIC.
2. **Rate Limiting**: Endpoint `/api/v1/auth/login` dibatasi max 5 request/menit per IP untuk menangkal credential stuffing.
3. **IDOR Defense**: Endpoint `/api/v1/users/:id` diverifikasi menggunakan `OwnershipGuard`, memastikan pengguna hanya dapat mengelola data milik sendiri kecuali admin.
4. **Input Sanitization**: Seluruh payload di-filtering menggunakan NestJS `ValidationPipe` dengan opsi `whitelist: true` & `forbidNonWhitelisted: true`.
```
