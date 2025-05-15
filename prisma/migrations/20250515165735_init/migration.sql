-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "hash" TEXT,
    "txUrl" TEXT,
    "chainId" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "data" TEXT,
    "functionName" TEXT,
    "argsJson" TEXT DEFAULT '[]',
    "isDeployTx" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "projectId" INTEGER,
    "contractName" TEXT NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "contractType" TEXT,
    "chainId" INTEGER NOT NULL,
    "source" TEXT,
    "itemsContractAddress" TEXT,
    "splitterContractAddresses" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "abi" TEXT,
    "bytecode" TEXT NOT NULL,
    "bytecode_hash" TEXT,
    "audienceId" INTEGER,
    "symbol" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "addedBy" TEXT NOT NULL DEFAULT 'sidekick',

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractAddress_key" ON "Contract"("contractAddress");
