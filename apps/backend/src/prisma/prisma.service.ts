import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private readonly logger = new Logger(PrismaService.name);

  async onModuleInit() {
    await this.$connect();
    // Aligner les bases locales qui n’ont pas exécuté les migrations supprimant Department.type.
    try {
      await this.$executeRawUnsafe(
        `ALTER TABLE "Department" DROP COLUMN IF EXISTS "type"`,
      );
      await this.$executeRawUnsafe(
        `DROP TYPE IF EXISTS "DepartmentType" CASCADE`,
      );
    } catch (e) {
      this.logger.warn(
        `Nettoyage colonne Department.type ignoré (${e instanceof Error ? e.message : String(e)}). Exécutez « npx prisma migrate deploy » si besoin.`,
      );
    }
  }
}
