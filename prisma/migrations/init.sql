-- CreateTable
CREATE TABLE IF NOT EXISTS "Transaction" (
    "id" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Transaction_hash_key" ON "Transaction"("hash"); 