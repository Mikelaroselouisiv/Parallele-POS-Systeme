-- Ticket thermique par département ; suppression de PrinterSettings au niveau entreprise.

CREATE TABLE "DepartmentPrinterProfile" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "paperWidth" INTEGER NOT NULL DEFAULT 58,
    "deviceName" TEXT NOT NULL DEFAULT '',
    "autoCut" BOOLEAN NOT NULL DEFAULT true,
    "showLogoOnReceipt" BOOLEAN NOT NULL DEFAULT true,
    "receiptHeaderText" TEXT,
    "receiptFooterText" TEXT,
    "receiptLogoUrl" TEXT,
    "previewSampleBody" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DepartmentPrinterProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DepartmentPrinterProfile_departmentId_key" ON "DepartmentPrinterProfile"("departmentId");

ALTER TABLE "DepartmentPrinterProfile" ADD CONSTRAINT "DepartmentPrinterProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "DepartmentPrinterProfile" ("departmentId", "paperWidth", "deviceName", "autoCut", "showLogoOnReceipt", "updatedAt")
SELECT d."id", ps."paperWidth", ps."deviceName", ps."autoCut", ps."showLogoOnReceipt", CURRENT_TIMESTAMP
FROM "PrinterSettings" ps
INNER JOIN "Department" d ON d."companyId" = ps."companyId";

DROP TABLE IF EXISTS "PrinterSettings";
