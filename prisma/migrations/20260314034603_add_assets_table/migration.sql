-- CreateTable
CREATE TABLE "Asset" (
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sector" TEXT,
    "industry" TEXT,
    "watcherCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("ticker")
);

-- CreateIndex
CREATE INDEX "Asset_name_idx" ON "Asset"("name");
