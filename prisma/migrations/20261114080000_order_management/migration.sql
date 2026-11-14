-- StandoffShop v0.8.0 — Order Management 2.0
-- Additive migration: no existing order records, payments or sessions are removed.
CREATE TYPE "OrderTaskStatus" AS ENUM ('OPEN','IN_PROGRESS','BLOCKED','DONE');
CREATE TYPE "OrderActivityKind" AS ENUM ('STATUS','NOTE','MESSAGE','TASK','DELIVERY','PAYMENT');
CREATE TYPE "OrderActivityVisibility" AS ENUM ('STAFF','CUSTOMER');

CREATE TABLE "OrderActivity" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "authorId" TEXT,
  "kind" "OrderActivityKind" NOT NULL,
  "visibility" "OrderActivityVisibility" NOT NULL DEFAULT 'STAFF',
  "title" TEXT NOT NULL,
  "message" TEXT,
  "fromStatus" "OrderStatus",
  "toStatus" "OrderStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrderActivity_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrderTask" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "orderItemId" TEXT NOT NULL,
  "status" "OrderTaskStatus" NOT NULL DEFAULT 'OPEN',
  "assignedToId" TEXT,
  "dueAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderTask_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "OrderDelivery" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "storageKey" TEXT NOT NULL,
  "originalName" TEXT NOT NULL,
  "mime" TEXT NOT NULL,
  "bytes" INTEGER NOT NULL,
  "checksum" TEXT NOT NULL,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "releasedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "OrderDelivery_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "CustomerNotification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "readAt" TIMESTAMP(3),
  CONSTRAINT "CustomerNotification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrderTask_orderItemId_key" ON "OrderTask"("orderItemId");
CREATE UNIQUE INDEX "OrderDelivery_storageKey_key" ON "OrderDelivery"("storageKey");
CREATE INDEX "OrderActivity_orderId_createdAt_idx" ON "OrderActivity"("orderId","createdAt");
CREATE INDEX "OrderTask_status_updatedAt_idx" ON "OrderTask"("status","updatedAt");
CREATE INDEX "OrderTask_orderId_status_idx" ON "OrderTask"("orderId","status");
CREATE INDEX "OrderDelivery_orderId_releasedAt_revokedAt_idx" ON "OrderDelivery"("orderId","releasedAt","revokedAt");
CREATE INDEX "CustomerNotification_userId_readAt_createdAt_idx" ON "CustomerNotification"("userId","readAt","createdAt");
CREATE INDEX "CustomerNotification_orderId_createdAt_idx" ON "CustomerNotification"("orderId","createdAt");
ALTER TABLE "OrderActivity" ADD CONSTRAINT "OrderActivity_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderActivity" ADD CONSTRAINT "OrderActivity_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderTask" ADD CONSTRAINT "OrderTask_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderTask" ADD CONSTRAINT "OrderTask_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrderTask" ADD CONSTRAINT "OrderTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OrderDelivery" ADD CONSTRAINT "OrderDelivery_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CustomerNotification" ADD CONSTRAINT "CustomerNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CustomerNotification" ADD CONSTRAINT "CustomerNotification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Legacy orders receive a visible starting point in their new timeline.
INSERT INTO "OrderActivity" ("id","orderId","kind","visibility","title","toStatus","createdAt")
SELECT 'legacy-'||"id", "id", 'STATUS'::"OrderActivityKind",
  'CUSTOMER'::"OrderActivityVisibility", 'Текущий статус заказа',
  "status","createdAt"
FROM "Order";
