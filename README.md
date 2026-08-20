# 🛡️ aegisAPI — Production-Ready Secured REST API

<p align="center">
  <img src="https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white" alt="NestJS" />
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL_16-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma_ORM-2D3748?style=for-the-badge&logo=prisma&logoColor=white" alt="Prisma" />
  <img src="https://img.shields.io/badge/OWASP-Top_10_Compliant-success?style=for-the-badge&logo=owasp&logoColor=white" alt="OWASP" />
</p>

---

## 📌 1. Tujuan Proyek (Project Objective)

**aegisAPI** adalah implementasi backend RESTful API berstandar industri (*enterprise-grade*) yang dirancang khusus dengan filosofi **Security-by-Design** dan **Defense-in-Depth**. 

Tujuan utama proyek ini adalah menyediakan fondasi REST API yang **kebal terhadap kerentanan OWASP Top 10** (seperti *Broken Object Level Authorization/IDOR*, *SQL Injection*, *Credential Stuffing*, *Mass Assignment*, dan *XSS Token Theft*), sekaligus menjaga performa tinggi, modularitas, dan kemudahan integrasi dengan aplikasi frontend modern (React, Next.js, Vue, Mobile App).

---

## 🛡️ 2. Fitur Keamanan Unggulan (Security Highlights)

| Lapisan Keamanan | Ancaman yang Dicegah (Threat) | Mekanisme & Implementasi di aegisAPI |
|---|---|---|
| **Argon2id Hashing** | *Password Cracking / Offline DB Leak* | Password di-hash menggunakan algoritma **Argon2id** (Memory-hard & ASIC/GPU-resistant). |
| **Dual Token Architecture** | *XSS Attack & Long-lived Token Theft* | **Access Token** berumur pendek (15 menit) disimpan di memory; **Refresh Token** (7 hari) disimpan di `HttpOnly`, `SameSite=Strict`, `Secure` Cookie. |
| **Token Rotation & Revocation** | *Replay Attack / Stolen Refresh Token* | Hash refresh token disimpan di DB. Setiap refresh token dipakai, token lama di-revoke dan digantikan token baru (*Rotation*). |
| **IDOR / BOLA Prevention** | *Unauthorized Data Manipulation via ID in URL* | `OwnershipGuard` memverifikasi bahwa `params.id` sesuai dengan identitas JWT pemanggil (atau pemanggil memiliki role `ADMIN`). |
| **Role-Based Access Control (RBAC)** | *Privilege Escalation* | `@Roles(Role.ADMIN)` dan `RolesGuard` membatasi endpoint sensitif hanya untuk otorisasi yang sah. |
| **Mass Assignment Protection** | *Unauthorized Property Injection* | `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` menolak payload dengan properti tak dikenal. |
| **Rate Limiting (Anti-Brute Force)** | *Credential Stuffing / DoS* | `@nestjs/throttler` membatasi percobaan login (maksimal 5 attempt/menit per IP) dan 60 req/menit global. |
| **SQL Injection Defense** | *Database Takeover / Data Exfiltration* | Prisma ORM dengan *Parameterized Prepared Statements* otomatis tanpa query mentah un-sanitized. |
| **Security HTTP Headers** | *Clickjacking, MIME Sniffing, XSS* | `helmet` middleware otomatis menginjeksi HTTP security headers. |
| **Structured Audit Logging** | *Non-repudiation & Forensic Incident Response* | Pencatatan setiap aksi autentikasi dan kegagalan akses ke tabel `audit_logs` dan structured JSON logging (`nestjs-pino`). |

---

## 🏗️ 3. Arsitektur Data & Relasi Database (ERD)

Database menggunakan **PostgreSQL 16** yang dikelola melalui **Prisma ORM**:

```mermaid
erDiagram
    Role {
        enum USER
        enum ADMIN
    }

    User ||--o{ RefreshToken : "1:N (onDelete: Cascade)"
    User ||--o{ AuditLog : "1:N (onDelete: SetNull)"

    User {
        String id PK "UUID v4"
        String email UK "Unique, lowercased"
        String password "Argon2id Hash"
        String fullName "Nama lengkap"
        Role role "USER / ADMIN"
        Boolean isActive "Status akun aktif"
        DateTime createdAt "Timestamp created"
        DateTime updatedAt "Timestamp updated"
    }

    RefreshToken {
        String id PK "UUID v4"
        String tokenHash "Argon2id Hash dari Refresh Token"
        String userId FK "Foreign Key -> users.id"
        DateTime expiresAt "Expiration (7 days)"
        Boolean isRevoked "Status pencabutan token"
        DateTime createdAt "Timestamp created"
    }

    AuditLog {
        String id PK "UUID v4"
        String userId FK "Foreign Key -> users.id (Nullable)"
        String action "Contoh: LOGIN_SUCCESS, ACCESS_DENIED"
        String ipAddress "IP Address client"
        String userAgent "User-Agent client"
        DateTime createdAt "Timestamp kejadian"
    }
```

---

## 📁 4. Struktur Folder Project

```text
aegisAPI/
├── prisma/
│   └── schema.prisma           # Prisma schema (PostgreSQL datasource, models, indexes)
├── src/
│   ├── main.ts                 # Bootstrap application (Helmet, CORS, Validation, Swagger)
│   ├── app.module.ts           # Root application module & global guards/filters
│   ├── config/                 # Environment validation schema (Joi)
│   │   └── env.validation.ts
│   ├── common/                 # Cross-cutting security concerns
│   │   ├── decorators/         # @CurrentUser, @Roles, @Public
│   │   ├── filters/            # Global AllExceptionsFilter (sanitized response)
│   │   └── guards/             # JwtAuthGuard, RolesGuard, OwnershipGuard
│   └── modules/
│       ├── prisma/             # Prisma Service & Global Module
│       ├── logger/             # Structured Pino logger & AuditLogService
│       ├── auth/               # Authentication module (Register, Login, Refresh, Logout)
│       │   ├── dto/            # RegisterDto, LoginDto
│       │   ├── strategies/     # JwtAccessStrategy, JwtRefreshStrategy
│       │   └── argon2.service.ts
│       └── users/              # User management module (Profile, Admin management)
│           └── dto/            # UpdateUserDto
├── test/                       # E2E & Security Test Suites
├── .env.example                # Template environment variables
├── flow-aegsAPI.md             # Dokumen teknis alur kerja & frontend integration guide
├── plan-prisma-orm.md          # Dokumen teknis implementasi Prisma ORM
└── README.md
```

---

## 🚀 5. Panduan Instalasi & Menjalankan Project

### 📋 Prerequisites
- **Node.js**: v20.x atau lebih baru
- **PostgreSQL**: v16.x (berjalan di port `5432`)
- **npm** / **pnpm** / **yarn**

### ⚙️ Langkah Setup

1. **Clone Repository**:
   ```bash
   git clone https://github.com/shigarakift/aegis-api.git
   cd aegis-api
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Setup Environment Variables**:
   Salin `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Sesuaikan `DATABASE_URL` dengan kredensial PostgreSQL lokal Anda:
   ```env
   PORT=3000
   NODE_ENV=development
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/aegis_api_db?schema=public"
   DB_HOST="host_postgres_anda"
   DB_PASSWORD="password_db_anda"
   DB_DATABASE="nama_database_anda"
   JWT_ACCESS_SECRET="ganti_dengan_secret_access_key_yang_sangat_panjang_dan_kuat"
   JWT_REFRESH_SECRET="ganti_dengan_secret_refresh_key_yang_sangat_panjang_dan_kuat"
   JWT_ACCESS_EXPIRES_IN="15m"
   JWT_REFRESH_EXPIRES_IN="7d"
   CORS_ORIGIN="http://localhost:3000"
   ```

4. **Sinkronisasi Database (Prisma ORM)**:
   ```bash
   npx prisma db push
   ```

5. **Jalankan Aplikasi dalam Mode Development**:
   ```bash
   npm run start:dev
   ```

Aplikasi akan berjalan di: `http://localhost:3000/api/v1`

---

## 📖 6. Dokumentasi API & Endpoint (Swagger OpenAPI)

Dokumentasi interaktif OpenAPI/Swagger tersedia di:
👉 **`http://localhost:3000/api/docs`**

### Ringkasan Endpoints Utama:

| Method | Endpoint | Akses / Guard | Deskripsi |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | `@Public()` | Registrasi akun pengguna baru (Role default: `USER`). |
| `POST` | `/api/v1/auth/login` | `@Public()`, Rate Limit (5/min) | Login akun, mengembalikan Access Token & set Cookie Refresh Token. |
| `POST` | `/api/v1/auth/refresh` | `@Public()` (Cookie-based) | Melakukan rotasi refresh token dan menerbitkan access token baru. |
| `POST` | `/api/v1/auth/logout` | `JwtAuthGuard` | Mencabut (*revoke*) refresh token aktif dan menghapus cookie. |
| `GET` | `/api/v1/users/me` | `JwtAuthGuard` | Mendapatkan data profil pengguna yang sedang login. |
| `GET` | `/api/v1/users` | `JwtAuthGuard` + `@Roles('ADMIN')` | Mengambil seluruh daftar pengguna (Khusus Admin). |
| `GET` | `/api/v1/users/:id` | `JwtAuthGuard` + `OwnershipGuard` | Mengambil data pengguna berdasarkan ID (Pemilik sah atau Admin). |
| `PATCH` | `/api/v1/users/:id` | `JwtAuthGuard` + `OwnershipGuard` | Memperbarui data pengguna (Pemilik sah atau Admin). |

---

## 🧪 7. Pengujian & Verifikasi Keamanan (Testing)

Jalankan suite pengujian unit dan End-to-End (E2E) keamanan:

```bash
# Menjalankan E2E Security Tests
npm run test:e2e

# Menjalankan Unit Tests
npm run test
```

Skenario pengujian keamanan mencakup:
- 🧪 Verifikasi penolakan password lemah (*Password Complexity Rule*).
- 🧪 Verifikasi proteksi *Brute-Force Login* (respon `429 Too Many Requests` pada request ke-6).
- 🧪 Verifikasi proteksi **IDOR** (User A tidak dapat mengakses `/users/:id_user_b` -> respon `403 Forbidden`).
- 🧪 Verifikasi pencegahan *Mass Assignment* (parameter role yang diinjeksi saat registrasi diabaikan).

---

## 🌿 8. Strategi Branch Git

- **`main`**: Branch produksi/rilis yang stabil.
- **`development`**: Branch aktif untuk penambahan fitur dan eksperimen sebelum digabungkan ke `main`.

---

## 📄 License
Proyek ini dilisensikan di bawah lisensi UNLICENSED / Hak Cipta Dilindungi.
