import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',
  clientOrigin: process.env.CLIENT_ORIGIN || '*',
  dbPath: process.env.DB_PATH || path.resolve(process.cwd(), 'watch_party.db'),
  redisUrl: process.env.REDIS_URL || '',
  defaultVideoId: process.env.DEFAULT_VIDEO_ID || 'dQw4w9WgXcQ', // Default featured video
  heartbeatIntervalMs: 5000,
  timeDriftToleranceSeconds: 1.5,
};
