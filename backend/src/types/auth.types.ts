/**
 * Authentication Type Definitions
 *
 * These types define the shape of data used in authentication flows.
 *
 * WHY SEPARATE TYPES FILE?
 * - Reusable across multiple files
 * - Clear contracts for API requests/responses
 * - Easy to maintain and update
 * - TypeScript will catch mismatches at compile time
 */

/**
 * User registration request
 * What the frontend sends when creating an account
 */
export interface SignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

/**
 * User login request
 * What the frontend sends when logging in
 */
export interface LoginRequest {
  email: string;
  password: string;
}

/**
 * Authentication response
 * What we send back after successful signup/login
 *
 * WHY INCLUDE USER DATA?
 * - Frontend needs user info for display
 * - Avoids extra API call to get profile
 * - Common pattern in JWT auth
 */
export interface AuthResponse {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    createdAt: Date;
  };
  token: string;
  expiresIn: string; // "7d"
}

/**
 * JWT Payload
 * What we encode in the JWT token
 *
 * WHY MINIMAL DATA?
 * - Tokens are sent with every request (size matters)
 * - Only include what's needed to identify user
 * - Sensitive data should NOT be in JWT
 */
export interface JwtPayload {
  userId: string;
  email: string;
  iat?: number; // Issued at (timestamp)
  exp?: number; // Expiration (timestamp)
}

/**
 * Request with authenticated user
 * After JWT middleware, req.user will exist
 *
 * WHY EXTEND REQUEST?
 * - TypeScript doesn't know about custom properties
 * - This tells TypeScript "req.user exists and has this shape"
 * - Prevents errors when accessing req.user in routes
 */
export interface AuthenticatedRequest extends Express.Request {
  user?: {
    id: string;
    email: string;
  };
}
