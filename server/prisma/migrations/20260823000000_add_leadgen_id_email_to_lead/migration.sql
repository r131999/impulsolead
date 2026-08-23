-- AlterTable
ALTER TABLE "Lead" ADD COLUMN "leadgenId" TEXT;
ALTER TABLE "Lead" ADD COLUMN "email" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Lead_leadgenId_key" ON "Lead"("leadgenId");
