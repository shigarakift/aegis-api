import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AuditLog } from './entities/audit-log.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { User } from './entities/user.entity';

dotenv.config();

const isProduction = process.env.NODE_ENV === 'production';
const dbUrl = process.env.DATABASE_URL;

export const AppDataSource = new DataSource({
  type: 'postgres',
  ...(dbUrl
    ? { url: dbUrl }
    : {
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 5432,
        username: process.env.DB_USERNAME || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        database: process.env.DB_DATABASE || 'aegis_api_db',
      }),
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  entities: [User, RefreshToken, AuditLog],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
