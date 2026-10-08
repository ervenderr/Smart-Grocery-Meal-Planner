/** Error raised by upstream clients; the service maps it to an AppError. */

export type FoodUpstreamKind = 'throttled' | 'unavailable';

export class FoodUpstreamError extends Error {
  constructor(public readonly kind: FoodUpstreamKind, message: string) {
    super(message);
    Object.setPrototypeOf(this, FoodUpstreamError.prototype);
  }
}
