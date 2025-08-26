-- AlterTable
ALTER TABLE "Log" ADD COLUMN "deviceIdentity" TEXT;

-- CreateIndex
CREATE INDEX "Log_deviceIdentity_idx" ON "Log"("deviceIdentity");
