import { describe, expect, it } from "vitest";
import { calculateMatchResults } from "./match-results.js";

describe("calculateMatchResults", () => {
  const teams = [
    { id: "alpha", name: "Альфа", balance: 500, assetsCount: 2 },
    { id: "beta", name: "Бета", balance: 1000, assetsCount: 1 },
  ];
  const buildings = [
    { teamId: "alpha", quantity: 2, basePrice: 2000 },
    { teamId: "beta", quantity: 1, basePrice: 3000 },
  ];
  const stocks = [
    { teamId: "alpha", quantity: 10, basePrice: 50 },
    { teamId: "beta", quantity: 20, basePrice: 50 },
  ];

  it("offsets debt with balance without awarding extra balance as points", () => {
    const results = calculateMatchResults(teams, buildings, stocks, [
      { teamId: "alpha", amount: 800 }, { teamId: "beta", amount: 200 },
    ]);
    expect(results[0]).toMatchObject({ teamId: "alpha", buildingPoints: 4000, resourcePoints: 500, debtDeduction: 300, score: 4200, rank: 1, isWinner: true });
    expect(results[1]).toMatchObject({ teamId: "beta", buildingPoints: 3000, resourcePoints: 1000, debtDeduction: 0, score: 4000, rank: 2, isWinner: false });
  });

  it("allows a tie and a negative score", () => {
    const tied = calculateMatchResults(teams, buildings, stocks, [
      { teamId: "alpha", amount: 1000 }, { teamId: "beta", amount: 1000 },
    ]);
    expect(tied.map((team) => team.score)).toEqual([4000, 4000]);
    expect(tied.map((team) => team.rank)).toEqual([1, 1]);
    expect(tied.every((team) => team.isWinner)).toBe(true);

    const indebted = calculateMatchResults([teams[0]], [], [], [{ teamId: "alpha", amount: 1500 }]);
    expect(indebted[0].score).toBe(-1000);
  });
});
