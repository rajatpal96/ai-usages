import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_PORT: z.coerce.number().default(4000),
  INGESTION_PORT: z.coerce.number().default(4001),
  DASHBOARD_PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/agentmeter'),
  REDIS_URL: z.string().default('redis://localhost:6379'),
  JWT_SECRET: z.string().default('agentmeter-dev-secret-key-32-chars-long!'),
  DEFAULT_ORG_ID: z.string().default('org_default'),
  PRIVACY_LEVEL: z.coerce.number().min(1).max(3).default(1),
  ENABLE_MEMORY_DB_FALLBACK: z.coerce.boolean().default(true),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

export type Config = z.infer<typeof ConfigSchema>;

export const config: Config = ConfigSchema.parse(process.env);
