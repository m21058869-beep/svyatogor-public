// Создаёт администратора или меняет пароль существующему.
// Использование: npm run create-admin -- <email> <password> ["Полное имя"]
import bcrypt from 'bcryptjs';
import { prisma } from '../db';

async function main() {
  const [rawEmail, password, fullName] = process.argv.slice(2);
  if (!rawEmail || !password) {
    console.error('Использование: npm run create-admin -- <email> <password> ["Полное имя"]');
    process.exitCode = 1;
    return;
  }
  if (password.length < 8) {
    console.error('Пароль должен быть не короче 8 символов');
    process.exitCode = 1;
    return;
  }

  const email = rawEmail.trim().toLowerCase();
  const password_hash = await bcrypt.hash(password, 12);
  const admin = await prisma.adminUser.upsert({
    where: { email },
    create: { email, password_hash, full_name: fullName ?? null },
    update: { password_hash, ...(fullName && { full_name: fullName }) },
  });
  console.log(`Администратор ${admin.email} сохранён (id: ${admin.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
