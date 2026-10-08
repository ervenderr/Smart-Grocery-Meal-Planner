/**
 * ZapierWebhook persistence test.
 *
 * Proves the zapier_webhooks table (created by migration) round-trips through
 * Prisma, enforces unique (userId, eventType), and cascades on user delete.
 */

import { prisma } from "../src/config/database.config";

const EMAIL = "zapier-webhook-test@example.com";

describe("ZapierWebhook table", () => {
  let userId: string;

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    const user = await prisma.user.create({
      data: { email: EMAIL, passwordHash: "x", firstName: "Zap", lastName: "Test" },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: EMAIL } });
  });

  it("inserts and reads a webhook with defaults", async () => {
    const created = await prisma.zapierWebhook.create({
      data: { userId, eventType: "stock_low", webhookUrl: "https://hooks.zapier.com/x" },
    });
    expect(created.isActive).toBe(true);

    const found = await prisma.zapierWebhook.findUnique({
      where: { userId_eventType: { userId, eventType: "stock_low" } },
    });
    expect(found?.webhookUrl).toBe("https://hooks.zapier.com/x");
  });

  it("rejects a duplicate (userId, eventType)", async () => {
    await expect(
      prisma.zapierWebhook.create({
        data: { userId, eventType: "stock_low", webhookUrl: "https://hooks.zapier.com/y" },
      })
    ).rejects.toThrow();
  });

  it("cascades deletes when the user is removed", async () => {
    await prisma.user.delete({ where: { id: userId } });
    expect(await prisma.zapierWebhook.count({ where: { userId } })).toBe(0);
  });
});
