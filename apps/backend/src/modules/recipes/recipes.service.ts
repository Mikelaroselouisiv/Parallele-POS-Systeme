import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { UpsertRecipeDto } from './dto/recipe.dto';

@Injectable()
export class RecipesService {
  constructor(private readonly prisma: PrismaService) {}

  async getByParentProduct(parentProductId: number) {
    const recipe = await this.prisma.productRecipe.findUnique({
      where: { parentProductId },
      include: {
        components: { include: { componentProduct: true } },
        parentProduct: { select: { id: true, name: true, isService: true, companyId: true } },
      },
    });
    return recipe;
  }

  async upsert(parentProductId: number, dto: UpsertRecipeDto) {
    const parent = await this.prisma.product.findUnique({ where: { id: parentProductId } });
    if (!parent) {
      throw new NotFoundException('Produit parent introuvable');
    }

    const ids = dto.components.map((c) => c.componentProductId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Composant en double dans la recette.');
    }
    if (ids.includes(parentProductId)) {
      throw new BadRequestException('Un composant ne peut pas être le produit parent.');
    }

    if (ids.length > 0) {
      const comps = await this.prisma.product.findMany({
        where: { id: { in: ids }, companyId: parent.companyId },
      });
      if (comps.length !== ids.length) {
        throw new BadRequestException('Un ou plusieurs composants sont invalides.');
      }
      for (const c of dto.components) {
        if (c.quantityPerParentBaseUnit <= 0) {
          throw new BadRequestException('Chaque quantité composant doit être > 0.');
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const recipe = await tx.productRecipe.upsert({
        where: { parentProductId },
        create: { parentProductId },
        update: {},
      });
      await tx.recipeComponent.deleteMany({ where: { recipeId: recipe.id } });
      if (dto.components.length > 0) {
        await tx.recipeComponent.createMany({
          data: dto.components.map((c) => ({
            recipeId: recipe.id,
            componentProductId: c.componentProductId,
            quantityPerParentBaseUnit: c.quantityPerParentBaseUnit,
          })),
        });
      }
      return tx.productRecipe.findUniqueOrThrow({
        where: { id: recipe.id },
        include: {
          components: { include: { componentProduct: true } },
          parentProduct: { select: { id: true, name: true, isService: true } },
        },
      });
    });
  }

  async remove(parentProductId: number) {
    const r = await this.prisma.productRecipe.findUnique({ where: { parentProductId } });
    if (!r) {
      throw new NotFoundException('Aucune recette pour ce produit.');
    }
    await this.prisma.productRecipe.delete({ where: { id: r.id } });
    return { ok: true };
  }
}
