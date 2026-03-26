import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import appConfig from './config/app.config';
import jwtConfig from './config/jwt.config';
import { AuditModule } from './modules/audit/audit.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompanyModule } from './modules/company/company.module';
import { DepartmentsModule } from './modules/departments/departments.module';
import { PackagingModule } from './modules/packaging/packaging.module';
import { PurchasingModule } from './modules/purchasing/purchasing.module';
import { RecipesModule } from './modules/recipes/recipes.module';
import { FinanceModule } from './modules/finance/finance.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ProductsModule } from './modules/products/products.module';
import { ReportsModule } from './modules/reports/reports.module';
import { SalesModule } from './modules/sales/sales.module';
import { StoresModule } from './modules/stores/stores.module';
import { UsersModule } from './modules/users/users.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, jwtConfig],
    }),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    CompanyModule,
    PackagingModule,
    ProductsModule,
    SalesModule,
    InventoryModule,
    PaymentsModule,
    ReportsModule,
    DepartmentsModule,
    StoresModule,
    FinanceModule,
    PurchasingModule,
    RecipesModule,
  ],
})
export class AppModule {}
