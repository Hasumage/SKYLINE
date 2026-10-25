import { describe, expect, it } from "vitest";
import { completedQuarters, quarterAt, sessionExpired } from "./quarter-timing.js";

const start = new Date("2026-10-15T12:00:00.000Z");
const at = (seconds: number) => new Date(start.getTime() + seconds * 1000);

describe("quarter timing", () => {
  it("lets first-half purchases produce at this quarter's end", () => {
    expect(quarterAt(start, 300, 10, at(149))?.firstProductionQuarter).toBe(1);
    expect(quarterAt(start, 300, 10, at(449))?.firstProductionQuarter).toBe(2);
  });

  it("holds purchases at the midpoint until the next quarter", () => {
    expect(quarterAt(start, 300, 10, at(150))).toEqual({ quarter: 1, inFirstHalf: false, firstProductionQuarter: 2 });
    expect(quarterAt(start, 300, 10, at(299))?.firstProductionQuarter).toBe(2);
    expect(quarterAt(start, 300, 10, at(300))?.firstProductionQuarter).toBe(2);
  });

  it("rejects purchases outside scheduled play and tracks completed quarters", () => {
    expect(quarterAt(start, 300, 10, at(-1))).toBeNull();
    expect(quarterAt(start, 300, 10, at(3000))).toBeNull();
    expect(completedQuarters(start, 300, 10, at(299))).toBe(0);
    expect(completedQuarters(start, 300, 10, at(300))).toBe(1);
    expect(completedQuarters(start, 300, 10, at(9000))).toBe(10);
    expect(sessionExpired(start, 300, 10, at(6599))).toBe(false);
    expect(sessionExpired(start, 300, 10, at(6600))).toBe(true);
  });
});
