/*
  Warnings:

  - The values [READ,WRITE] on the enum `AccessRole` will be removed. If these variants are still used in the database, this will fail.
  - Added the required column `ownerId` to the `Document` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "AccessRole_new" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
ALTER TABLE "DocumentAccess" ALTER COLUMN "role" TYPE "AccessRole_new" USING ("role"::text::"AccessRole_new");
ALTER TYPE "AccessRole" RENAME TO "AccessRole_old";
ALTER TYPE "AccessRole_new" RENAME TO "AccessRole";
DROP TYPE "AccessRole_old";
COMMIT;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "ownerId" TEXT NOT NULL;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
