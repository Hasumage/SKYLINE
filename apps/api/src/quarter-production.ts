import { Prisma, QuarterRunStatus } from "@prisma/client";

export async function settleQuarter(tx: Prisma.TransactionClient, sessionId: string, quarterNumber: number, ruleVersion: number) {
  const run = await tx.quarterRun.upsert({
    where: { sessionId_quarterNumber: { sessionId, quarterNumber } },
    create: { sessionId, quarterNumber, status: QuarterRunStatus.STARTED, ruleVersion },
    update: {},
  });
  if (run.status === QuarterRunStatus.COMMITTED) return false;

  const assets = await tx.ownedObject.findMany({
    where: { sessionId, builtInQuarter: { lte: quarterNumber }, firstProductionQuarter: { lte: quarterNumber }, team: { sessionId } },
    include: { objectType: { include: { yields: true } } },
  });
  const totals = new Map<string, { teamId: string; resourceTypeId: string; units: number }>();
  for (const asset of assets) {
    for (const yieldRule of asset.objectType.yields) {
      const key = `${asset.teamId}:${yieldRule.resourceTypeId}`;
      const current = totals.get(key) ?? { teamId: asset.teamId, resourceTypeId: yieldRule.resourceTypeId, units: 0 };
      current.units += asset.quantity * yieldRule.unitsPerQuarter;
      if (!Number.isSafeInteger(current.units)) throw new Error("Quarter production exceeds safe integer range");
      totals.set(key, current);
    }
  }

  for (const item of totals.values()) {
    await tx.productionLine.create({ data: {
      quarterRunId: run.id, teamId: item.teamId, resourceTypeId: item.resourceTypeId,
      producedUnits: item.units, unitPrice: 0, revenue: 0,
    } });
    await tx.resourceStock.upsert({
      where: { sessionId_teamId_resourceTypeId: { sessionId, teamId: item.teamId, resourceTypeId: item.resourceTypeId } },
      create: { sessionId, teamId: item.teamId, resourceTypeId: item.resourceTypeId, quantity: item.units },
      update: { quantity: { increment: item.units } },
    });
  }
  await tx.quarterRun.update({ where: { id: run.id }, data: { status: QuarterRunStatus.COMMITTED, finishedAt: new Date() } });
  return true;
}
