import { nextWindow } from "./policy.ts";
import type { RateLimitStore, WindowState } from "./store.ts";

export class InMemoryRateLimitStore implements RateLimitStore {
  // Insertion order is windowStart order, so expired entries are always at the head.
  #windows = new Map<string, WindowState>();

  get size(): number {
    return this.#windows.size;
  }

  // Atomic because everything up to the return runs synchronously, with no await.
  hit(key: string, now: number, windowMs: number): Promise<WindowState> {
    this.#evictExpired(now, windowMs);
    const previous = this.#windows.get(key);
    const next = nextWindow(previous, now, windowMs);
    if (previous !== undefined && next.windowStart !== previous.windowStart) {
      this.#windows.delete(key);
    }
    this.#windows.set(key, next);
    return Promise.resolve(next);
  }

  #evictExpired(now: number, windowMs: number): void {
    for (const [key, state] of this.#windows) {
      if (now - state.windowStart < windowMs) {
        return;
      }
      this.#windows.delete(key);
    }
  }
}
