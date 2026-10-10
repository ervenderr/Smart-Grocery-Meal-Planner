/**
 * CLI: seed the App Review demo account (local databases only by default).
 *
 *   REVIEWER_PASSWORD=... npm run seed:reviewer
 *
 * The password is read from the environment and never printed.
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  assertSafeToSeed,
  validateReviewerPassword,
  seedReviewer,
  REVIEWER_DEFAULT_EMAIL,
} from '../src/tools/reviewer-seed';

async function main(): Promise<void> {
  assertSafeToSeed(process.env);
  const password = validateReviewerPassword(process.env.REVIEWER_PASSWORD);
  const email = process.env.REVIEWER_EMAIL || REVIEWER_DEFAULT_EMAIL;

  const prisma = new PrismaClient();
  try {
    const result = await seedReviewer(prisma, { email, password });
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
