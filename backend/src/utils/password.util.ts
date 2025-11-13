/**
 * Password Hashing Utilities
 *
 * Uses bcrypt for secure password hashing.
 *
 * WHY BCRYPT?
 * - Industry standard for password hashing
 * - Salted automatically (prevents rainbow table attacks)
 * - Slow by design (prevents brute force)
 * - Configurable cost factor (can increase security over time)
 *
 * NEVER STORE PLAIN TEXT PASSWORDS!
 * Even if database is compromised, passwords remain secure.
 */

import bcrypt from 'bcryptjs';

/**
 * Salt rounds - higher = more secure but slower
 * 10 rounds is good balance for 2024
 *
 * WHY 10?
 * - 10 rounds = ~100ms to hash (acceptable UX)
 * - 12 rounds = ~300ms to hash (slower but more secure)
 * - 8 rounds = ~30ms to hash (too fast, less secure)
 */
const SALT_ROUNDS = 10;

/**
 * Hash a plain text password
 *
 * USAGE:
 * const hashedPassword = await hashPassword('user123');
 * // Store hashedPassword in database, NOT the plain text!
 *
 * @param plainPassword - The plain text password from user
 * @returns Promise<string> - The hashed password (safe to store)
 */
export async function hashPassword(plainPassword: string): Promise<string> {
  try {
    const hash = await bcrypt.hash(plainPassword, SALT_ROUNDS);
    return hash;
  } catch (error) {
    throw new Error('Failed to hash password');
  }
}

/**
 * Compare plain text password with hashed password
 *
 * WHY NOT JUST COMPARE STRINGS?
 * - Hash is different every time (bcrypt uses random salt)
 * - Must use bcrypt.compare() to verify
 *
 * USAGE:
 * const isValid = await comparePassword('user123', hashedFromDB);
 * if (isValid) {
 *   // Login successful
 * } else {
 *   // Wrong password
 * }
 *
 * @param plainPassword - Password user entered
 * @param hashedPassword - Hash stored in database
 * @returns Promise<boolean> - True if passwords match
 */
export async function comparePassword(
  plainPassword: string,
  hashedPassword: string
): Promise<boolean> {
  try {
    const isMatch = await bcrypt.compare(plainPassword, hashedPassword);
    return isMatch;
  } catch (error) {
    throw new Error('Failed to compare passwords');
  }
}

/**
 * Validate password strength
 *
 * Requirements:
 * - At least 8 characters
 * - Contains uppercase letter
 * - Contains lowercase letter
 * - Contains number
 *
 * CUSTOMIZE AS NEEDED:
 * You can add more rules (special characters, etc.)
 *
 * @param password - Password to validate
 * @returns { valid: boolean, message?: string }
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  message?: string;
} {
  if (password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long',
    };
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter',
    };
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter',
    };
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one number',
    };
  }

  return { valid: true };
}
