-- Orders paid straight in crypto, refund requests, repeat payments on a deposit address.
-- Safe to run on every deploy: each statement only does something the first time.

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundCurrency" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "refundAddress" TEXT;

ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "orderId" INTEGER;
ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "txSeen" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "shopSweptAmount" DECIMAL(18,8) NOT NULL DEFAULT 0;
ALTER TABLE "Deposit" ADD COLUMN IF NOT EXISTS "reserveSweptAmount" DECIMAL(18,8) NOT NULL DEFAULT 0;
-- New column, all NULL: no duplicates possible
CREATE UNIQUE INDEX IF NOT EXISTS "Deposit_orderId_key" ON "Deposit"("orderId");

CREATE TABLE IF NOT EXISTS "RefundRequest" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "orderId" INTEGER,
    "depositId" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(18,8) NOT NULL,
    "address" TEXT,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "txHash" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),
    CONSTRAINT "RefundRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RefundRequest_status_idx" ON "RefundRequest"("status");
CREATE INDEX IF NOT EXISTS "RefundRequest_depositId_idx" ON "RefundRequest"("depositId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RefundRequest_userId_fkey') THEN
    ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
