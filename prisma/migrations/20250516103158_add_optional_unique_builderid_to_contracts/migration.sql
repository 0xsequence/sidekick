/*
  Warnings:

  - A unique constraint covering the columns `[builderId]` on the table `Contract` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "builderId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Contract_builderId_key" ON "Contract"("builderId");
