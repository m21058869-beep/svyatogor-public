import './loadEnv';
import { PrismaPg } from '@prisma/adapter-pg';
import { isBuildPhase } from './buildPhase';
import { PrismaClient } from './generated/prisma/client';

// db.ts намеренно не зависит от env.ts: сид и CLI-скрипты не требуют JWT_SECRET и S3.
// См. server/buildPhase.ts: на `next build` модуль тоже исполняется, но к БД не обращается,
// поэтому вместо исключения подставляем заглушку (соединение не устанавливается, пока нет запроса).
const connectionString =
  process.env.DATABASE_URL ?? (isBuildPhase ? 'postgresql://localhost:5432/next-build' : '');
if (!connectionString) {
  throw new Error('Не задана переменная окружения DATABASE_URL (см. .env.example)');
}

export const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

