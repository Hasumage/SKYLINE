import { describe, expect, it } from "vitest";
import { applyLoanPayment, loanPayoff, loanQuote } from "./loan-math.js";

describe("loanQuote", () => {
  it("uses the agreed flat quarterly rate", () => {
    expect(loanQuote(50000, 1000, 4)).toEqual({ totalDue: 70000, paymentPerQuarter: 17500 });
  });
  it("rounds the total before the displayed quarterly payment", () => {
    expect(loanQuote(500, 125, 3)).toEqual({ totalDue: 519, paymentPerQuarter: 173 });
  });
});

describe("early repayment", () => {
  const loan = { principalRemaining: 50000, accruedInterest: 0, interestThroughQuarter: 0, issuedQuarter: 1, quarters: 4, rateBasisPoints: 1250 };
  it("charges only one quarter for a first-quarter payoff", () => {
    expect(loanPayoff(loan, 1).due).toBe(56250);
    expect(applyLoanPayment(loanPayoff(loan, 1), 56250).remaining).toBe(0);
  });
  it("reduces future interest after a partial payment", () => {
    const first = applyLoanPayment(loanPayoff(loan, 1), 26250);
    expect(first).toMatchObject({ principalRemaining: 30000, accruedInterest: 0, remaining: 30000 });
    expect(loanPayoff({ ...loan, ...first, interestThroughQuarter: 1 }, 2).due).toBe(33750);
  });
});
