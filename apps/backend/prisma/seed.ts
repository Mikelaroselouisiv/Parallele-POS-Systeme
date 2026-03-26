import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

/** Identifiants de connexion (téléphone + mot de passe) pour le premier admin ou après migration « legacy_* ». */
const ADMIN_PHONE = '+2250100000000';
const ADMIN_PASSWORD = 'admin1234';
const FORCE_ADMIN_RESET = process.env.FORCE_ADMIN_RESET === '1';

async function main() {
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const already = await prisma.user.findFirst({ where: { phone: ADMIN_PHONE } });
  if (already) {
    console.log(`Seed: un utilisateur avec ${ADMIN_PHONE} existe déjà — rien à faire.`);
    return;
  }

  const firstAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    orderBy: { id: 'asc' },
  });

  if (firstAdmin && FORCE_ADMIN_RESET) {
    await prisma.user.update({
      where: { id: firstAdmin.id },
      data: {
        phone: ADMIN_PHONE,
        password: passwordHash,
        email: firstAdmin.email ?? 'admin@pos.local',
        isActive: true,
      },
    });
    console.log(
      `Seed: compte admin (id ${firstAdmin.id}) mis à jour — téléphone ${ADMIN_PHONE}, mot de passe: ${ADMIN_PASSWORD}`,
    );
    return;
  }

  if (firstAdmin) {
    console.log(
      `Seed: admin existant détecté (id ${firstAdmin.id}, téléphone ${firstAdmin.phone}) — pas de modification.`,
    );
    console.log(
      'Seed: pour forcer une réinitialisation admin, relancez avec FORCE_ADMIN_RESET=1.',
    );
    return;
  }

  await prisma.user.create({
    data: {
      phone: ADMIN_PHONE,
      email: 'admin@pos.local',
      password: passwordHash,
      role: Role.ADMIN,
    },
  });
  console.log(`Seed: admin créé — ${ADMIN_PHONE} / ${ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
