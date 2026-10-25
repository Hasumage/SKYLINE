export function loanQuote(principal: number, rateBasisPoints: number, quarters: number) {
  const totalDue = Math.round(principal * (1 + rateBasisPoints * quarters / 10000));
  return { totalDue, paymentPerQuarter: Math.ceil(totalDue / quarters) };
}

export function loanPayoff(loan: { principalRemaining: number; accruedInterest: number; interestThroughQuarter: number; issuedQuarter: number; quarters: number; rateBasisPoints: number }, currentQuarter: number) {
  const throughQuarter = Math.min(Math.max(currentQuarter, loan.issuedQuarter), loan.issuedQuarter + loan.quarters - 1);
  const elapsed = Math.max(0, throughQuarter - loan.interestThroughQuarter);
  const interest = loan.accruedInterest + Math.round(loan.principalRemaining * loan.rateBasisPoints * elapsed / 10000);
  return { principal: loan.principalRemaining, interest, due: loan.principalRemaining + interest, throughQuarter };
}

export function applyLoanPayment(loan: ReturnType<typeof loanPayoff>, amount: number) {
  const interestPaid = Math.min(amount, loan.interest);
  const principalPaid = amount - interestPaid;
  return { principalRemaining: loan.principal - principalPaid, accruedInterest: loan.interest - interestPaid, remaining: loan.due - amount, interestPaid, principalPaid };
}
