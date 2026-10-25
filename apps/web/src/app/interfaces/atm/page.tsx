"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronDown,
  ChevronRight,
  Clock3,
  CreditCard,
  Search,
  WalletCards,
} from "lucide-react";
import { AtmScaleFrame } from "../../../components/skyline/atm-scale-frame";
import { api, getAccess, useLobby } from "../../../lib/lobby-client";
import { MatchResults } from "../../../components/skyline/match-results";

const MATCH_QUARTER_MS = 5 * 60 * 1000;

const tones = {
  blue: {
    tile: "from-blue-50 to-sky-100",
    bar: "bg-blue-600",
    icon: "from-sky-400 to-blue-700",
  },
  violet: {
    tile: "from-violet-50 to-purple-100",
    bar: "bg-violet-600",
    icon: "from-violet-400 to-purple-700",
  },
  green: {
    tile: "from-emerald-50 to-green-100",
    bar: "bg-emerald-600",
    icon: "from-emerald-400 to-green-700",
  },
  orange: {
    tile: "from-orange-50 to-amber-100",
    bar: "bg-orange-500",
    icon: "from-orange-400 to-orange-700",
  },
  rose: {
    tile: "from-rose-50 to-pink-100",
    bar: "bg-rose-500",
    icon: "from-rose-400 to-rose-700",
  },
};

type Tone = keyof typeof tones;

type Team = {
  id: string;
  name: string;
  balance: number;
  cashAmount: number;
  tone: Tone;
};

const teams: Team[] = [
  { id: "alpha", name: "Команда Альфа", balance: 25000, cashAmount: 10000, tone: "blue" },
  { id: "beta", name: "Команда Бета", balance: 0, cashAmount: 0, tone: "violet" },
  { id: "gamma", name: "Команда Гамма", balance: 37500, cashAmount: 15000, tone: "green" },
  { id: "delta", name: "Команда Дельта", balance: 50000, cashAmount: 5000, tone: "orange" },
  { id: "epsilon", name: "Команда Эпсилон", balance: 0, cashAmount: 0, tone: "rose" },
];

const journal = [
  { time: "14:03", team: "Команда Альфа", amount: "10 000 ₽" },
  { time: "13:27", team: "Команда Гамма", amount: "15 000 ₽" },
  { time: "12:11", team: "Команда Дельта", amount: "5 000 ₽" },
];

function formatTimer(ms: number) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function formatAmount(value: number) {
  return `${new Intl.NumberFormat("ru-RU").format(value)} ₽`.replace(/\u00a0/g, " ");
}

function formatInputAmount(value: number) {
  return new Intl.NumberFormat("ru-RU").format(value).replace(/\u00a0/g, " ");
}

function parseAmount(value: string) {
  return Number(value.replace(/\D/g, "")) || 0;
}

function QuarterTimer({
  durationMs = MATCH_QUARTER_MS,
  quarter = 2,
  serverStartedAt,
  clockOffset = 0,
}: {
  durationMs?: number;
  quarter?: number;
  serverStartedAt?: number;
  clockOffset?: number;
}) {
  const [clock, setClock] = useState({ mounted: false, now: 0, startedAt: 0 });

  useEffect(() => {
    const startedAt = serverStartedAt ?? Date.now();
    const tick = () => {
      setClock({ mounted: true, now: Date.now() + clockOffset, startedAt });
    };

    tick();
    const timerId = window.setInterval(tick, 250);

    return () => {
      window.clearInterval(timerId);
    };
  }, [serverStartedAt, clockOffset]);

  const elapsed = clock.mounted ? Math.max(0, clock.now - clock.startedAt) : 0;
  const visibleQuarter = serverStartedAt ? Math.max(1, Math.floor(elapsed / durationMs) + 1) : quarter;
  const remainingMs = clock.mounted ? durationMs - (elapsed % durationMs) : durationMs;
  const progress = Math.max(0, Math.min(1, remainingMs / durationMs));
  const center = 62;
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const strokeOffset = circumference * (1 - progress);

  return (
    <div className="absolute right-[46px] top-[6px] size-[124px]">
      <svg className="absolute inset-0 size-full" viewBox="0 0 124 124" aria-hidden="true">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="white"
          stroke="#e4edf9"
          strokeWidth="11"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#0b7cff"
          strokeLinecap="round"
          strokeWidth="11"
          strokeDasharray={circumference}
          strokeDashoffset={strokeOffset}
          transform={`rotate(-90 ${center} ${center})`}
          className="transition-[stroke-dashoffset] duration-200 ease-linear"
        />
        <circle
          cx={center}
          cy={center}
          r="44"
          fill="white"
          filter="drop-shadow(0 10px 24px rgba(21, 72, 156, 0.1))"
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">
        <div className="w-[96px]">
          <p className="whitespace-nowrap text-[13px] leading-none text-[#294ab5]">
            Квартал {visibleQuarter}
          </p>
          <p className="mt-[6px] whitespace-nowrap text-[24px] font-black leading-none text-black">
            {formatTimer(remainingMs)}
          </p>
        </div>
      </div>
    </div>
  );
}

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

function TeamIcon({ tone }: { tone: Tone }) {
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

function CityIllustration() {
  return (
    <div className="relative mx-auto h-[178px] w-[260px]">
      <div className="absolute bottom-[8px] left-[34px] h-[116px] w-[72px] rounded-[6px] bg-gradient-to-b from-sky-100 to-blue-400 shadow-[0_18px_35px_rgba(0,95,180,0.2)]">
        <div className="grid grid-cols-3 gap-[5px] p-[10px]">
          {Array.from({ length: 12 }).map((_, index) => (
            <div key={index} className="h-[10px] rounded-[2px] bg-white/80" />
          ))}
        </div>
      </div>
      <div className="absolute bottom-[18px] left-[100px] h-[142px] w-[88px] rounded-[7px] bg-gradient-to-b from-blue-50 to-blue-500 shadow-[0_18px_35px_rgba(0,95,180,0.2)]">
        <div className="grid grid-cols-3 gap-[6px] p-[12px]">
          {Array.from({ length: 15 }).map((_, index) => (
            <div key={index} className="h-[10px] rounded-[2px] bg-white/85" />
          ))}
        </div>
      </div>
      <div className="absolute left-[126px] top-0 h-[28px] w-[76px] rotate-[28deg] rounded-[4px] bg-orange-400" />
      <div className="absolute bottom-[2px] left-[18px] h-[30px] w-[210px] -skew-x-[24deg] rounded-[10px] bg-gradient-to-r from-lime-200 via-emerald-200 to-blue-200" />
      {[14, 214, 196].map((left) => (
        <div key={left} className="absolute bottom-[34px]" style={{ left }}>
          <div className="mx-auto h-[44px] w-[22px] rounded-full bg-gradient-to-b from-lime-400 to-green-700" />
          <div className="mx-auto mt-[-4px] h-[15px] w-[7px] bg-amber-700" />
        </div>
      ))}
      <div className="absolute bottom-[12px] right-[30px] h-[48px] w-[52px] rounded-[5px] bg-gradient-to-b from-blue-50 to-blue-300">
        <div className="grid grid-cols-2 gap-[4px] p-[8px]">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[8px] rounded-[2px] bg-white/80" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AtmInterfacePage() {
  const { snapshot, clockOffset, refresh } = useLobby("STAFF");
  const live = Boolean(snapshot && snapshot.status === "ACTIVE" && (snapshot.stationType === "ATM" || snapshot.stationType === "BANK"));
  const availableTeams: Team[] = live ? snapshot!.teams.map((team, index) => ({ id: team.id, name: team.name, balance: team.balance, cashAmount: 0, tone: (Object.keys(tones) as Tone[])[index % 5] })) : teams;
  const [selectedTeamId, setSelectedTeamId] = useState(teams[0].id);
  const [search, setSearch] = useState("");
  const [cashAmount, setCashAmount] = useState(formatInputAmount(teams[0].cashAmount));
  const [transactionError, setTransactionError] = useState("");
  const [busy, setBusy] = useState(false);
  const [teamBalances, setTeamBalances] = useState(() =>
    Object.fromEntries(teams.map((team) => [team.id, team.balance])),
  );
  const [transactionEffect, setTransactionEffect] = useState<{
    id: number;
    type: "deposit" | "withdraw" | "invalid";
    amount: number;
  } | null>(null);
  useEffect(() => {
    if (!live || !snapshot?.teams.length) return;
    setSelectedTeamId((current) => snapshot.teams.some((team) => team.id === current) ? current : snapshot.teams[0].id);
    setCashAmount((current) => current === formatInputAmount(teams[0].cashAmount) ? "" : current);
  }, [live, snapshot?.teams]);
  const selectedTeam = availableTeams.find((team) => team.id === selectedTeamId) ?? availableTeams[0] ?? teams[0];
  const selectedBalance = live ? selectedTeam.balance : teamBalances[selectedTeam.id] ?? selectedTeam.balance;
  const enteredAmount = parseAmount(cashAmount);
  const isValidAmount = enteredAmount > 0 && enteredAmount % 500 === 0;

  const visibleTeams = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    if (!normalizedSearch) {
      return availableTeams;
    }

    return availableTeams.filter((team) => team.name.toLowerCase().includes(normalizedSearch));
  }, [search, snapshot, live]);

  function selectTeam(team: Team) {
    setSelectedTeamId(team.id);
    setCashAmount(formatInputAmount(team.cashAmount));
  }

  function changeAmount(value: string) {
    const nextAmount = parseAmount(value);
    setCashAmount(value.replace(/\D/g, "") ? formatInputAmount(nextAmount) : "");
  }

  function playEffect(type: "deposit" | "withdraw" | "invalid", amount: number) {
    const id = Date.now();

    setTransactionEffect({ id, type, amount });
    window.setTimeout(() => {
      setTransactionEffect((current) => (current?.id === id ? null : current));
    }, 850);
  }

  async function handleTransaction(type: "deposit" | "withdraw") {
    if (!isValidAmount) {
      playEffect("invalid", enteredAmount);
      return;
    }
    if (live) {
      const access = getAccess();
      if (!access) return;
      setBusy(true); setTransactionError("");
      try {
        await api("/atm/transactions", { method: "POST", token: access.token, body: { teamId: selectedTeam.id, amount: enteredAmount, type, idempotencyKey: crypto.randomUUID() } });
        await refresh();
        playEffect(type, enteredAmount);
      } catch (cause) {
        setTransactionError(cause instanceof Error ? cause.message : "Операция не выполнена");
        playEffect("invalid", enteredAmount);
      } finally { setBusy(false); }
      return;
    }
    if (type === "withdraw" && selectedBalance < enteredAmount) { setTransactionError("Недостаточно средств на балансе"); playEffect("invalid", enteredAmount); return; }
    setTransactionError("");

    setTeamBalances((currentBalances) => {
      const currentBalance = currentBalances[selectedTeam.id] ?? selectedTeam.balance;
      const nextBalance =
        type === "deposit"
          ? currentBalance + enteredAmount
          : Math.max(0, currentBalance - enteredAmount);

      return {
        ...currentBalances,
        [selectedTeam.id]: nextBalance,
      };
    });
    playEffect(type, enteredAmount);
  }

  if (snapshot?.status === "FINISHED") return <MatchResults snapshot={snapshot} />;
  return (
    <main className="flex min-h-screen justify-center overflow-auto bg-[#f5fbff] p-4 text-[#05072c]">
      <AtmScaleFrame>
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
                Банкомат
              </h1>
              <p className="mt-[10px] text-[28px] font-medium leading-none text-[#3d59bf]">
                Внести
              </p>
            </div>
          </div>

          <QuarterTimer quarter={snapshot?.currentQuarter || 2} durationMs={(snapshot?.quarterDurationSec ?? 300) * 1000} serverStartedAt={snapshot?.startsAt ? new Date(snapshot.startsAt).getTime() : undefined} clockOffset={clockOffset} />
        </header>

        <section className="grid grid-cols-[416px_620px_416px] gap-[14px] px-[30px] pt-[28px]">
          <aside className="h-[858px] rounded-[14px] border border-[#d8e7f5] bg-white px-[16px] py-[16px]">
            <label className="flex h-[56px] items-center gap-[14px] rounded-[12px] bg-[#eef6ff] px-[16px] text-[22px] text-[#4b5fba]">
              <Search className="size-[28px] shrink-0" strokeWidth={2.5} />
              <input
                className="min-w-0 flex-1 bg-transparent text-[22px] leading-none text-[#4b5fba] outline-none placeholder:text-[#4b5fba]"
                placeholder="Поиск команды..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>

            <div className="mt-[16px] grid gap-0">
              {visibleTeams.map((team) => {
                const isActive = team.id === selectedTeamId;

                return (
                  <button
                    key={team.id}
                    className={[
                      "group relative flex h-[101px] w-full cursor-pointer items-center border-b border-[#dce8f6] text-left transition-all duration-300 ease-out hover:z-10 hover:-translate-y-[2px] hover:rounded-[12px] hover:border-b-transparent hover:bg-[#eef8ff] hover:shadow-[0_16px_32px_rgba(24,101,207,0.12),inset_0_0_0_1px_rgba(210,229,247,0.95)] active:translate-y-0",
                      isActive
                        ? "rounded-[12px] border-b-0 bg-[#eaf6ff] shadow-[inset_0_0_0_1px_rgba(234,246,255,1)]"
                        : "",
                    ].join(" ")}
                    type="button"
                    onClick={() => selectTeam(team)}
                  >
                    {isActive ? (
                      <div
                        className={`absolute -left-[18px] top-[5px] h-[91px] w-[7px] rounded-full ${tones[team.tone].bar}`}
                      />
                    ) : null}
                    <div className="ml-[16px] transition-transform duration-300 ease-out group-hover:scale-[1.04]">
                      <TeamIcon tone={team.tone} />
                    </div>
                    <div className="ml-[18px] grid gap-[7px]">
                      <p className="text-[22px] font-black leading-none tracking-[-0.035em]">
                        {team.name}
                      </p>
                      <p className="text-[20px] leading-none text-[#006dff]">
                        Баланс: {formatAmount(live ? team.balance : teamBalances[team.id] ?? team.balance)}
                      </p>
                    </div>
                    <ChevronRight
                      className="ml-auto mr-[12px] size-[34px] text-[#4057b7] transition-transform duration-300 ease-out group-hover:translate-x-[5px] group-hover:text-[#087cff]"
                      strokeWidth={2.4}
                    />
                  </button>
                );
              })}
            </div>
          </aside>

          <div className="grid grid-rows-[583px_260px] gap-[16px]">
            <section
              className={[
                "relative overflow-hidden rounded-[14px] border border-[#d8e7f5] bg-white px-[28px] pt-[38px] transition-shadow duration-300",
                transactionEffect?.type === "deposit"
                  ? "shadow-[0_0_0_4px_rgba(0,122,255,0.08),0_18px_45px_rgba(0,122,255,0.14)]"
                  : "",
                transactionEffect?.type === "withdraw"
                  ? "shadow-[0_0_0_4px_rgba(20,184,166,0.08),0_18px_45px_rgba(20,184,166,0.14)]"
                  : "",
              ].join(" ")}
            >
              {transactionEffect?.type === "deposit" ? (
                <div
                  key={transactionEffect.id}
                  className="pointer-events-none absolute left-[256px] top-[396px] z-20 rounded-full bg-[#087cff] px-[18px] py-[8px] text-[24px] font-black text-white shadow-[0_16px_30px_rgba(0,122,255,0.28)] animate-atm-money-deposit"
                >
                  +{formatAmount(transactionEffect.amount)}
                </div>
              ) : null}
              {transactionEffect?.type === "withdraw" ? (
                <div
                  key={transactionEffect.id}
                  className="pointer-events-none absolute left-[256px] top-[286px] z-20 rounded-full bg-[#10b7a5] px-[18px] py-[8px] text-[24px] font-black text-white shadow-[0_16px_30px_rgba(16,183,165,0.28)] animate-atm-money-withdraw"
                >
                  -{formatAmount(transactionEffect.amount)}
                </div>
              ) : null}
              <CityIllustration />
              <h2 className="mt-[18px] text-center text-[50px] font-black leading-none tracking-[-0.05em]">
                {selectedTeam.name}
              </h2>
              <p className="mt-[18px] text-center text-[22px] leading-none text-[#4b5fba]">
                Текущий электронный баланс
              </p>
              <p className="mt-[14px] text-center text-[42px] font-black leading-none text-[#006dff]">
                {formatAmount(selectedBalance)}
              </p>

              <div className="mt-[30px] h-px bg-[#d7e5f3]" />

              <label className="mt-[24px] block">
                <span className="text-[22px] font-medium leading-none">
                  Сумма наличных, ₽
                </span>
                <div
                  className={[
                    "mt-[14px] flex h-[66px] items-center rounded-[8px] border border-[#b7c9ee] bg-white transition-all duration-200",
                    transactionEffect?.type === "invalid"
                      ? "border-rose-400 shadow-[0_0_0_4px_rgba(244,63,94,0.12)] animate-atm-invalid"
                      : "focus-within:border-[#087cff] focus-within:shadow-[0_0_0_4px_rgba(0,122,255,0.1)]",
                  ].join(" ")}
                >
                  <div className="grid h-full w-[90px] place-items-center rounded-l-[8px] bg-[#eef6ff] text-[#5267c2]">
                    <WalletCards className="size-[42px]" strokeWidth={2.2} />
                  </div>
                  <input
                    className="ml-[24px] min-w-0 flex-1 bg-transparent text-[32px] font-black leading-none tracking-[-0.04em] text-[#05072c] outline-none"
                    inputMode="numeric"
                    min={0}
                    pattern="[0-9 ]*"
                    placeholder="0"
                    step={500}
                    value={cashAmount}
                    onChange={(event) => changeAmount(event.target.value)}
                  />
                  <div className="ml-auto mr-[22px] text-[31px] font-bold text-[#5267c2]">
                    ₽
                  </div>
                </div>
              </label>
            </section>

            <section className="rounded-[14px] border border-[#d8e7f5] bg-white px-[24px] py-[18px]">
              <h2 className="text-[26px] font-black leading-none tracking-[-0.035em]">
                {live ? "Операции с балансом" : "Журнал внесений"}
              </h2>
              <div className="mt-[13px] h-[39px] rounded-t-[10px] bg-[#eaf5ff]">
                <div className="grid h-full grid-cols-[270px_1fr_210px] items-center px-[28px] text-[17px] text-[#3d59bf]">
                  <span>Время</span>
                  <span>Команда</span>
                  <span>Сумма</span>
                </div>
              </div>
              <div>
                {live && !snapshot?.transactions?.length && <p className="px-[18px] py-[26px] text-[19px] text-[#5267a4]">Операций пока нет</p>}
                {live && snapshot?.transactions?.map((entry) => <div key={entry.id} className="grid h-[50px] grid-cols-[270px_1fr_210px] items-center border-b border-[#dce8f6] px-[18px] text-[19px] text-[#3d59bf]"><div className="flex items-center gap-[22px]"><Clock3 className="size-[30px] text-[#1747ad]" strokeWidth={2.5} /><span>{new Date(entry.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span></div><span>{snapshot.teams.find((team) => team.id === entry.teamId)?.name ?? "Команда"}</span><span className="text-[21px] font-black text-[#05072c]">{entry.type === "deposit" ? "+" : "−"}{formatAmount(entry.amount)}</span></div>)}
                {!live && journal.map((entry) => (
                  <div
                    key={entry.time}
                    className="grid h-[50px] grid-cols-[270px_1fr_210px] items-center border-b border-[#dce8f6] px-[18px] text-[19px] text-[#3d59bf]"
                  >
                    <div className="flex items-center gap-[22px]">
                      <Clock3 className="size-[30px] text-[#1747ad]" strokeWidth={2.5} />
                      <span>{entry.time}</span>
                    </div>
                    <span>{entry.team}</span>
                    <span className="text-[21px] font-black text-[#05072c]">
                      {entry.amount}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="h-[583px] rounded-[14px] border border-[#d8e7f5] bg-white">
            <div className="grid gap-[28px] py-[28px] pr-[28px] pl-[48px]">
            {transactionError && <p role="alert" className="text-[18px] text-rose-600">{transactionError}</p>}
            <button
              className={[
                "flex h-[135px] w-full cursor-pointer items-center rounded-[12px] bg-[#087cff] px-[28px] text-white shadow-[0_16px_35px_rgba(0,122,255,0.22)] transition-all duration-300 ease-out hover:-translate-y-[2px] hover:bg-[#006fec] hover:shadow-[0_22px_42px_rgba(0,122,255,0.3)] active:translate-y-[2px] active:scale-[0.99]",
                transactionEffect?.type === "deposit" ? "animate-atm-button-success" : "",
                transactionEffect?.type === "invalid" ? "animate-atm-invalid" : "",
              ].join(" ")}
              type="button"
              disabled={busy}
              onClick={() => handleTransaction("deposit")}
            >
              <span className="relative grid size-[84px] place-items-center rounded-[10px] bg-[#dff1ff] text-[#087cff]">
                <CreditCard className="size-[48px]" strokeWidth={2.2} />
                <span className="absolute -right-[8px] -top-[8px] grid size-[31px] place-items-center rounded-full bg-white text-[#087cff] shadow-[0_8px_18px_rgba(0,96,220,0.2)]">
                  <ArrowUpFromLine className="size-[19px]" strokeWidth={3} />
                </span>
              </span>
              <span className="ml-[24px] text-[31px] font-bold leading-none">
                Внести
              </span>
              <ChevronRight className="ml-auto size-[42px]" strokeWidth={2.4} />
            </button>
            <button
              className={[
                "flex h-[135px] w-full cursor-pointer items-center rounded-[12px] border border-[#91e0d9] bg-[#f4fffe] px-[28px] text-[#079b8c] shadow-[0_14px_30px_rgba(14,165,151,0.1)] transition-all duration-300 ease-out hover:-translate-y-[2px] hover:border-[#10b7a5] hover:bg-[#e9fffc] hover:shadow-[0_22px_42px_rgba(14,165,151,0.18)] active:translate-y-[2px] active:scale-[0.99]",
                transactionEffect?.type === "withdraw" ? "animate-atm-button-success" : "",
                transactionEffect?.type === "invalid" ? "animate-atm-invalid" : "",
              ].join(" ")}
              type="button"
              disabled={busy}
              onClick={() => handleTransaction("withdraw")}
            >
              <span className="relative grid size-[84px] place-items-center rounded-[10px] bg-white text-[#079b8c] shadow-[inset_0_0_0_1px_rgba(16,183,165,0.12)]">
                <WalletCards className="size-[48px]" strokeWidth={2.2} />
                <span className="absolute -right-[8px] -bottom-[8px] grid size-[31px] place-items-center rounded-full bg-[#079b8c] text-white shadow-[0_8px_18px_rgba(14,165,151,0.22)]">
                  <ArrowDownToLine className="size-[19px]" strokeWidth={3} />
                </span>
              </span>
              <span className="ml-[24px] text-[31px] font-bold leading-none">
                Снять
              </span>
              <ChevronDown className="ml-auto size-[42px]" strokeWidth={2.4} />
            </button>
            </div>
          </aside>
        </section>
      </AtmScaleFrame>
    </main>
  );
}
