import type { WindowState } from "./store.ts";

export type Decision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export const RATE_LIMIT = { limit: 100, windowMs: 60_000 };

export function nextWindow(previous: WindowState | undefined, now: number, windowMs: number): WindowState {
  if (previous === undefined || now - previous.windowStart >= windowMs) {
    return { count: 1, windowStart: now };
  }
  return { count: previous.count + 1, windowStart: previous.windowStart };
}

export function decide(state: WindowState, now: number): Decision {
  if (state.count <= RATE_LIMIT.limit) {
    return { allowed: true };
  }
  const remainingMs = state.windowStart + RATE_LIMIT.windowMs - now;
  return { allowed: false, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}
