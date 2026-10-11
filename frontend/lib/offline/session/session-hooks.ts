/**
 * Lightweight bridge between the auth store and the offline runtime. It must not import the
 * runtime (the auth store stays light); the runtime registers handlers when it boots.
 */
export type SessionEndIntent = 'expired' | 'logout' | 'deleted';

export interface SessionHandlers {
  beforeClear: () => void;
  afterClear: () => void;
}

let handlers: SessionHandlers | null = null;
let intent: SessionEndIntent | null = null;

export function registerSessionHandlers(next: SessionHandlers | null): void {
  handlers = next;
}

export function notifySessionClearing(): void {
  handlers?.beforeClear();
}

export function notifySessionCleared(): void {
  handlers?.afterClear();
}

export function setSessionEndIntent(next: SessionEndIntent): void {
  intent = next;
}

/** Returns the pending intent and resets it. Defaults to 'expired', the data-keeping choice. */
export function consumeSessionEndIntent(): SessionEndIntent {
  const value = intent ?? 'expired';
  intent = null;
  return value;
}
