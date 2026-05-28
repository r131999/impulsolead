-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "corretorId" TEXT NOT NULL,
    "subscription" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_corretorId_fkey" FOREIGN KEY ("corretorId") REFERENCES "Corretor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
