"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Copy, LogIn, MonitorPlay, Play, Shield, UserRoundX, UsersRound } from "lucide-react";
import { LobbyBrand } from "./lobby-brand";
import { MatchResults } from "./match-results";
import { PlayerHome } from "./player-home";
import { api, clearAccess, getAccess, saveAccess, useLobby, useMatchClock, type LobbySnapshot } from "../../lib/lobby-client";

const labels: Record<string, string> = {
  BANK: "Банк", CONSTRUCTION: "Строительство", ATM: "Банкомат", PATENT_OFFICE: "Наука",
  MEDICINE: "Медицина", ENTERPRISES: "Предприятия", MAYOR: "Мэр города",
};
type LoginResponse = { token: string; sessionId: string; role: "ORGANIZER" | "STAFF"; stationType?: string; snapshot: LobbySnapshot };

function Header({ caption }: { caption: string }) {
  return <header className="flex items-center justify-between border-b border-[#d8e7f5] bg-white px-4 py-3"><LobbyBrand /><span className="text-xs font-semibold text-[#5267a4]">{caption}</span></header>;
}

function ErrorText({ value }: { value: string }) { return value ? <p className="text-sm text-rose-600" role="alert">{value}</p> : null; }

export function AdminLogin() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const access = getAccess();
    if (!access || access.role === "PLAYER") return;
    void api<LobbySnapshot>("/auth/me", { token: access.token }).then((state) => {
      router.replace(state.role === "ORGANIZER" ? "/admin/lobby" : `/admin/station/${state.stationType?.toLowerCase()}`);
    }).catch(() => {});
  }, [router]);
  async function submit(event: FormEvent) {
    event.preventDefault(); setError(""); setBusy(true);
    try {
      const result = await api<LoginResponse>("/admin/login", { method: "POST", body: { code } });
      saveAccess({ token: result.token, sessionId: result.sessionId, role: result.role });
      router.replace(result.role === "ORGANIZER" ? "/admin/lobby" : `/admin/station/${result.stationType?.toLowerCase()}`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось войти"); }
    finally { setBusy(false); }
  }
  return <main className="min-h-svh bg-[#f5fbff] text-[#071632]"><div className="mx-auto min-h-svh max-w-[430px] bg-white shadow-sm"><Header caption="Администратор" />
    <form className="space-y-5 px-6 pt-12" onSubmit={submit}>
      <div><Shield className="mb-3 size-9 text-[#087cff]" /><h1 className="text-[26px] font-extrabold">Вход администратора</h1><p className="mt-1 text-sm text-[#6179a4]">Введите команду создания или код структуры</p></div>
      <label className="block text-sm font-semibold text-[#5267a4]">Команда или код<input className="mt-2 h-12 w-full rounded-[7px] border border-[#b7c9ee] px-4 text-lg font-bold outline-none focus:border-[#087cff]" value={code} onChange={(event) => { setCode(event.target.value); setError(""); }} autoCapitalize="none" autoComplete="off" spellCheck={false} /></label>
      <ErrorText value={error} />
      <button className="flex h-13 w-full items-center justify-center gap-2 rounded-[7px] bg-[#087cff] font-bold text-white disabled:opacity-50" disabled={busy || !code} type="submit">Войти <LogIn size={19} /></button>
    </form></div></main>;
}

function Code({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() { await navigator.clipboard.writeText(value); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }
  return <button type="button" onClick={copy} className="flex items-center gap-2 rounded-[6px] border border-[#c7dbf5] bg-white px-3 py-2 font-mono text-sm font-bold text-[#087cff]" title="Копировать код">{value}{copied ? <Check size={15} /> : <Copy size={15} />}</button>;
}

export function AdminLobby() {
  const router = useRouter();
  const { snapshot, error, loading, clockOffset, refresh } = useLobby("ORGANIZER");
  const clock = useMatchClock(snapshot, clockOffset);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);
  const qualifiedTeams = snapshot?.teams.filter((team) => team.members >= 2).length ?? 0;
  const missingStations = snapshot?.stations.filter((station) => station.enabled && !station.ready).length ?? 0;
  async function change(path: string, method = "POST", body?: unknown) {
    const access = getAccess(); if (!access) return;
    setBusy(true); setActionError("");
    try { await api(path, { method, body, token: access.token }); await refresh(); }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : "Операция не выполнена"); }
    finally { setBusy(false); }
  }
  if (!snapshot && !loading && error) return <main className="mx-auto max-w-[500px] p-6"><ErrorText value={error} /><button className="mt-4 text-[#087cff]" onClick={() => router.push("/admin/login")}>Войти снова</button></main>;
  if (snapshot && ["FINISHED"].includes(snapshot.status)) return <><MatchResults snapshot={snapshot} /><div className="mx-auto max-w-[760px] bg-[#f2f8fd] px-4 pb-8"><button className="flex h-12 w-full items-center justify-center gap-2 rounded-[7px] bg-[#087cff] font-bold text-white" type="button" onClick={() => { clearAccess(); router.replace("/admin/login"); }}>Создать новую сессию <ArrowRight size={18} /></button></div></>;
  return <main className="min-h-svh bg-[#f5fbff] text-[#071632]"><div className="mx-auto min-h-svh max-w-[680px] bg-white"><Header caption="Главный администратор" />
    <div className="space-y-6 px-4 py-5">
      <div><h1 className="text-[25px] font-extrabold">Управление сессией</h1><p className="text-sm text-[#6179a4]">{snapshot?.status === "ACTIVE" ? `Квартал ${clock?.quarter ?? snapshot.currentQuarter} из ${snapshot.totalQuarters} · ${clock?.text ?? "00:00"}` : snapshot?.status === "FINISHED" ? "Сессия завершена" : "Ожидание игроков и структур"}</p></div>
      {loading && <p>Загрузка...</p>}
      {snapshot?.codes && <section className="space-y-3 border-y border-[#d8e7f5] py-4"><h2 className="font-bold">Коды доступа</h2><div className="flex items-center justify-between gap-3"><span className="text-sm">Игроки</span><Code value={snapshot.codes.player} /></div><div className="flex items-center justify-between gap-3"><span className="text-sm">Проектор</span><Code value={snapshot.codes.projector} /></div>{snapshot.stations.map((station) => <div className="flex items-center justify-between gap-3" key={station.type}><span className="text-sm">{labels[station.type]}</span><Code value={snapshot.codes!.staff[station.type]} /></div>)}</section>}
      {snapshot && <section className="border-b border-[#d8e7f5] pb-5"><h2 className="mb-3 font-bold">Время матча</h2><div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-semibold text-[#5267a4]">Кварталов<select className="mt-1 block h-11 w-full rounded-[7px] border border-[#b7c9ee] bg-white px-3 text-base font-bold text-[#071632] disabled:bg-[#f1f5fa]" value={snapshot.totalQuarters} disabled={busy || snapshot.status !== "WAITING"} onChange={(event) => void change("/admin/settings", "PATCH", { totalQuarters: Number(event.target.value), quarterDurationMin: snapshot.quarterDurationSec / 60 })}>{Array.from({ length: 21 }, (_, index) => index + 10).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="text-sm font-semibold text-[#5267a4]">Минут в квартале<select className="mt-1 block h-11 w-full rounded-[7px] border border-[#b7c9ee] bg-white px-3 text-base font-bold text-[#071632] disabled:bg-[#f1f5fa]" value={snapshot.quarterDurationSec / 60} disabled={busy || snapshot.status !== "WAITING"} onChange={(event) => void change("/admin/settings", "PATCH", { totalQuarters: snapshot.totalQuarters, quarterDurationMin: Number(event.target.value) })}>{Array.from({ length: 6 }, (_, index) => index + 5).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
      </div></section>}
      <section><h2 className="mb-2 font-bold">Структуры</h2><div className="divide-y divide-[#e4edf7] border-y border-[#e4edf7]">{snapshot?.stations.map((station) => <div className="flex min-h-12 items-center gap-2 py-2" key={station.type}>
        <span className="min-w-0 flex-1 text-sm font-semibold">{labels[station.type]}</span>
        <span className={`text-xs ${station.ready ? "text-[#009b89]" : "text-[#8292aa]"}`}>{station.ready ? "Онлайн" : station.assigned ? "Назначен" : "Не подключён"}</span>
        {station.assigned && <button type="button" className="grid size-8 shrink-0 place-items-center text-rose-600 disabled:opacity-50" title="Исключить администратора структуры" aria-label={`Исключить администратора: ${labels[station.type]}`} disabled={busy} onClick={() => { if (confirm(`Исключить администратора структуры «${labels[station.type]}»? Код входа будет заменён.`)) void change(`/admin/stations/${station.type}/kick`); }}><UserRoundX size={18} /></button>}
        <label className="relative inline-flex cursor-pointer items-center" title={station.assigned ? "Сначала исключите администратора" : "Включить структуру"}><input className="peer sr-only" type="checkbox" checked={station.enabled} disabled={busy || station.assigned || snapshot.status !== "WAITING"} onChange={(event) => void change(`/admin/stations/${station.type}`, "PATCH", { enabled: event.target.checked })} /><span className="h-6 w-10 rounded-full bg-[#c9d7e9] transition peer-checked:bg-[#087cff] peer-disabled:opacity-50 after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:transition after:content-[''] peer-checked:after:translate-x-4" /></label>
      </div>)}</div></section>
      <section><h2 className="mb-2 flex items-center gap-2 font-bold"><UsersRound size={18} />Команды и игроки</h2>{!snapshot?.teams.length && <p className="text-sm text-[#6179a4]">Команд пока нет</p>}{snapshot?.teams.map((team) => <div className="border-t border-[#d8e7f5] py-3" key={team.id}><div className="flex items-center gap-2"><span className="size-3 rounded-full" style={{ backgroundColor: team.color }} /><strong>{team.name}</strong><span className="text-sm text-[#6179a4]">{team.members}</span></div>{team.participants?.map((person) => <div className="mt-2 flex items-center gap-2 pl-5 text-sm" key={person.id}><span className="min-w-0 flex-1 truncate">{person.displayName}</span><select className="max-w-28 rounded border border-[#c7dbf5] bg-white p-1" aria-label={`Команда для ${person.displayName}`} value={team.id} disabled={busy || person.disqualified} onChange={(event) => void change(`/admin/players/${person.id}/team`, "PATCH", { teamId: event.target.value })}>{snapshot.teams.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select><button type="button" className="text-xs font-semibold text-rose-600" disabled={busy || person.disqualified} onClick={() => { if (confirm(`Дисквалифицировать ${person.displayName}?`)) void change(`/admin/players/${person.id}/disqualify`); }}>Дисквалифицировать</button></div>)}</div>)}{!!snapshot?.participants?.filter((person) => !person.teamId && !person.disqualified).length && <div className="border-t border-[#d8e7f5] py-3"><strong>Без команды</strong>{snapshot.participants.filter((person) => !person.teamId && !person.disqualified).map((person) => <div className="mt-2 flex items-center gap-2 text-sm" key={person.id}><span className="flex-1">{person.displayName}</span><select className="rounded border border-[#c7dbf5] bg-white p-1" defaultValue="" onChange={(event) => void change(`/admin/players/${person.id}/team`, "PATCH", { teamId: event.target.value })}><option value="" disabled>В команду</option>{snapshot.teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><button className="text-xs text-rose-600" onClick={() => void change(`/admin/players/${person.id}/disqualify`)}>Исключить</button></div>)}</div>}</section>
      <ErrorText value={actionError || error} />
      {snapshot && <button className="flex w-full items-center gap-3 rounded-[7px] border border-[#c6dffc] bg-[#edf6ff] px-4 py-3 text-left font-bold text-[#087cff]" type="button" onClick={() => router.push("/admin/projector")}><MonitorPlay size={22} />Проектор<ArrowRight className="ml-auto" size={18} /></button>}
      {snapshot?.status === "ACTIVE" && <button className="flex items-center gap-2 text-sm font-semibold text-[#087cff]" type="button" onClick={() => router.push("/interfaces/tenders-admin")}>Управлять тендерами <ArrowRight size={18} /></button>}
      {snapshot?.status === "WAITING" && <div><button className="flex h-12 w-full items-center justify-center gap-2 rounded-[7px] bg-[#087cff] font-bold text-white disabled:opacity-50" type="button" disabled={busy || missingStations > 0 || qualifiedTeams < 2} onClick={() => void change("/admin/start")}><Play size={18} />Начать матч</button>{qualifiedTeams < 2 && <p className="mt-2 text-center text-xs text-[#6179a4]">Для старта нужны 2 команды минимум по 2 игрока</p>}</div>}
      {snapshot?.status === "ACTIVE" && <button className="text-sm font-semibold text-rose-600" type="button" onClick={() => { if (confirm("Завершить текущую сессию?")) void change("/admin/finish"); }}>Завершить сессию</button>}
      {snapshot?.status === "FINISHED" && <button className="flex h-12 w-full items-center justify-center gap-2 rounded-[7px] bg-[#087cff] font-bold text-white" type="button" onClick={() => { clearAccess(); router.replace("/admin/login"); }}>Создать новую сессию <ArrowRight size={18} /></button>}
    </div></div></main>;
}

export function StationScreen({ type }: { type: string }) {
  const router = useRouter();
  const { snapshot, error, clockOffset } = useLobby("STAFF");
  const clock = useMatchClock(snapshot, clockOffset);
  useEffect(() => {
    if (!getAccess()) router.replace("/admin/login");
    else if (snapshot?.stationType && snapshot.stationType.toLowerCase() !== type) router.replace(`/admin/station/${snapshot.stationType.toLowerCase()}`);
  }, [snapshot, type, router, error]);
  if (snapshot?.status === "FINISHED") return <MatchResults snapshot={snapshot} />;
  return <main className="min-h-svh bg-[#f5fbff] text-[#071632]"><div className="mx-auto min-h-svh max-w-[430px] bg-white"><Header caption="Администратор структуры" /><div className="space-y-5 px-5 py-8"><h1 className="text-2xl font-extrabold">{labels[snapshot?.stationType ?? type.toUpperCase()] ?? "Структура"}</h1><ErrorText value={error} /><p className="text-[#6179a4]">{snapshot?.status === "ACTIVE" ? `Квартал ${clock?.quarter ?? snapshot.currentQuarter} · ${clock?.text ?? "00:00"}` : "Ожидание старта матча"}</p>{snapshot?.status === "ACTIVE" && (type === "atm" || type === "bank") && <button type="button" className="flex items-center gap-2 font-bold text-[#087cff]" onClick={() => router.push("/interfaces/atm")}>Открыть банкомат <ArrowRight size={18} /></button>}{snapshot?.status === "ACTIVE" && type === "bank" && <button type="button" className="flex items-center gap-2 font-bold text-[#087cff]" onClick={() => router.push("/interfaces/bank")}>Открыть банк <ArrowRight size={18} /></button>}{snapshot?.status === "ACTIVE" && type === "construction" && <button type="button" className="flex items-center gap-2 font-bold text-[#087cff]" onClick={() => router.push("/interfaces/construction")}>Открыть строительство <ArrowRight size={18} /></button>}{snapshot?.status === "ACTIVE" && type === "enterprises" && <button type="button" className="flex items-center gap-2 font-bold text-[#087cff]" onClick={() => router.push("/interfaces/tenders-admin")}>Открыть тендеры <ArrowRight size={18} /></button>}{snapshot?.status === "ACTIVE" && type === "patent_office" && <button type="button" className="flex items-center gap-2 font-bold text-[#087cff]" onClick={() => router.push("/interfaces/patents")}>Открыть Науку <ArrowRight size={18} /></button>}{snapshot?.status === "ACTIVE" && type === "medicine" && <button type="button" className="flex items-center gap-2 font-bold text-[#087cff]" onClick={() => router.push("/interfaces/medicine")}>Открыть Медицину <ArrowRight size={18} /></button>}{snapshot?.status === "ACTIVE" && type === "mayor" && <button type="button" className="flex items-center gap-2 font-bold text-[#087cff]" onClick={() => router.push("/interfaces/mayor")}>Открыть панель мэра <ArrowRight size={18} /></button>}</div></div></main>;
}

export function PlayerGame() {
  return <PlayerHome />;
}
