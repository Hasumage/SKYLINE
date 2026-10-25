export type ResultTeam = { id: string; name: string; balance: number; assetsCount: number };
export type ValuedHolding = { teamId: string; quantity: number; basePrice: number };
export type TeamDebt = { teamId: string; amount: number };

export function calculateMatchResults(teams: ResultTeam[], buildings: ValuedHolding[], stocks: ValuedHolding[], debts: TeamDebt[]) {
  const results = teams.map((team) => {
    const teamBuildings = buildings.filter((item) => item.teamId === team.id);
    const teamStocks = stocks.filter((item) => item.teamId === team.id);
    const buildingPoints = teamBuildings.reduce((sum, item) => sum + item.quantity * item.basePrice, 0);
    const resourcePoints = teamStocks.reduce((sum, item) => sum + item.quantity * item.basePrice, 0);
    const debt = debts.filter((item) => item.teamId === team.id).reduce((sum, item) => sum + item.amount, 0);
    const debtDeduction = Math.max(0, debt - team.balance);
    return {
      teamId: team.id, name: team.name, balance: team.balance, assetsCount: team.assetsCount,
      stockUnits: teamStocks.reduce((sum, item) => sum + item.quantity, 0),
      buildingPoints, resourcePoints, debt, debtDeduction,
      score: buildingPoints + resourcePoints - debtDeduction,
    };
  }).sort((left, right) => right.score - left.score || left.name.localeCompare(right.name, "ru") || left.teamId.localeCompare(right.teamId));

  return results.map((team, index) => ({
    ...team,
    rank: index > 0 && team.score === results[index - 1].score
      ? results.findIndex((item) => item.score === team.score) + 1 : index + 1,
    isWinner: team.score === results[0]?.score,
  }));
}
