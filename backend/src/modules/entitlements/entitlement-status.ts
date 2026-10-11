/**
 * Read-side helpers for the one-time unlock. The server is the only judge of
 * entitlement: callers gate features with isEntitled().
 */

import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "../../config/database.config";
import { config } from "../../config/env.config";
import { ENTITLEMENT_STATUS } from "./entitlements.constants";

type Db = Prisma.TransactionClient | PrismaClient;

export interface EntitlementSummary {
  status: "active" | "revoked" | "none";
  productId: string;
  environment: "Sandbox" | "Production" | "Xcode" | null;
  purchasedAt: Date | null;
  revokedAt: Date | null;
}

export async function isEntitled(userId: string, db: Db = prisma): Promise<boolean> {
  const row = await db.entitlement.findFirst({
    where: {
      userId,
      productId: config.iap.productId,
      status: ENTITLEMENT_STATUS.ACTIVE,
    },
    select: { id: true },
  });
  return row !== null;
}

export async function getEntitlementSummary(
  userId: string,
  db: Db = prisma
): Promise<EntitlementSummary> {
  const productId = config.iap.productId;
  const row = await db.entitlement.findUnique({
    where: { userId_productId: { userId, productId } },
  });
  if (row === null) {
    return { status: "none", productId, environment: null, purchasedAt: null, revokedAt: null };
  }
  return {
    status: row.status === ENTITLEMENT_STATUS.ACTIVE ? "active" : "revoked",
    productId,
    environment: row.environment as EntitlementSummary["environment"],
    purchasedAt: row.purchasedAt,
    revokedAt: row.revokedAt,
  };
}
