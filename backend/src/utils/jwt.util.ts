/**
 * JWT (JSON Web Token) Utilities
 *
 * Handles token generation and verification.
 *
 * HOW JWT WORKS:
 * 1. User logs in → Server generates JWT
 * 2. JWT sent to client → Client stores it (localStorage/cookie)
 * 3. Client includes JWT in requests → Server verifies JWT
 * 4. If valid → Allow access, if invalid → Reject
 *
 * JWT STRUCTURE:
 * header.payload.signature
 * - Header: Algorithm used (HS256)
 * - Payload: User data (userId, email)
 * - Signature: Proves token wasn't tampered with
 *
 * WHY JWT?
 * - Stateless (no session storage on server)
 * - Scalable (works across multiple servers)
 * - Self-contained (includes user info)
 * - Standard (works with mobile apps, SPAs)
 */

import jwt from 'jsonwebtoken';
import { config } from '@/config/env.config';
import { JwtPayload } from '@/types/auth.types';

/**
 * Generate JWT token for a user
 *
 * WHAT GOES IN THE TOKEN?
 * - Only non-sensitive data (userId, email)
 * - NEVER put passwords, credit cards, etc.
 * - Token can be decoded by anyone! (base64)
 * - Security comes from signature (can't be forged)
 *
 * @param payload - User data to encode
 * @returns string - The JWT token
 */
export function generateToken(payload: JwtPayload): string {
  try {
    // @ts-ignore - jwt types are overly strict for expiresIn
    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });

    return token;
  } catch (error) {
    throw new Error('Failed to generate token');
  }
}

/**
 * Verify JWT token and extract payload
 *
 * WHAT THIS CHECKS:
 * - Signature is valid (token wasn't tampered with)
 * - Token hasn't expired
 * - Token was signed with our secret
 *
 * @param token - JWT token from Authorization header
 * @returns JwtPayload - Decoded user data
 * @throws Error if token is invalid/expired
 */
export function verifyToken(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    } else if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    } else {
      throw new Error('Token verification failed');
    }
  }
}

/**
 * Decode token without verification
 *
 * WHY USE THIS?
 * - Quick peek at token contents
 * - Debugging
 * - DON'T use for authentication (not secure!)
 *
 * @param token - JWT token
 * @returns JwtPayload | null - Decoded payload or null if invalid
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.decode(token) as JwtPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

/**
 * Extract token from Authorization header
 *
 * Expected format: "Bearer <token>"
 *
 * WHY "Bearer"?
 * - Standard OAuth 2.0 format
 * - Indicates token-based authentication
 * - Frontend sends: Authorization: Bearer eyJhbGciOi...
 *
 * @param authHeader - The Authorization header value
 * @returns string | null - The token or null if not found
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  // Check if header starts with "Bearer "
  if (!authHeader.startsWith('Bearer ')) {
    return null;
  }

  // Extract token (everything after "Bearer ")
  const token = authHeader.substring(7);

  return token || null;
}
