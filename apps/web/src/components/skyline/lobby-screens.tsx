"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import {
  AlertCircle, ArrowRight, Check, ChevronRight, Copy, KeyRound,
  Palette, Plus, UserRoundPlus,
} from "lucide-react";
import { LobbyEntry } from "./lobby-entry";
import { LobbyBrand } from "./lobby-brand";
import { LobbyChoice } from "./lobby-choice";
import { LobbyWaiting } from "./lobby-waiting";
import { api, getAccess, useLobby } from "../../lib/lobby-client";
import "./lobby.css";

type Screen = "hub" | "entry" | "choice" | "create-team" | "join-team" | "waiting" | "staff-login" | "error";
const swatches = ["#087cff", "#8957f2", "#ef3c8f", "#ff970c"];
const avatarNames = [
  "Неоновая лама", "Кибер-лис", "Робот-башня", "Облачный кот", "Диско-кактус",
  "Кристальная черепаха", "Пончик-дракон", "Осьминог", "Кибер-банан", "Конус-маг",
  "Рыцарь-банка", "Лунный баран", "Такси-краб", "Суши-акула", "Электро-сова",
  "Желейный куб", "Королевский гриб", "Скрепка-инопланетянин", "Скайлайн-город", "Запасной герой",
];

function ScenicBrand() {
  return <div className="lobby-brand lobby-brand-scenic flex items-center gap-3" aria-label="SKYLINE">
    <Image className="lobby-brand-mark" src="/generated/lobby-logo-mark-v2.png" alt="" width={78} height={117} priority />
    <span className="text-[26px] font-black leading-none text-[#05072c]">SKYLINE</span>
    <small>Большой предпринимательский турнир</small>
  </div>;
}

function Shell({ children, title, subtitle, className = "", scenic = false }: {
  children: ReactNode; title: string; subtitle?: string; className?: string; scenic?: boolean;
}) {
  return <main className={`min-h-svh ${scenic ? "bg-[#061b3d] text-white" : "bg-[#f5fbff] text-[#05072c]"}`}>
    <div className={`lobby-shell relative mx-auto flex min-h-svh w-full max-w-[430px] flex-col overflow-hidden px-4 ${scenic ? "lobby-scenic" : ""} ${className}`}>
      {scenic && <div className="lobby-scenery pointer-events-none absolute inset-0" aria-hidden="true" />}
      <header className="lobby-header relative z-10 flex shrink-0 items-center justify-between border-b border-[#d8e7f5] bg-white px-4">
        {scenic ? <ScenicBrand /> : <LobbyBrand />}{!scenic && <span className="text-[13px] font-semibold text-[#4b5fba]">Лобби</span>}
      </header>
      <div className="lobby-content relative z-10 flex min-h-0 flex-1 flex-col">
        <div className="lobby-heading shrink-0">
          <h1 className="text-[25px] font-black leading-[1.12]">{title}</h1>
          {subtitle && <p className="mt-1 text-[14px] leading-[1.3] text-[#4b5fba]">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  </main>;
}

function Panel({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return <section className={`rounded-[8px] border border-[#d8e7f5] bg-white p-4 ${className}`} style={style}>{children}</section>;
}

function Button({ children, onClick, type = "button", disabled = false, tone = "blue", icon = true, className = "" }: {
  children: ReactNode; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean;
  tone?: "blue" | "teal"; icon?: boolean; className?: string;
}) {
  return <button
    className={`lobby-button flex h-[50px] w-full cursor-pointer items-center justify-center gap-2 rounded-[8px] px-4 text-[17px] font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 ${tone === "blue" ? "bg-[#087cff] text-white shadow-[0_10px_22px_rgba(8,124,255,0.18)] hover:bg-[#006be6]" : "border border-[#91e0d9] bg-[#f1fffd] text-[#079b8c] hover:bg-[#e2fbf7]"} ${className}`}
    onClick={onClick} type={type} disabled={disabled}
  >{children}{icon && <ArrowRight className="size-5" strokeWidth={2.4} />}</button>;
}

function Avatar({ index, selected = false }: { index: number; selected?: boolean }) {
  const column = index % 5;
  const row = Math.floor(index / 5);
  return <span
    className={`block aspect-square w-full rounded-[7px] bg-[#eef6ff] bg-no-repeat transition-transform ${selected ? "scale-[1.03] ring-[3px] ring-[#087cff]" : "group-hover:scale-[1.06]"}`}
    style={{ backgroundImage: "url('/generated/team-avatars-sprite.png')", backgroundSize: "500% 400%", backgroundPosition: `${column * 25}% ${row * (100 / 3)}%` }}
    role="img" aria-label={avatarNames[index]}
  />;
}

function Tabs({ active, canCreate = true }: { active: "create" | "join"; canCreate?: boolean }) {
  return <nav className={`lobby-tabs grid shrink-0 gap-1 rounded-[8px] border border-[#d8e7f5] bg-white p-1 ${canCreate ? "grid-cols-2" : "grid-cols-1"}`} aria-label="Настройка команды">
    {canCreate && <Link className={`flex h-[40px] items-center justify-center gap-1.5 rounded-[6px] text-[14px] font-bold transition ${active === "create" ? "bg-[#087cff] text-white" : "text-[#4b5fba] hover:bg-[#eef6ff]"}`} href="/interfaces/lobby/create-team"><Plus className="size-4" /> Создать</Link>}
    <Link className={`flex h-[40px] items-center justify-center gap-1.5 rounded-[6px] text-[14px] font-bold transition ${active === "join" ? "bg-[#087cff] text-white" : "text-[#4b5fba] hover:bg-[#eef6ff]"}`} href="/interfaces/lobby/join-team"><UserRoundPlus className="size-4" /> Присоединиться</Link>
  </nav>;
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <span className="lobby-field-label mb-1.5 block text-[13px] font-semibold text-[#4b5fba]">{children}</span>;
}

function TextInput({ value, onChange, placeholder, inputMode, maxLength, icon }: {
  value: string; onChange: (value: string) => void; placeholder?: string; inputMode?: "numeric" | "text";
  maxLength?: number; icon?: ReactNode;
}) {
  return <div className="lobby-text-input flex h-[46px] items-center gap-2 rounded-[7px] border border-[#b7c9ee] bg-white px-3 focus-within:border-[#087cff] focus-within:ring-[3px] focus-within:ring-[#087cff]/10">
    <input className="min-w-0 flex-1 bg-transparent text-[17px] font-bold outline-none placeholder:text-[#9aacc8]" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} inputMode={inputMode} maxLength={maxLength} />
    <span className="text-[#5267c2]">{icon}</span>
  </div>;
}

function EntryScreen() {
  return <LobbyEntry />;
}

function ChoiceScreen() {
  return <LobbyChoice />;
}

function CreateTeamScreen() {
  const router = useRouter();
  const { snapshot, error: connectionError } = useLobby("PLAYER");
  const [name, setName] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [color, setColor] = useState(swatches[0]);
  const [avatar, setAvatar] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => { if (snapshot?.status === "FINISHED") router.replace("/interfaces/lobby/game"); else if (snapshot?.status === "ACTIVE") router.replace(snapshot.teamId ? "/interfaces/lobby/game" : "/interfaces/lobby/join-team"); else if (snapshot?.teamId) router.replace("/interfaces/lobby/waiting"); }, [snapshot, router]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) { setError("Введите название команды"); return; }
    if (!playerName.trim()) { setError("Введите своё имя"); return; }
    const access = getAccess(); if (!access) { setError("Сначала войдите в сессию"); return; }
    try {
      await api("/lobby/teams", { method: "POST", token: access.token, body: { name: name.trim(), color, avatar, playerName: playerName.trim() } });
      router.push("/interfaces/lobby/waiting");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Команду не удалось создать"); }
  }
  return <Shell title="Настройка команды" className="lobby-dense">
    <Tabs active="create" />
    <form className="lobby-form mt-2 flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <Panel className={`lobby-form-panel ${error ? "lobby-shake border-rose-400" : ""}`}>
        <label><FieldLabel>Название команды</FieldLabel><TextInput value={name} onChange={(value) => { setName(value); setError(""); }} maxLength={25} placeholder="Название команды" /></label>
        <label className="mt-3 block"><FieldLabel>Ваше имя</FieldLabel><TextInput value={playerName} onChange={(value) => { setPlayerName(value); setError(""); }} maxLength={32} placeholder="Как вас зовут?" /></label>
        {(error || connectionError) && <p className="mt-1 text-[12px] text-rose-600">{error || connectionError}</p>}
        <div className="lobby-field-gap"><FieldLabel>Цвет команды</FieldLabel><div className="flex items-center gap-3">
          {swatches.map((item) => <button key={item} className={`lobby-swatch size-9 cursor-pointer rounded-full transition hover:scale-110 ${color.toLowerCase() === item ? "ring-[3px] ring-[#087cff] ring-offset-[3px]" : ""}`} style={{ backgroundColor: item }} type="button" aria-label={`Выбрать цвет ${item}`} aria-pressed={color.toLowerCase() === item} onClick={() => setColor(item)} />)}
          <label className={`relative grid size-9 cursor-pointer place-items-center rounded-full border border-[#b7c9ee] bg-[#eef6ff] text-[#4b5fba] ${!swatches.includes(color.toLowerCase()) ? "ring-[3px] ring-[#087cff] ring-offset-[3px]" : ""}`} title="Свой цвет"><Palette className="size-[18px]" /><input className="absolute inset-0 size-full cursor-pointer opacity-0" type="color" value={color} onChange={(event) => setColor(event.target.value)} aria-label="Выбрать произвольный цвет" /></label>
        </div></div>
        <div className="lobby-field-gap"><FieldLabel>Аватар команды</FieldLabel><div className="grid grid-cols-5 gap-2">
          {avatarNames.map((label, index) => <button key={label} className="group min-w-0 cursor-pointer rounded-[7px] focus-visible:outline-2 focus-visible:outline-[#087cff]" type="button" title={label} aria-label={label} aria-pressed={avatar === index} onClick={() => setAvatar(index)}><Avatar index={index} selected={avatar === index} /></button>)}
        </div></div>
      </Panel>
      <Button className="lobby-submit mt-2 shrink-0" type="submit">Создать команду</Button>
    </form>
  </Shell>;
}

function JoinTeamScreen() {
  const router = useRouter();
  const { snapshot, error: connectionError } = useLobby("PLAYER");
  const teams = snapshot?.teams ?? [];
  const [code, setCode] = useState("");
  const [playerName, setPlayerName] = useState("");
  const [selected, setSelected] = useState(-1);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (snapshot?.status === "FINISHED") router.replace("/interfaces/lobby/game"); else if (snapshot?.teamId) router.replace(snapshot.status === "ACTIVE" ? "/interfaces/lobby/game" : "/interfaces/lobby/waiting"); }, [snapshot, router]);
  function choose(index: number) { setSelected(index); setCode(teams[index].code); setError(""); }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const team = teams.find((item) => item.code === code.trim().toUpperCase());
    if (!team) { setError("Команда с таким кодом не найдена"); return; }
    if (!playerName.trim()) { setError("Введите своё имя"); return; }
    const access = getAccess(); if (!access) { setError("Сначала войдите в сессию"); return; }
    try { await api(`/lobby/teams/${team.id}/join`, { method: "POST", token: access.token, body: { playerName: playerName.trim() } }); router.push("/interfaces/lobby/waiting"); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось присоединиться"); }
  }
  async function copyCode() {
    try { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1500); } catch { setCopied(false); }
  }
  return <Shell title="Настройка команды" className="lobby-dense">
    <Tabs active="join" canCreate={snapshot?.status !== "ACTIVE"} />
    <form className="lobby-form mt-2 flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <Panel className={`lobby-form-panel ${error ? "lobby-shake border-rose-400" : ""}`}>
        <label className="mb-3 block"><FieldLabel>Ваше имя</FieldLabel><TextInput value={playerName} onChange={(value) => { setPlayerName(value); setError(""); }} maxLength={32} placeholder="Как вас зовут?" /></label>
        <FieldLabel>Код команды</FieldLabel>
        <div className="flex h-[46px] items-center rounded-[7px] border border-[#b7c9ee] bg-white focus-within:border-[#087cff]">
          <input className="min-w-0 flex-1 bg-transparent px-3 text-[17px] font-bold uppercase outline-none" value={code} maxLength={8} onChange={(event) => { setCode(event.target.value.toUpperCase()); setSelected(-1); setError(""); }} aria-label="Код команды" />
          <button className="grid h-full w-11 cursor-pointer place-items-center text-[#5267c2] transition hover:bg-[#eef6ff]" type="button" title="Копировать код" aria-label="Копировать код" onClick={copyCode}>{copied ? <Check className="size-5" /> : <Copy className="size-5" />}</button>
        </div>
        {(error || connectionError) && <p className="mt-1 text-[12px] text-rose-600">{error || connectionError}</p>}
        <div className="lobby-divider my-3 flex items-center gap-3 text-[12px] text-[#7186b4]"><span className="h-px flex-1 bg-[#d8e7f5]" />или<span className="h-px flex-1 bg-[#d8e7f5]" /></div>
        <FieldLabel>Доступные команды</FieldLabel>
        <div className="grid gap-2">{teams.map((team, index) => <button key={team.code} className={`lobby-team flex h-[58px] w-full cursor-pointer items-center gap-3 rounded-[7px] px-2 text-left transition ${selected === index ? "bg-[#eaf6ff] ring-1 ring-[#087cff]" : "border border-[#d8e7f5] hover:bg-[#eef6ff]"}`} type="button" onClick={() => choose(index)} aria-pressed={selected === index}><span className="w-11 shrink-0"><Avatar index={team.avatar} /></span><span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-bold">{team.name}</span><span className="block truncate text-[12px] text-[#4b5fba]" title={team.participants?.map((person) => person.displayName).join(", ")}>{team.members} участника{team.participants?.length ? ` · ${team.participants.map((person) => person.displayName).join(", ")}` : ""}</span></span><ChevronRight className="size-5 shrink-0 text-[#5267c2]" /></button>)}{!teams.length && <p className="text-center text-sm text-[#6179a4]">Команд пока нет</p>}</div>
      </Panel>
      <Button className="lobby-submit mt-2 shrink-0" type="submit">Присоединиться</Button>
    </form>
  </Shell>;
}

function WaitingScreen() {
  return <LobbyWaiting />;
}

function StaffLoginScreen() {
  const router = useRouter();
  useEffect(() => { router.replace("/admin/login"); }, [router]);
  return <Shell title="Вход администратора" subtitle="Перенаправляем на панель входа"><p className="mt-5 text-sm">Подождите...</p></Shell>;
}

function ErrorScreen() {
  return <Shell title="Код не подошёл" subtitle="Проверьте код и попробуйте ещё раз" scenic><Panel className="mt-5 text-center"><div className="mx-auto grid size-12 place-items-center rounded-full bg-[#fff0f3] text-rose-500"><AlertCircle className="size-7" /></div><p className="mt-3 text-[14px] leading-[1.4] text-[#4b5fba]">Код введён с ошибкой, истёк или был отозван организатором.</p></Panel><Link className="lobby-button mt-3 flex h-[50px] items-center justify-center gap-2 rounded-[8px] bg-[#087cff] text-[17px] font-bold text-white" href="/interfaces/lobby/entry">Ввести код заново <ArrowRight className="size-5" /></Link></Shell>;
}

const navItems = [
  ["Вход по коду", "/interfaces/lobby/entry"], ["Выбор действия", "/interfaces/lobby/choice"],
  ["Создать команду", "/interfaces/lobby/create-team"], ["Присоединиться", "/interfaces/lobby/join-team"],
  ["Ожидание старта", "/interfaces/lobby/waiting"], ["Вход игромастера", "/interfaces/lobby/staff-login"],
  ["Ошибка кода", "/interfaces/lobby/error"],
] as const;

function HubScreen() {
  return <Shell title="Лобби" subtitle="Экраны входа и настройки команды"><Panel className="mt-4 !p-0">{navItems.map(([label, href], index) => <Link key={href} className={`flex h-[53px] items-center gap-3 px-4 text-[14px] font-semibold transition hover:bg-[#eef6ff] ${index > 0 ? "border-t border-[#d8e7f5]" : ""}`} href={href}><KeyRound className="size-4 text-[#087cff]" />{label}<ChevronRight className="ml-auto size-4 text-[#5267c2]" /></Link>)}</Panel></Shell>;
}

export function LobbyScreen({ screen }: { screen: Screen }) {
  switch (screen) {
    case "entry": return <EntryScreen />;
    case "choice": return <ChoiceScreen />;
    case "create-team": return <CreateTeamScreen />;
    case "join-team": return <JoinTeamScreen />;
    case "waiting": return <WaitingScreen />;
    case "staff-login": return <StaffLoginScreen />;
    case "error": return <ErrorScreen />;
    default: return <HubScreen />;
  }
}
