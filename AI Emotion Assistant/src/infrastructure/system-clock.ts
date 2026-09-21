import { performance } from "node:perf_hooks";
import type { ClockPort } from "../application/ports.js";

export class SystemClock implements ClockPort {
  now(): Date {
    return new Date();
  }

  monotonicMs(): number {
    return Math.round(performance.now());
  }
}
