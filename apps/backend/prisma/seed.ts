import * as bcrypt from 'bcrypt';
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Aucun utilisateur par défaut : le premier admin est créé via POST /auth/register (base vide)
 * ou via l’écran « Configuration initiale » de l’app Electron.
 *
 * FORCE_ADMIN_RESET=1 : réinitialise le téléphone + mot de passe du premier compte ADMIN trouvé
 * (secours uniquement — définir ADMIN_PHONE / ADMIN_PASSWORD dans l’environnement si besoin).
 */
const ADMIN_PHONE = process.env.SEED_ADMIN_PHONE ?? '+2250100000000';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'admin1234';
const FORCE_ADMIN_RESET = process.env.FORCE_ADMIN_RESET === '1';

async function main() {
  if (!FORCE_ADMIN_RESET) {
    console.log(
      'Seed: pas de compte créé automatiquement — utilisez la configuration initiale (premier utilisateur = admin).',
    );
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const firstAdmin = await prisma.user.findFirst({
    where: { role: Role.ADMIN },
    orderBy: { id: 'asc' },
  });

  if (!firstAdmin) {
    await prisma.user.create({
      data: {
        phone: ADMIN_PHONE,
        email: 'admin@pos.local',
        password: passwordHash,
        role: Role.ADMIN,
      },
    });
    console.log(`Seed (FORCE_ADMIN_RESET): admin créé — ${ADMIN_PHONE} / ${ADMIN_PASSWORD}`);
    return;
  }

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
    `Seed (FORCE_ADMIN_RESET): admin id ${firstAdmin.id} — ${ADMIN_PHONE} / ${ADMIN_PASSWORD}`,
  );
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
