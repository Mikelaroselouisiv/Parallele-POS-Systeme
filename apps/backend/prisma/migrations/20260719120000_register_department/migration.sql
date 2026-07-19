-- AlterTable
ALTER TABLE "Register" ADD COLUMN "departmentId" INTEGER;

-- CreateIndex
CREATE INDEX "Register_departmentId_idx" ON "Register"("departmentId");

-- AddForeignKey
ALTER TABLE "Register" ADD CONSTRAINT "Register_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
