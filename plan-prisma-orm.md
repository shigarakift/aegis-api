# 🗄️ Master Plan & Panduan Implementasi: Prisma ORM (aegisAPI)

> **Target Pelaksana:** Junior Programmer / Budget/Small AI Model (GPT-4o-mini, Claude Haiku, Gemini Flash, dll)  
> **Tingkat Kesulitan:** Terstruktur / Step-by-Step (Tanpa Ambigu)  
> **Tujuan:** Mengimplementasikan, mengonfigurasi, dan mengoptimalkan Prisma ORM untuk backend **aegisAPI** (NestJS + PostgreSQL 16) dengan standar performa tinggi, integritas relasi relasional, pengindeksan optimal, dan kepatuhan keamanan data OWASP.

---

## 📋 DAFTAR ISI

1. [Ringkasan Arsitektur & Entity Relationship Diagram (ERD)](#1-ringkasan-arsitektur--entity-relationship-diagram-erd)
2. [Spesifikasi Tabel & Desain Relasi Database](#2-spesifikasi-tabel--desain-relasi-database)
3. [Implementasi File Schema (`prisma/schema.prisma`)](#3-implementasi-file-schema-prismaschemaprisma)
4. [Konfigurasi Environment & Koneksi Database](#4-konfigurasi-environment--koneksi-database)
5. [Alur Eksekusi Migration & Prisma Client Generation](#5-alur-eksekusi-migration--prisma-client-generation)
6. [Implementasi Database Seeder (`prisma/seed.ts`)](#6-implementasi-database-seeder-prismaseedts)
7. [Integrasi Service & Module di NestJS (`PrismaService`)](#7-integrasi-service--module-di-nestjs-prismaservice)
8. [Panduan Query Standar & Keamanan Akses Data](#8-panduan-query-standar--keamanan-akses-data)
9. [Penanganan Error Prisma (Error Codes Handling)](#9-penanganan-error-prisma-error-codes-handling)
10. [Checklist Verifikasi & Pengujian (Acceptance Criteria)](#10-checklist-verifikasi--pengujian-acceptance-criteria)
11. [Panduan Troubleshooting & Common Pitfalls](#11-panduan-troubleshooting--common-pitfalls)

---

## 1. RINGKASAN ARSITEKTUR & ENTITY RELATIONSHIP DIAGRAM (ERD)

Database **aegis_api_db** menggunakan **PostgreSQL 16** dan dimapping melalui **Prisma ORM**. Seluruh tabel menggunakan penamaan *snake_case* pada level SQL fisik (`@@map`), sementara atribut dalam kode TypeScript menggunakan *camelCase*.

### 📊 Diagram Relasi Entitas (Mermaid ERD)

```mermaid
erDiagram
    Role {
        enum USER
        enum ADMIN
    }

    User ||--o{ RefreshToken : "has many (1:N, onDelete: Cascade)"
    User ||--o{ AuditLog : "has many (1:N, onDelete: SetNull)"

    User {
        String id PK "UUID v4"
        String email UK "Unique, lowercased"
        String password "Argon2id Hash String"
        String fullName "Nama lengkap pengguna"
        Role role "USER / ADMIN (Default: USER)"
        Boolean isActive "Status akun aktif (Default: true)"
        DateTime createdAt "Timestamp pembuatan"
        DateTime updatedAt "Timestamp update otomatis"
    }

    RefreshToken {
        String id PK "UUID v4"
        String tokenHash "Argon2id Hash dari Refresh Token"
        String userId FK "Foreign Key ke users.id"
        DateTime expiresAt "Masa berlaku token (7 hari)"
        Boolean isRevoked "Status pencabutan token (Default: false)"
        DateTime createdAt "Timestamp pembuatan"
    }

    AuditLog {
        String id PK "UUID v4"
        String userId FK "Foreign Key ke users.id (Nullable)"
        String action "Contoh: LOGIN_SUCCESS, ACCESS_DENIED"
        String ipAddress "IP Address client pemanggil"
        String userAgent "Header User-Agent browser/client"
        DateTime createdAt "Timestamp insiden"
    }
```

---

## 2. SPESIFIKASI TABEL & DESAIN RELASI DATABASE

### A. Tabel `users` (`User`)
- **Fungsi:** Menyimpan data identitas akun, kredensial password ter-hash, peran akses (RBAC), dan status aktifasi.
- **Karakteristik Keamanan:**
  - Password disimpan dalam format hash **Argon2id** (tidak boleh plaintext).
  - Email bersifat *case-insensitive* unik (selalu di-lowercase sebelum disimpan).
- **Index & Optimization:**
  - `email` (B-Tree Unique Index) untuk mempercepat query saat login/registrasi.
  - `role` & `isActive` untuk filtering user aktif/admin.

### B. Tabel `refresh_tokens` (`RefreshToken`)
- **Fungsi:** Menyimpan jejak refresh token yang aktif untuk mendukung mekanisme *Dual Token Authentication* dan *Token Rotation*.
- **Karakteristik Keamanan:**
  - Nilai token yang disimpan adalah **Hash Argon2id** dari refresh token asli (jika database bocor, penyerang tidak bisa menggunakan refresh token tersebut).
  - Relasi ke `User` menggunakan `onDelete: Cascade` (jika user dihapus, seluruh refresh token miliknya otomatis terhapus).
- **Index & Optimization:**
  - Index pada `[userId, isRevoked, expiresAt]` untuk mempercepat lookup token aktif saat refresh.

### C. Tabel `audit_logs` (`AuditLog`)
- **Fungsi:** Mencatat jejak audit keamanan forensik (misal: login gagal, akses ditolak, perubahan data).
- **Karakteristik Keamanan:**
  - Relasi ke `User` menggunakan `onDelete: SetNull` (jika user dihapus, rekaman log tetap tersimpan untuk audit forensik dengan `userId = NULL`).
- **Index & Optimization:**
  - Index pada `action`, `userId`, dan `createdAt` untuk mempermudah pemfilteran log keamanan berdasarkan waktu dan jenis aktivitas.

---

## 3. IMPLEMENTASI FILE SCHEMA (`prisma/schema.prisma`)

Salin dan gunakan konfigurasi schema berikut secara persis pada file `prisma/schema.prisma`:

```prisma
// ==========================================
// 1. DATASOURCE CONFIGURATION
// ==========================================
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ==========================================
// 2. GENERATOR CLIENT CONFIGURATION
// ==========================================
generator client {
  provider = "prisma-client-js"
}

// ==========================================
// 3. ENUMS
// ==========================================
enum Role {
  USER
  ADMIN
}

// ==========================================
// 4. ENTITY MODELS
// ==========================================

/// Model User: Menyimpan data kredensial dan profil dasar pengguna
model User {
  id            String         @id @default(uuid())
  email         String         @unique
  password      String         // Hash Argon2id
  fullName      String         @map("full_name")
  role          Role           @default(USER)
  isActive      Boolean        @default(true) @map("is_active")
  
  // Relasi
  refreshTokens RefreshToken[]
  auditLogs     AuditLog[]

  // Timestamps
  createdAt     DateTime       @default(now()) @map("created_at")
  updatedAt     DateTime       @updatedAt @map("updated_at")

  @@index([role, isActive])
  @@map("users")
}

/// Model RefreshToken: Menyimpan hash refresh token aktif (Token Rotation & Revocation)
model RefreshToken {
  id        String   @id @default(uuid())
  tokenHash String   @map("token_hash") // Hash Argon2id dari Refresh Token mentah
  userId    String   @map("user_id")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  expiresAt DateTime @map("expires_at")
  isRevoked Boolean  @default(false) @map("is_revoked")
  createdAt DateTime @default(now()) @map("created_at")

  // Index komposit untuk query pencarian token aktif
  @@index([userId, isRevoked, expiresAt])
  @@map("refresh_tokens")
}

/// Model AuditLog: Jejak audit aktivitas keamanan dan investigasi insiden
model AuditLog {
  id        String   @id @default(uuid())
  userId    String?  @map("user_id")
  user      User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  action    String   // Contoh: LOGIN_SUCCESS, LOGIN_FAILED, ACCESS_DENIED, PASSWORD_CHANGE
  ipAddress String   @map("ip_address")
  userAgent String?  @map("user_agent")
  createdAt DateTime @default(now()) @map("created_at")

  @@index([userId])
  @@index([action])
  @@index([createdAt])
  @@map("audit_logs")
}
```

---

## 4. KONFIGURASI ENVIRONMENT & KONEKSI DATABASE

Pastikan file `.env` di root project memiliki variabel `DATABASE_URL` yang valid mengarah ke PostgreSQL lokal atau staging:

### Format Connection String PostgreSQL:
```env
DATABASE_URL="postgresql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<DB_PORT>/<DB_NAME>?schema=public"
```

### Contoh konfigurasi lokal standar (`.env`):
```env
PORT=3000
NODE_ENV=development
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aegis_api_db?schema=public"
JWT_ACCESS_SECRET="super_secret_access_key_aegis_api_2026_change_me"
JWT_REFRESH_SECRET="super_secret_refresh_key_aegis_api_2026_change_me"
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
CORS_ORIGIN="http://localhost:3000"
```

> ⚠️ **Catatan Penting untuk Pelaksana:**
> 1. Pastikan PostgreSQL 16 aktif di port `5432`.
> 2. Pastikan database bernama `aegis_api_db` sudah dibuat di PostgreSQL (`CREATE DATABASE aegis_api_db;`).
> 3. Jika password postgres Anda berbeda, sesuaikan pada string di atas.

---

## 5. ALUR EKSEKUSI MIGRATION & PRISMA CLIENT GENERATION

Ikuti langkah-langkah berikut secara berurutan di terminal (Command Prompt / PowerShell / Bash):

### Langkah 1: Format & Validasi File Schema
Pastikan tidak ada syntax error pada schema Prisma:
```bash
npx prisma format
```

### Langkah 2: Buat & Jalankan Database Migration
Jalankan migrasi pertama untuk membuat struktur tabel di PostgreSQL:
```bash
npx prisma migrate dev --name init_aegis_schema
```
*Hasil yang diharapkan: Folder `prisma/migrations/` terbentuk dan berisi file SQL migrasi.*

### Langkah 3: Generate Prisma Client TypeScript Typings
Generate ulang Prisma Client agar seluruh tipe TypeScript ter-update di folder `node_modules/@prisma/client`:
```bash
npx prisma generate
```

### Langkah 4: Verifikasi Visual dengan Prisma Studio (Opsional)
Buka antarmuka visual GUI untuk memastikan tabel telah terbentuk di database:
```bash
npx prisma studio
```
*(Buka URL `http://localhost:5555` di browser, periksa tabel `users`, `refresh_tokens`, dan `audit_logs`).*

---

## 6. IMPLEMENTASI DATABASE SEEDER (`prisma/seed.ts`)

Seeder ini digunakan untuk mengisi database dengan akun default (Superadmin & Demo User) secara otomatis saat setup awal.

### 📝 Buat file `prisma/seed.ts`:

```typescript
import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Memulai proses seeding database aegisAPI...');

  // 1. Buat Hash Password Default menggunakan Argon2id
  const adminPassword = await argon2.hash('AdminSecure2026!', {
    type: argon2.argon2id,
  });

  const userPassword = await argon2.hash('UserSecure2026!', {
    type: argon2.argon2id,
  });

  // 2. Upsert Akun Superadmin (Mencegah duplikasi jika seeder dijalankan ulang)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@aegis.local' },
    update: {},
    create: {
      email: 'admin@aegis.local',
      password: adminPassword,
      fullName: 'System Administrator',
      role: Role.ADMIN,
      isActive: true,
    },
  });

  // 3. Upsert Akun Demo Standard User
  const user = await prisma.user.upsert({
    where: { email: 'user@aegis.local' },
    update: {},
    create: {
      email: 'user@aegis.local',
      password: userPassword,
      fullName: 'Demo Standard User',
      role: Role.USER,
      isActive: true,
    },
  });

  // 4. Buat Sample Audit Log Initial
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'SYSTEM_DATABASE_SEEDED',
      ipAddress: '127.0.0.1',
      userAgent: 'System Seeder / Migration Script',
    },
  });

  console.log('✅ Seeding selesai dengan sukses!');
  console.log(`   - Admin Account: ${admin.email} (Password: AdminSecure2026!)`);
  console.log(`   - User Account : ${user.email} (Password: UserSecure2026!)`);
}

main()
  .catch((e) => {
    console.error('❌ Error saat menjalankan seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### ⚙️ Tambahkan Konfigurasi Prisma Seed di `package.json`:

Buka `package.json`, tambahkan blok `"prisma"` di bawah dependencies (atau di level root JSON):

```json
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "prisma:seed": "prisma db seed",
    "prisma:reset": "prisma migrate reset --force"
  }
```

### 🚀 Jalankan Seeder:
```bash
npx prisma db seed
```

---

## 7. INTEGRASI SERVICE & MODULE DI NESTJS (`PrismaService`)

Pastikan integrasi NestJS Prisma Module telah dikonfigurasi dengan *lifecycle management* yang benar.

### A. File `src/modules/prisma/prisma.service.ts`
Pastikan mengimplementasikan `OnModuleInit` dan `OnModuleDestroy` untuk auto-connect dan graceful disconnect:

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
      errorFormat: 'colorless',
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database PostgreSQL berhasil terkoneksi melalui Prisma ORM.');
    } catch (error) {
      this.logger.error('❌ Gagal mengoneksikan Prisma ke Database:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Koneksi Prisma ke Database berhasil diputuskan (Clean Shutdown).');
  }
}
```

### B. File `src/modules/prisma/prisma.module.ts`
Jadikan module Prisma bersifat `@Global()` agar dapat diakses dari semua module tanpa perlu re-import berulang:

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

---

## 8. PANDUAN QUERY STANDAR & KEAMANAN AKSES DATA

Bagi programmer atau AI yang mengimplementasikan fitur baru, patuhi 4 aturan emas query Prisma berikut:

### 🔒 Aturan 1: DILARANG Me-return Password Hash ke Controller / Client
Selalu gunakan klausul `select` secara eksplisit saat melakukan query data pengguna:

```typescript
// ✅ BENAR & AMAN:
const user = await this.prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    email: true,
    fullName: true,
    role: true,
    isActive: true,
    createdAt: true,
  },
});

// ❌ SALAH & BERBAHAYA (Password hash bocor ke frontend):
const user = await this.prisma.user.findUnique({ where: { id: userId } });
```

### 🔒 Aturan 2: Gunakan Parameterized Query Bawaan Prisma
Jangan pernah menggunakan string interpolation un-sanitized pada `$queryRaw`. Gunakan tag template `$queryRaw` Prisma yang otomatis mencegah **SQL Injection**:

```typescript
// ✅ BENAR & AMAN (Prisma otomatis membuat Prepared Statement):
const users = await this.prisma.$queryRaw`SELECT id, email FROM users WHERE role = ${userRole}::"Role"`;

// ❌ SALAH & RENTAN SQL INJECTION:
// const users = await this.prisma.$queryRawUnsafe(`SELECT * FROM users WHERE role = '${userRole}'`);
```

### 🔒 Aturan 3: Token Lookup dengan Filtering Lengkap
Saat memvalidasi Refresh Token, pastikan selalu menyertakan filter `isRevoked: false` dan `expiresAt > now()`:

```typescript
const activeTokens = await this.prisma.refreshToken.findMany({
  where: {
    userId,
    isRevoked: false,
    expiresAt: { gt: new Date() },
  },
});
```

### 🔒 Aturan 4: Logging Audit Bersifat Non-Blocking
Query pencatatan audit log tidak boleh memblokir flow utama aplikasi atau menggagalkan request jika logging gagal:

```typescript
try {
  await this.prisma.auditLog.create({
    data: {
      userId: user.id,
      action: 'USER_LOGIN',
      ipAddress: ip,
      userAgent: ua,
    },
  });
} catch (logError) {
  this.logger.error('Gagal mencatat audit log:', logError);
}
```

---

## 9. PENANGANAN ERROR PRISMA (ERROR CODES HANDLING)

Ketika Prisma mengalami constraint error dari PostgreSQL, Prisma akan melempar `PrismaClientKnownRequestError`. Tangani error codes berikut di Service layer atau Global Exception Filter:

| Prisma Error Code | Penyebab di Database | HTTP Status Code Rekomendasi | Pesan Respon yang Aman |
|---|---|---|---|
| `P2002` | Pelanggaran Unique Constraint (misal: email kembar). | `409 Conflict` | `"Email sudah terdaftar dalam sistem."` |
| `P2025` | Record tidak ditemukan saat operasi `update` / `delete`. | `404 Not Found` | `"Data yang diminta tidak ditemukan."` |
| `P2003` | Pelanggaran Foreign Key constraint. | `400 Bad Request` | `"Referensi data terkait tidak valid."` |
| `P2024` | Connection pool timeout (database sibuk/down). | `503 Service Unavailable` | `"Layanan database sedang tidak tersedia. Coba beberapa saat lagi."` |

### Contoh Snippet Penanganan di Service / Filter:

```typescript
import { Prisma } from '@prisma/client';
import { ConflictException, NotFoundException, InternalServerErrorException } from '@nestjs/common';

try {
  return await this.prisma.user.create({ data: userData });
} catch (error) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      throw new ConflictException('Email sudah terdaftar.');
    }
    if (error.code === 'P2025') {
      throw new NotFoundException('Data tidak ditemukan.');
    }
  }
  throw new InternalServerErrorException('Terjadi kesalahan internal pada database.');
}
```

---

## 10. CHECKLIST VERIFIKASI & PENGUJIAN (ACCEPTANCE CRITERIA)

Untuk memastikan implementasi ORM telah 100% sempurna, jalankan checklist pengujian berikut:

- [ ] **1. Schema & Migration Validation**
  - [ ] Perintah `npx prisma format` berjalan tanpa warning/error syntax.
  - [ ] Perintah `npx prisma migrate dev` berhasil membuat tabel fisik: `users`, `refresh_tokens`, dan `audit_logs` di PostgreSQL.
  - [ ] Kolom field mapping (`@map` dan `@@map`) berhasil membuat nama kolom snake_case di database.
- [ ] **2. Seeder Execution**
  - [ ] Perintah `npx prisma db seed` berhasil mengeksekusi `prisma/seed.ts`.
  - [ ] Akun `admin@aegis.local` dan `user@aegis.local` berhasil terbuat dengan password terenkripsi Argon2id (`$argon2id$...`).
- [ ] **3. Relational Cascading Test**
  - [ ] Menghapus User menghapus seluruh `refresh_tokens` miliknya secara otomatis (*Cascade Delete*).
  - [ ] Menghapus User mengubah `userId` pada `audit_logs` miliknya menjadi `NULL` (*SetNull*), tanpa menghapus record log.
- [ ] **4. NestJS Application Runtime**
  - [ ] Jalankan `npm run start:dev`.
  - [ ] Aplikasi NestJS melakukan booting dan log `✅ Database PostgreSQL berhasil terkoneksi melalui Prisma ORM.` muncul di konsol.
  - [ ] Swagger API di `http://localhost:3000/api/docs` dapat digunakan untuk registrasi dan login tanpa runtime error Prisma.

---

## 11. PANDUAN TROUBLESHOOTING & COMMON PITFALLS

### ❌ Masalah 1: `Error: Can't reach database server at localhost:5432`
- **Penyebab:** PostgreSQL Service belum menyala atau kredensial `.env` salah.
- **Solusi:**
  1. Buka Services di Windows (`services.msc`), pastikan service `postgresql-x64-16` dalam status *Running*.
  2. Buka pgAdmin / psql dan uji login manual dengan username/password yang sama seperti di `.env`.

### ❌ Masalah 2: `The table public.users does not exist in the current database`
- **Penyebab:** Migration belum pernah dijalankan atau database baru dibuat.
- **Solusi:** Jalankan `npx prisma migrate dev --name init_aegis_schema`.

### ❌ Masalah 3: TypeScript error `Property 'user' does not exist on type 'PrismaService'`
- **Penyebab:** Prisma Client typings belum ter-generate setelah perubahan schema.
- **Solusi:** Jalankan `npx prisma generate` lalu restart NestJS dev server (`npm run start:dev`).

### ❌ Masalah 4: `Unique constraint failed on the fields: (email)` saat Seeding
- **Penyebab:** Record sudah ada di database.
- **Solusi:** Seeder sudah menggunakan `prisma.user.upsert()`. Jika masih error, reset database dengan `npx prisma migrate reset --force`.
