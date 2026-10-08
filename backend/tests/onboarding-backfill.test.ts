/**
 * Onboarding backfill predicate test.
 *
 * Extracts the WHERE predicate from the migration's backfill UPDATE and runs
 * it as a read-only SELECT against real Postgres to prove which users would
 * be marked as onboarded.
 */

import fs from "fs";
import path from "path";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/config/database.config";

const app = createApp();
const PREFIX = "onboarding-backfill-test";
const NAMES = [
  "live-pantry",
  "deleted-pantry",
  "currency",
  "budget",
  "dietary",
  "updated",
  "default",
] as const;
type Name = (typeof NAMES)[number];

describe("onboarding backfill predicate", () => {
  const ids = {} as Record<Name, string>;

  beforeAll(async () => {
    for (const name of NAMES) {
      const res = await request(app)
        .post("/api/v1/auth/signup")
        .send({
          email: `${PREFIX}-${name}@example.com`,
          password: "TestPass123",
          firstName: "Backfill",
          lastName: name,
        });
      ids[name] = res.body.user.id;
    }

    const itemBase = {
      ingredientName: "Rice",
      quantity: 1,
      unit: "kg",
      category: "grains",
    };
    await prisma.pantryItem.create({ data: { ...itemBase, userId: ids["live-pantry"] } });
    await prisma.pantryItem.create({
      data: { ...itemBase, userId: ids["deleted-pantry"], deletedAt: new Date() },
    });

    // Raw SQL so updated_at is not bumped by Prisma's @updatedAt
    await prisma.$executeRawUnsafe(
      `UPDATE "user_preferences" SET "currency" = 'USD' WHERE "user_id" = $1`,
      ids.currency
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "user_preferences" SET "budget_per_week_cents" = 50000 WHERE "user_id" = $1`,
      ids.budget
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "user_preferences" SET "dietary_restrictions" = ARRAY['vegan'] WHERE "user_id" = $1`,
      ids.dietary
    );
    await prisma.$executeRawUnsafe(
      `UPDATE "user_preferences" SET "updated_at" = "created_at" + interval '1 day' WHERE "user_id" = $1`,
      ids.updated
    );
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: PREFIX } } });
  });

  it("selects every active-user shape and not a fresh default user", async () => {
    const sql = fs.readFileSync(
      path.join(__dirname, "../prisma/migrations/20261010000000_user_onboarding/migration.sql"),
      "utf8"
    );
    const match = sql.match(/UPDATE "user_preferences" up\s+SET[\s\S]*?WHERE([\s\S]*?);/);
    expect(match).not.toBeNull();
    const predicate = match![1];

    const allIds = NAMES.map((n) => ids[n]);
    const rows = await prisma.$queryRawUnsafe<{ user_id: string }[]>(
      `SELECT up."user_id" FROM "user_preferences" up WHERE (${predicate}) AND up."user_id" = ANY($1::text[])`,
      allIds
    );
    const selected = rows.map((r) => r.user_id).sort();
    const expected = NAMES.filter((n) => n !== "default")
      .map((n) => ids[n])
      .sort();

    expect(selected).toEqual(expected);
    expect(selected).toContain(ids["live-pantry"]);
    expect(selected).toContain(ids["deleted-pantry"]);
    expect(selected).not.toContain(ids.default);
  });
});
