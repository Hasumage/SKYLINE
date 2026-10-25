"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Banknote,
  Check,
  ChevronRight,
  CreditCard,
  Landmark,
  Search,
  WalletCards,
  X,
} from "lucide-react";
import { AtmScaleFrame } from "../../../components/skyline/atm-scale-frame";
import { api, getAccess, useLobby, useMatchClock } from "../../../lib/lobby-client";
import { MatchResults } from "../../../components/skyline/match-results";

type Loan = {
  id?: string;
  principal: number;
  rate: number;
  quarters: number;
  total: number;
  remaining: number;
  delivery: "cash" | "balance";
};
type Team = {
  id: string;
  name: string;
  balance: number;
  tone: string;
  loan: Loan | null;
};
type Mode = "issue" | "repay";

const initialTeams: Team[] = [
  {
    id: "alpha",
    name: "Команда Альфа",
    balance: 128000,
    tone: "blue",
    loan: {
      principal: 50000,
      rate: 10,
      quarters: 4,
      total: 70000,
      remaining: 25000,
      delivery: "balance",
    },
  },
  {
    id: "beta",
    name: "Команда Бета",
    balance: 96000,
    tone: "violet",
    loan: null,
  },
  {
    id: "gamma",
    name: "Команда Гамма",
    balance: 143500,
    tone: "green",
    loan: {
      principal: 30000,
      rate: 5,
      quarters: 3,
      total: 34500,
      remaining: 14500,
      delivery: "cash",
    },
  },
  {
    id: "delta",
    name: "Команда Дельта",
    balance: 112000,
    tone: "orange",
    loan: null,
  },
  {
    id: "epsilon",
    name: "Команда Эпсилон",
    balance: 81000,
    tone: "rose",
    loan: {
      principal: 40000,
      rate: 7.5,
      quarters: 4,
      total: 52000,
      remaining: 37500,
      delivery: "balance",
    },
  },
  {
    id: "zeta",
    name: "Команда Зета",
    balance: 74000,
    tone: "cyan",
    loan: null,
  },
  {
    id: "eta",
    name: "Команда Эта",
    balance: 109000,
    tone: "amber",
    loan: null,
  },
  {
    id: "theta",
    name: "Команда Тета",
    balance: 62000,
    tone: "sky",
    loan: null,
  },
];

const tones: Record<string, { tile: string; icon: string; bar: string }> = {
  blue: {
    tile: "from-blue-50 to-sky-100",
    icon: "from-sky-400 to-blue-700",
    bar: "bg-blue-600",
  },
  violet: {
    tile: "from-violet-50 to-purple-100",
    icon: "from-violet-400 to-purple-700",
    bar: "bg-violet-600",
  },
  green: {
    tile: "from-emerald-50 to-green-100",
    icon: "from-emerald-400 to-green-700",
    bar: "bg-emerald-600",
  },
  orange: {
    tile: "from-orange-50 to-amber-100",
    icon: "from-orange-400 to-orange-700",
    bar: "bg-orange-500",
  },
  rose: {
    tile: "from-rose-50 to-pink-100",
    icon: "from-rose-400 to-rose-700",
    bar: "bg-rose-500",
  },
  cyan: {
    tile: "from-cyan-50 to-cyan-100",
    icon: "from-cyan-400 to-cyan-700",
    bar: "bg-cyan-600",
  },
  amber: {
    tile: "from-amber-50 to-yellow-100",
    icon: "from-amber-400 to-amber-700",
    bar: "bg-amber-500",
  },
  sky: {
    tile: "from-sky-50 to-blue-100",
    icon: "from-sky-400 to-blue-600",
    bar: "bg-sky-600",
  },
};

const money = (value: number) =>
  `${new Intl.NumberFormat("ru-RU").format(value).replace(/[\u00a0\u202f]/g, " ")} ₽`;
const amount = (value: number) =>
  new Intl.NumberFormat("ru-RU").format(value).replace(/[\u00a0\u202f]/g, " ");
const parseAmount = (value: string) => Number(value.replace(/\D/g, "")) || 0;
const calculate = (principal: number, rate: number, quarters: number) => {
  const total = Math.round(principal * (1 + (rate / 100) * quarters));
  return {
    total,
    interest: total - principal,
    payment: Math.ceil(total / quarters),
  };
};

function SkylineLogo() {
  return (
    <div className="flex items-end gap-[2px]">
      {[28, 54, 72, 44].map((height, index) => (
        <div
          key={height}
          className="w-[14px] rounded-t-[4px] bg-gradient-to-b from-cyan-300 to-blue-700 shadow-[0_12px_24px_rgba(0,117,255,0.22)]"
          style={{ height, marginBottom: index === 0 || index === 3 ? 0 : 6 }}
        />
      ))}
      <div className="ml-[-60px] h-[8px] w-[92px] rounded-full bg-blue-600" />
    </div>
  );
}

function TeamIcon({ tone }: { tone: string }) {
  return (
    <div
      className={`grid size-[82px] place-items-center rounded-[12px] bg-gradient-to-br ${tones[tone].tile}`}
    >
      <div className="flex h-[54px] items-end gap-[4px]">
        {[24, 40, 56, 32].map((height) => (
          <div
            key={height}
            className={`w-[10px] rounded-t-[3px] bg-gradient-to-b ${tones[tone].icon}`}
            style={{ height }}
          />
        ))}
      </div>
    </div>
  );
}

function BankHeader({ mode, quarter, time }: { mode: Mode; quarter: number; time: string }) {
  return (
    <header className="relative h-[136px] border-b border-[#d8e7f5] bg-white">
      <div className="flex h-full items-center px-[48px]">
        <div className="flex items-center gap-[18px]">
          <SkylineLogo />
          <div className="text-[54px] font-black leading-none tracking-[-0.04em]">
            SKYLINE
          </div>
        </div>
        <div className="ml-[30px] h-[80px] w-px bg-[#cbdcf0]" />
        <div className="ml-[40px]">
          <h1 className="text-[42px] font-black leading-[42px] tracking-[-0.04em]">
            Банк
          </h1>
          <p className="mt-[10px] text-[28px] font-medium leading-none text-[#3d59bf]">
            {mode === "issue" ? "Оформление кредита" : "Погашение кредита"}
          </p>
        </div>
      </div>
      <div className="absolute right-[46px] top-[6px] grid size-[124px] place-items-center rounded-full border-[11px] border-[#e4edf9] border-t-[#0b7cff] border-r-[#0b7cff] bg-white text-center shadow-[0_10px_24px_rgba(21,72,156,0.1)]">
        <div>
          <p className="text-[13px] leading-none text-[#294ab5]">Квартал {quarter}</p>
          <p className="mt-[6px] text-[24px] font-black leading-none">{time}</p>
        </div>
      </div>
    </header>
  );
}

function PaymentSchedule({
  total,
  quarters,
}: {
  total: number;
  quarters: number;
}) {
  if (quarters < 1)
    return (
      <section className="rounded-[14px] border border-[#d8e7f5] bg-white px-[24px] py-[18px]">
        <h2 className="text-[26px] font-black">График платежей</h2>
        <p className="mt-[20px] text-[19px] text-[#5267a4]">
          Появится после заполнения условий кредита.
        </p>
      </section>
    );
  const payment = Math.ceil(total / quarters);
  return (
    <section className="overflow-hidden rounded-[14px] border border-[#d8e7f5] bg-white px-[24px] py-[18px]">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[26px] font-black leading-none tracking-[-0.035em]">
          График платежей
        </h2>
        <span className="text-[17px] text-[#5267a4]">{quarters} кварталов</span>
      </div>
      <div className="mt-[15px] grid grid-cols-[1fr_1fr] gap-x-[16px]">
        {Array.from({ length: Math.min(quarters, 6) }, (_, index) => (
          <div
            key={index}
            className="flex h-[48px] items-center justify-between border-b border-[#dce8f6] text-[18px]"
          >
            <span className="text-[#5267a4]">Квартал {index + 1}</span>
            <strong>
              {money(
                index === quarters - 1
                  ? total - payment * (quarters - 1)
                  : payment,
              )}
            </strong>
          </div>
        ))}
      </div>
      {quarters > 6 && (
        <p className="mt-[8px] text-[16px] text-[#5267a4]">
          Ещё {quarters - 6} кв. по {money(payment)}
        </p>
      )}
    </section>
  );
}

export default function BankInterfacePage() {
  const { snapshot, clockOffset, refresh } = useLobby("STAFF");
  const clock = useMatchClock(snapshot, clockOffset);
  const live = snapshot?.stationType === "BANK";
  const [demoTeams, setDemoTeams] = useState(initialTeams);
  const [loans, setLoans] = useState<(Loan & { id: string; teamId: string })[]>([]);
  const [busy, setBusy] = useState(false);
  const pendingOperation = useRef<{ fingerprint: string; key: string } | null>(null);
  const teams: Team[] = live ? snapshot.teams.map((item, index) => ({ id: item.id, name: item.name, balance: item.balance, tone: initialTeams[index % initialTeams.length].tone, loan: loans.find((loan) => loan.teamId === item.id && loan.remaining > 0) ?? loans.find((loan) => loan.teamId === item.id) ?? null })) : demoTeams;
  const [selectedId, setSelectedId] = useState("beta");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<Mode>("issue");
  const [principalInput, setPrincipalInput] = useState("50 000");
  const [rateInput, setRateInput] = useState("10");
  const [quartersInput, setQuartersInput] = useState("4");
  const [agreed, setAgreed] = useState<string | null>(null);
  const [repaymentInput, setRepaymentInput] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!live) return;
    const access = getAccess();
    if (!access) return;
    void api<typeof loans>("/bank/loans", { token: access.token }).then(setLoans).catch((error) => setNotice(error.message));
  }, [live, snapshot?.sequence]);

  useEffect(() => {
    if (live && snapshot.teams.length && !snapshot.teams.some((item) => item.id === selectedId)) setSelectedId(snapshot.teams[0].id);
  }, [live, snapshot?.teams, selectedId]);

  const team = teams.find((item) => item.id === selectedId) ?? teams[0] ?? initialTeams[0];
  const activeLoan = team.loan && team.loan.remaining > 0 ? team.loan : null;
  const visibleTeams = useMemo(
    () =>
      teams.filter((item) =>
        item.name
          .toLocaleLowerCase("ru")
          .includes(search.trim().toLocaleLowerCase("ru")),
      ),
    [teams, search],
  );
  const principal = parseAmount(principalInput);
  const rate = Number(rateInput);
  const quarters = Number(quartersInput);
  const validTerms =
    principal >= 500 &&
    principal <= 1000000 &&
    principal % 500 === 0 &&
    Number.isFinite(rate) &&
    rate >= 0 &&
    rate <= 20 &&
    Number.isInteger(quarters) &&
    quarters >= 1 &&
    quarters <= 10;
  const quote = validTerms ? calculate(principal, rate, quarters) : null;
  const termsKey = `${team.id}:${principal}:${rate}:${quarters}`;
  const repayment = parseAmount(repaymentInput);
  const validRepayment = Boolean(
    activeLoan && repayment > 0 && repayment <= activeLoan.remaining,
  );

  function selectTeam(next: Team) {
    setSelectedId(next.id);
    setAgreed(null);
    setRepaymentInput("");
    setNotice("");
  }

  async function issue(delivery: Loan["delivery"]) {
    if (!quote || !validTerms || agreed !== termsKey || activeLoan || busy) return;
    if (live) {
      if (snapshot.status !== "ACTIVE") { setNotice("Дождитесь начала матча"); return; }
      if (!snapshot.teams.some((item) => item.id === team.id)) { setNotice("Выберите команду"); return; }
      const access = getAccess();
      if (!access) return;
      const fingerprint = `issue:${team.id}:${principal}:${rate}:${quarters}:${delivery}`;
      if (pendingOperation.current?.fingerprint !== fingerprint) pendingOperation.current = { fingerprint, key: crypto.randomUUID() };
      setBusy(true);
      try {
        const updated = await api<typeof loans>("/bank/loans", { method: "POST", token: access.token, body: { teamId: team.id, principal, rate, quarters, delivery, idempotencyKey: pendingOperation.current.key } });
        setLoans(updated);
        pendingOperation.current = null;
        await refresh();
        setMode("repay");
        setAgreed(null);
        setNotice(delivery === "cash" ? `${team.name}: выдано наличными ${money(principal)}` : `${team.name}: на баланс начислено ${money(principal)}`);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось оформить кредит"); }
      finally { setBusy(false); }
      return;
    }
    setDemoTeams((current) =>
      current.map((item) =>
        item.id === team.id
          ? {
              ...item,
              balance: item.balance + (delivery === "balance" ? principal : 0),
              loan: {
                principal,
                rate,
                quarters,
                total: quote.total,
                remaining: quote.total,
                delivery,
              },
            }
          : item,
      ),
    );
    setMode("repay");
    setAgreed(null);
    setNotice(
      delivery === "cash"
        ? `${team.name}: выдано наличными ${money(principal)}`
        : `${team.name}: на баланс начислено ${money(principal)}`,
    );
  }

  async function repay() {
    if (!activeLoan || !validRepayment || busy) return;
    if (live) {
      if (snapshot.status !== "ACTIVE") { setNotice("Дождитесь начала матча"); return; }
      if (!snapshot.teams.some((item) => item.id === team.id)) { setNotice("Выберите команду"); return; }
      const access = getAccess();
      if (!access || !activeLoan.id) return;
      const fingerprint = `repay:${activeLoan.id}:${repayment}`;
      if (pendingOperation.current?.fingerprint !== fingerprint) pendingOperation.current = { fingerprint, key: crypto.randomUUID() };
      setBusy(true);
      try {
        const updated = await api<typeof loans>(`/bank/loans/${activeLoan.id}/payments`, { method: "POST", token: access.token, body: { amount: repayment, idempotencyKey: pendingOperation.current.key } });
        setLoans(updated);
        pendingOperation.current = null;
        setRepaymentInput("");
        const remaining = updated.find((loan) => loan.id === activeLoan.id)?.remaining ?? 0;
        setNotice(remaining ? `Внесено ${money(repayment)}. Осталось вернуть ${money(remaining)}` : `${team.name}: кредит полностью погашен`);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось внести погашение"); }
      finally { setBusy(false); }
      return;
    }
    const remaining = activeLoan.remaining - repayment;
    setDemoTeams((current) =>
      current.map((item) =>
        item.id === team.id && item.loan
          ? { ...item, loan: { ...item.loan, remaining } }
          : item,
      ),
    );
    setRepaymentInput("");
    setNotice(
      remaining
        ? `Внесено ${money(repayment)}. Осталось вернуть ${money(remaining)}`
        : `${team.name}: кредит полностью погашен`,
    );
  }

  if (snapshot?.status === "FINISHED") return <MatchResults snapshot={snapshot} />;
  return (
    <main className="flex min-h-screen justify-center overflow-auto bg-[#f5fbff] p-4 text-[#05072c]">
      <AtmScaleFrame>
        <BankHeader mode={mode} quarter={live ? clock?.quarter ?? snapshot.currentQuarter : 2} time={live ? clock?.text ?? "00:00" : "02:14"} />
        <section className="grid grid-cols-[416px_620px_416px] gap-[14px] px-[30px] pt-[28px]">
          <aside
            className="h-[858px] overflow-hidden rounded-[14px] border border-[#d8e7f5] bg-white px-[16px] py-[16px]"
            aria-label="Команды"
          >
            <label className="flex h-[56px] items-center gap-[14px] rounded-[12px] bg-[#eef6ff] px-[16px] text-[22px] text-[#4b5fba]">
              <Search className="size-[28px] shrink-0" strokeWidth={2.5} />
              <input
                className="min-w-0 flex-1 bg-transparent text-[22px] leading-none text-[#4b5fba] outline-none placeholder:text-[#4b5fba]"
                placeholder="Поиск команды..."
                aria-label="Поиск команды"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="mt-[16px] h-[750px] overflow-y-auto">
              {visibleTeams.length ? (
                visibleTeams.map((item) => (
                  <button
                    key={item.id}
                    className={`group relative flex h-[91px] w-full cursor-pointer items-center border-b border-[#dce8f6] text-left transition-colors hover:rounded-[12px] hover:bg-[#eef8ff] ${item.id === team.id ? "rounded-[12px] border-b-0 bg-[#eaf6ff]" : ""}`}
                    type="button"
                    onClick={() => selectTeam(item)}
                    aria-current={item.id === team.id ? "true" : undefined}
                  >
                    {item.id === team.id && (
                      <span
                        className={`absolute -left-[16px] top-[5px] h-[81px] w-[7px] rounded-full ${tones[item.tone].bar}`}
                      />
                    )}
                    <span className="ml-[16px]">
                      <TeamIcon tone={item.tone} />
                    </span>
                    <span className="ml-[18px] min-w-0 flex-1">
                      <strong className="block truncate text-[22px] font-black leading-none">
                        {item.name}
                      </strong>
                      <small className="mt-[7px] block truncate text-[18px] leading-none text-[#006dff]">
                        {item.loan?.remaining
                          ? `Осталось ${money(item.loan.remaining)}`
                          : "Кредита нет"}
                      </small>
                    </span>
                    <ChevronRight
                      className="mr-[12px] size-[34px] shrink-0 text-[#4057b7]"
                      strokeWidth={2.4}
                    />
                  </button>
                ))
              ) : (
                <p className="px-[16px] py-[24px] text-[20px] text-[#5267a4]">
                  Команды не найдены
                </p>
              )}
            </div>
          </aside>

          <div className="grid grid-rows-[583px_260px] gap-[16px]">
            <section className="overflow-hidden rounded-[14px] border border-[#d8e7f5] bg-white px-[28px] pt-[28px]">
              <div className="flex items-center gap-[18px]">
                <TeamIcon tone={team.tone} />
                <div className="min-w-0">
                  <h2 className="truncate text-[34px] font-black leading-none tracking-[-0.035em]">
                    {team.name}
                  </h2>
                  <div className="mt-[12px] flex items-center gap-[12px]">
                    <span
                      className={`rounded-[7px] px-[10px] py-[6px] text-[16px] font-bold ${activeLoan ? "bg-[#e2f8ec] text-[#07934c]" : "bg-[#edf3f9] text-[#5267a4]"}`}
                    >
                      {activeLoan ? "Активный кредит" : "Кредита нет"}
                    </span>
                    <span className="bank-team-balance flex items-center gap-[6px] whitespace-nowrap text-[17px] text-[#5267a4]">
                      <WalletCards className="size-[20px]" /> Баланс{" "}
                      {money(team.balance)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="mt-[24px] h-px bg-[#d7e5f3]" />
              {mode === "issue" ? (
                activeLoan ? (
                  <div className="mt-[54px] text-center">
                    <Landmark className="mx-auto size-[68px] text-[#087cff]" />
                    <h3 className="mt-[22px] text-[28px] font-black">
                      У команды уже есть кредит
                    </h3>
                    <p className="mt-[14px] text-[21px] text-[#5267a4]">
                      Сначала погасите остаток {money(activeLoan.remaining)}.
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 className="mt-[24px] text-[27px] font-black">
                      Параметры займа
                    </h3>
                    <div className="mt-[20px] grid grid-cols-3 gap-[12px]">
                      <label className="text-[17px] text-[#5267a4]">
                        Сумма займа, ₽
                        <input
                          className="mt-[9px] h-[62px] w-full rounded-[8px] border border-[#b7c9ee] px-[14px] text-[25px] font-black text-[#05072c] outline-none focus:border-[#087cff]"
                          inputMode="numeric"
                          value={principalInput}
                          onChange={(event) => {
                            const next = parseAmount(event.target.value);
                            setPrincipalInput(
                              event.target.value.replace(/\D/g, "")
                                ? amount(next)
                                : "",
                            );
                            setAgreed(null);
                          }}
                        />
                        <small className="mt-[7px] block text-[14px]">
                          Кратно 500 ₽
                        </small>
                      </label>
                      <label className="text-[17px] text-[#5267a4]">
                        Ставка в квартал, %
                        <input
                          className="mt-[9px] h-[62px] w-full rounded-[8px] border border-[#b7c9ee] px-[14px] text-[25px] font-black text-[#05072c] outline-none focus:border-[#087cff]"
                          inputMode="decimal"
                          type="number"
                          min="0"
                          max="20"
                          step="0.5"
                          value={rateInput}
                          onChange={(event) => {
                            setRateInput(event.target.value);
                            setAgreed(null);
                          }}
                        />
                        <small className="mt-[7px] block text-[14px]">
                          От 0 до 20%
                        </small>
                      </label>
                      <label className="text-[17px] text-[#5267a4]">
                        Срок, кварталов
                        <input
                          className="mt-[9px] h-[62px] w-full rounded-[8px] border border-[#b7c9ee] px-[14px] text-[25px] font-black text-[#05072c] outline-none focus:border-[#087cff]"
                          inputMode="numeric"
                          type="number"
                          min="1"
                          max="10"
                          value={quartersInput}
                          onChange={(event) => {
                            setQuartersInput(event.target.value);
                            setAgreed(null);
                          }}
                        />
                        <small className="mt-[7px] block text-[14px]">
                          От 1 до 10
                        </small>
                      </label>
                    </div>
                    {quote ? (
                      <div className="mt-[27px] rounded-[10px] bg-[#eef6ff] p-[20px]">
                        <h4 className="text-[20px] font-black">
                          Расчёт по займу
                        </h4>
                        <div className="mt-[15px] grid grid-cols-2 divide-x divide-[#cbdcf0]">
                          <div className="pr-[15px]">
                            <small className="text-[16px] text-[#5267a4]">
                              Вернуть всего
                            </small>
                            <strong className="mt-[6px] block text-[31px] font-black text-[#087cff]">
                              {money(quote.total)}
                            </strong>
                            <span className="text-[15px] text-[#5267a4]">
                              Проценты: {money(quote.interest)}
                            </span>
                          </div>
                          <div className="pl-[16px]">
                            <small className="text-[16px] text-[#5267a4]">
                              Платёж за квартал
                            </small>
                            <strong className="mt-[6px] block text-[31px] font-black text-[#087cff]">
                              {money(quote.payment)}
                            </strong>
                            <span className="text-[15px] text-[#5267a4]">
                              Последний учитывает округление
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p
                        role="alert"
                        className="mt-[28px] text-[18px] text-rose-600"
                      >
                        Проверьте сумму, ставку и срок.
                      </p>
                    )}
                  </>
                )
              ) : activeLoan ? (
                <>
                  <h3 className="mt-[19px] text-[27px] font-black">
                    Параметры кредита
                  </h3>
                  <div className="mt-[10px] grid gap-[2px]">
                    <div className="flex justify-between border-b border-[#e1eafa] py-[9px] text-[20px]">
                      <span className="text-[#5267a4]">Сумма займа</span>
                      <strong>{money(activeLoan.principal)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-[#e1eafa] py-[9px] text-[20px]">
                      <span className="text-[#5267a4]">Осталось выплатить</span>
                      <strong>{money(activeLoan.remaining)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-[#e1eafa] py-[9px] text-[20px]">
                      <span className="text-[#5267a4]">Платёж в квартал</span>
                      <strong>
                        {money(
                          Math.ceil(activeLoan.total / activeLoan.quarters),
                        )}
                      </strong>
                    </div>
                    <div className="flex justify-between border-b border-[#e1eafa] py-[9px] text-[20px]">
                      <span className="text-[#5267a4]">Ставка</span>
                      <strong>{activeLoan.rate}% / квартал</strong>
                    </div>
                    <div className="flex justify-between border-b border-[#e1eafa] py-[9px] text-[20px]">
                      <span className="text-[#5267a4]">Срок</span>
                      <strong>{activeLoan.quarters} квартала</strong>
                    </div>
                  </div>
                  <div className="mt-[17px]">
                    <div className="flex justify-between text-[18px]">
                      <strong>Прогресс погашения</strong>
                      <strong>
                        {Math.round(
                          (1 - activeLoan.remaining / activeLoan.total) * 100,
                        )}
                        %
                      </strong>
                    </div>
                    <div className="mt-[9px] h-[14px] overflow-hidden rounded-full bg-[#dce9f8]">
                      <div
                        className="h-full rounded-full bg-[#087cff]"
                        style={{
                          width: `${(1 - activeLoan.remaining / activeLoan.total) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <div className="mt-[58px] text-center">
                  <Check className="mx-auto size-[68px] text-[#087cff]" />
                  <h3 className="mt-[22px] text-[28px] font-black">
                    {team.loan ? "Кредит погашен" : "Кредита нет"}
                  </h3>
                  <p className="mt-[14px] text-[21px] text-[#5267a4]">
                    Для команды нет суммы к возврату.
                  </p>
                </div>
              )}
            </section>
            <PaymentSchedule
              total={
                mode === "issue" && quote && !activeLoan
                  ? quote.total
                  : (activeLoan?.total ?? 0)
              }
              quarters={
                mode === "issue" && quote && !activeLoan
                  ? quarters
                  : (activeLoan?.quarters ?? 0)
              }
            />
          </div>

          <aside
            className="h-[858px] rounded-[14px] border border-[#d8e7f5] bg-white px-[24px] py-[24px]"
            aria-label="Действия банка"
          >
            <div className="grid gap-[14px]">
              <button
                type="button"
                className={`flex h-[108px] items-center gap-[16px] rounded-[12px] px-[18px] text-left transition-colors ${mode === "issue" ? "bg-[#087cff] text-white shadow-[0_16px_35px_rgba(0,122,255,0.22)]" : "bg-[#eef6ff] text-[#087cff] hover:bg-[#e2f0ff]"}`}
                onClick={() => {
                  setMode("issue");
                  setNotice("");
                }}
              >
                <span
                  className={`grid size-[65px] shrink-0 place-items-center rounded-[10px] ${mode === "issue" ? "bg-white/20" : "bg-white"}`}
                >
                  <CreditCard className="size-[34px]" />
                </span>
                <span className="flex-1 text-[24px] font-bold">
                  Оформить кредит
                </span>
                <ChevronRight className="size-[32px]" />
              </button>
              <button
                type="button"
                className={`flex h-[108px] items-center gap-[16px] rounded-[12px] px-[18px] text-left transition-colors ${mode === "repay" ? "bg-[#087cff] text-white shadow-[0_16px_35px_rgba(0,122,255,0.22)]" : "bg-[#eef6ff] text-[#087cff] hover:bg-[#e2f0ff]"}`}
                onClick={() => {
                  setMode("repay");
                  setNotice("");
                }}
              >
                <span
                  className={`grid size-[65px] shrink-0 place-items-center rounded-[10px] ${mode === "repay" ? "bg-white/20" : "bg-white"}`}
                >
                  <ArrowDownToLine className="size-[34px]" />
                </span>
                <span className="flex-1 text-[24px] font-bold">
                  Внести погашение
                </span>
                <ChevronRight className="size-[32px]" />
              </button>
            </div>
            <div className="mt-[25px] h-px bg-[#d7e5f3]" />
            {notice && (
              <div
                role="status"
                className="mt-[22px] flex items-start gap-[10px] rounded-[9px] bg-[#e7f9ef] p-[15px] text-[17px] text-[#087f48]"
              >
                <Check className="size-[24px] shrink-0" />
                <span className="flex-1">{notice}</span>
                <button
                  type="button"
                  onClick={() => setNotice("")}
                  aria-label="Скрыть сообщение"
                >
                  <X className="size-[19px]" />
                </button>
              </div>
            )}
            {mode === "issue" ? (
              activeLoan ? (
                <p className="mt-[28px] text-[19px] leading-snug text-[#5267a4]">
                  Новый кредит доступен после погашения текущего.
                </p>
              ) : (
                <>
                  <h3 className="mt-[28px] text-[23px] font-black">
                    Выдача средств
                  </h3>
                  <p className="mt-[10px] text-[18px] leading-snug text-[#5267a4]">
                    {agreed === termsKey
                      ? "Выберите способ выдачи согласованной суммы."
                      : "Согласуйте сумму, ставку и срок с командой. Проценты начисляются за каждый квартал."}
                  </p>
                  {agreed === termsKey && quote ? (
                    <div className="mt-[21px] grid gap-[13px]">
                      <div className="flex items-center gap-[8px] text-[18px] font-bold text-[#07934c]">
                        <Check className="size-[22px]" /> Условия подтверждены
                      </div>
                      <button
                        type="button"
                        className="flex h-[98px] items-center gap-[16px] rounded-[12px] bg-[#087cff] px-[20px] text-left text-white hover:bg-[#006fec]"
                        onClick={() => issue("cash")}
                      >
                        <Banknote className="size-[42px]" />
                        <span>
                          <strong className="block text-[23px]">
                            Выдать наличными
                          </strong>
                          <small className="text-[16px]">
                            {money(principal)}
                          </small>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="flex h-[98px] items-center gap-[16px] rounded-[12px] border border-[#91e0d9] bg-[#f4fffe] px-[20px] text-left text-[#079b8c] hover:bg-[#e9fffc]"
                        onClick={() => issue("balance")}
                      >
                        <WalletCards className="size-[42px]" />
                        <span>
                          <strong className="block text-[22px]">
                            Начислить на баланс
                          </strong>
                          <small className="text-[16px]">
                            {money(principal)}
                          </small>
                        </span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="mt-[24px] flex h-[68px] w-full items-center justify-center gap-[10px] rounded-[10px] bg-[#087cff] text-[22px] font-bold text-white disabled:bg-[#b4d5ff]"
                      disabled={!quote}
                      onClick={() => setAgreed(termsKey)}
                    >
                      Согласовать условия <ArrowRight className="size-[26px]" />
                    </button>
                  )}
                </>
              )
            ) : activeLoan ? (
              <>
                <h3 className="mt-[28px] text-[23px] font-black">
                  Сумма погашения
                </h3>
                <label className="mt-[15px] block text-[18px] text-[#5267a4]">
                  Наличные от команды, ₽
                  <span className="mt-[10px] flex h-[66px] items-center rounded-[8px] border border-[#b7c9ee] bg-white focus-within:border-[#087cff]">
                    <span className="grid h-full w-[66px] place-items-center rounded-l-[8px] bg-[#eef6ff] text-[#5267c2]">
                      <WalletCards className="size-[34px]" />
                    </span>
                    <input
                      className="ml-[14px] min-w-0 flex-1 bg-transparent text-[28px] font-black outline-none"
                      inputMode="numeric"
                      placeholder="0"
                      value={repaymentInput}
                      onChange={(event) => {
                        const next = parseAmount(event.target.value);
                        setRepaymentInput(
                          event.target.value.replace(/\D/g, "")
                            ? amount(next)
                            : "",
                        );
                      }}
                    />
                    <span className="mr-[16px] text-[25px] text-[#5267c2]">
                      ₽
                    </span>
                  </span>
                </label>
                <p className="mt-[10px] text-[16px] text-[#5267a4]">
                  Осталось вернуть: {money(activeLoan.remaining)}
                </p>
                {repayment > 0 && !validRepayment && (
                  <p
                    role="alert"
                    className="mt-[12px] text-[17px] text-rose-600"
                  >
                    Нельзя внести больше остатка долга.
                  </p>
                )}
                <button
                  type="button"
                  className="mt-[17px] h-[49px] w-full rounded-[8px] border border-[#b7c9ee] text-[18px] font-bold text-[#087cff] hover:bg-[#eef6ff]"
                  onClick={() =>
                    setRepaymentInput(amount(activeLoan.remaining))
                  }
                >
                  Погасить полностью
                </button>
                <button
                  type="button"
                  className="mt-[15px] flex h-[78px] w-full items-center justify-center gap-[12px] rounded-[12px] bg-[#087cff] text-[24px] font-bold text-white disabled:bg-[#b4d5ff]"
                  disabled={!validRepayment}
                  onClick={repay}
                >
                  <ArrowDownToLine className="size-[30px]" /> Внести сумму
                </button>
              </>
            ) : (
              <p className="mt-[28px] text-[19px] leading-snug text-[#5267a4]">
                Для этой команды нет активного кредита.
              </p>
            )}
          </aside>
        </section>
      </AtmScaleFrame>
    </main>
  );
}
