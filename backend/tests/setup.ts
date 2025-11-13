/**
 * Test Setup
 *
 * Runs before all tests to setup test environment.
 */

import { prisma } from '../src/config/database.config';

// Increase timeout for database operations
jest.setTimeout(30000);

/**
 * Clean up database after all tests
 */
afterAll(async () => {
  // Clean up test data
  await prisma.$disconnect();
});
