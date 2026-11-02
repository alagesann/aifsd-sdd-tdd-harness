export interface WindowState {
  count: number;
  windowStart: number;
}

export interface RateLimitStore {
  /**
   * Records one request for `key` and returns the resulting state, opening a new
   * window if none is open. The whole operation MUST be atomic: concurrent calls
   * for a key must each observe a distinct count.
   */
  hit(key: string, now: number, windowMs: number): Promise<WindowState>;
}
