import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  DATABASE_URL: Joi.string().optional(),
  DB_HOST: Joi.string().default('localhost'),
  DB_PORT: Joi.number().default(5432),
  DB_USERNAME: Joi.string().default('postgres'),
  DB_PASSWORD: Joi.string().allow('').default('postgres'),
  DB_DATABASE: Joi.string().default('aegis_api_db'),
  JWT_ACCESS_SECRET: Joi.string().min(16).required().messages({
    'any.required': 'JWT_ACCESS_SECRET Wajib diisi pada file .env',
  }),
  JWT_REFRESH_SECRET: Joi.string().min(16).required().messages({
    'any.required': 'JWT_REFRESH_SECRET Wajib diisi pada file .env',
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
});
