-- Orders paid straight in crypto: their own deposit address, a 30-minute window, optional refund address
ALTER TABLE "Order" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "refundCurrency" TEXT;
ALTER TABLE "Order" ADD COLUMN "refundAddress" TEXT;
ALTER TABLE "Deposit" ADD COLUMN "orderId" INTEGER;
ALTER TABLE "Deposit" ADD COLUMN "txSeen" JSONB NOT NULL DEFAULT '[]';
CREATE UNIQUE INDEX "Deposit_orderId_key" ON "Deposit"("orderId");

-- Refunds an admin approves (late, short or surplus payments of an order)
CREATE TABLE "RefundRequest" (
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
CREATE INDEX "RefundRequest_status_idx" ON "RefundRequest"("status");
CREATE INDEX "RefundRequest_depositId_idx" ON "RefundRequest"("depositId");
ALTER TABLE "RefundRequest" ADD CONSTRAINT "RefundRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A deposit address can be paid again after a sweep: what each sweep already took
ALTER TABLE "Deposit" ADD COLUMN "shopSweptAmount" DECIMAL(18,8) NOT NULL DEFAULT 0;
ALTER TABLE "Deposit" ADD COLUMN "reserveSweptAmount" DECIMAL(18,8) NOT NULL DEFAULT 0;
