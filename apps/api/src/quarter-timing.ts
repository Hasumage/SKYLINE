export const sessionOverrunMs = 60 * 60 * 1000;

export function quarterAt(startsAt: Date, quarterDurationSec: number, totalQuarters: number, at: Date) {
  const durationMs = quarterDurationSec * 1000;
  const elapsedMs = at.getTime() - startsAt.getTime();
  if (elapsedMs < 0 || elapsedMs >= durationMs * totalQuarters) return null;
  const quarter = Math.floor(elapsedMs / durationMs) + 1;
  const inFirstHalf = elapsedMs % durationMs < durationMs / 2;
  return { quarter, inFirstHalf, firstProductionQuarter: quarter + (inFirstHalf ? 0 : 1) };
}

export function completedQuarters(startsAt: Date, quarterDurationSec: number, totalQuarters: number, at: Date) {
  return Math.min(totalQuarters, Math.max(0, Math.floor((at.getTime() - startsAt.getTime()) / (quarterDurationSec * 1000))));
}

export function sessionExpired(startsAt: Date, quarterDurationSec: number, totalQuarters: number, at: Date) {
  return at.getTime() - startsAt.getTime() >= totalQuarters * quarterDurationSec * 1000 + sessionOverrunMs;
}
