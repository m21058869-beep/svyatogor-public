import './server/loadEnv';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // `prisma generate` не требует подключения к БД, поэтому пустое значение допустимо.
    url: process.env.DATABASE_URL ?? '',
  },
});
