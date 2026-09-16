# ==============================================================================
# Stage 1: Builder (Kompilasi TypeScript & Dependency Resolution)
# ==============================================================================
FROM node:20-alpine AS builder

WORKDIR /app

# Salin package manifest
COPY package*.json ./

# Install dependencies (termasuk devDependencies untuk build)
RUN npm ci

# Salin source code
COPY . .

# Kompilasi aplikasi NestJS ke Javascript (dist/)
RUN npm run build

# ==============================================================================
# Stage 2: Production Runner (Ramping, Aman, Non-Root User)
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

# Pasang package manifest dan install hanya production dependencies
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Salin hasil kompilasi dari stage builder
COPY --from=builder /app/dist ./dist

# Siapkan direktori upload avatar dengan kepemilikan user non-root
RUN mkdir -p /app/uploads/avatars && chown -R node:node /app

# Jalankan container menggunakan user bawaan non-root demi keamanan (Least Privilege)
USER node

# Port default aplikasi
EXPOSE 3000

ENV NODE_ENV=production

# Perintah menjalankan REST API
CMD ["node", "dist/src/main"]
