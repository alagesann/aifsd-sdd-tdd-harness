import type { Clock } from "../src/rate-limit/clock.ts";

export class FakeClock implements Clock {
  #time = 0;

  now(): number {
    return this.#time;
  }

  set(time: number): void {
    this.#time = time;
  }
}
