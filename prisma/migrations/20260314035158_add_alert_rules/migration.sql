-- CreateTable
CREATE TABLE "AlertRule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "threshold" DOUBLE PRECISION NOT NULL,
    "cooldownMinutes" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlertRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertRule_userId_idx" ON "AlertRule"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertRule_userId_ticker_ruleType_key" ON "AlertRule"("userId", "ticker", "ruleType");

-- AddForeignKey
ALTER TABLE "AlertRule" ADD CONSTRAINT "AlertRule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
