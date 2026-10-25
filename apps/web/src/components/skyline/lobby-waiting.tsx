"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { BookOpen, Building2, ChevronLeft, ChevronRight, Clock3, Coins, DoorOpen, Lightbulb, UsersRound, X } from "lucide-react";
import { LobbyBrand } from "./lobby-brand";
import { api, clearAccess, getAccess, useLobby } from "../../lib/lobby-client";
import "./lobby-entry.css";
import "./lobby-waiting.css";

export type LobbyParticipant = { id: string; name: string };
type LobbyWaitingProps = { participants?: LobbyParticipant[]; isGameStarting?: boolean; onIntroComplete?: () => void };

const rules = [
  { title: "Соберите команду", lead: "Вместе принимайте решения и следите за ходом партии.", icon: UsersRound },
  { title: "Развивайте город", lead: "Исследуйте структуры, обсуждайте возможности и выбирайте следующий шаг.", icon: Building2 },
  { title: "Управляйте ресурсами", lead: "Сверяйте баланс и планируйте действия всей командой.", icon: Coins },
];

function initials(name: string) {
  if (name === "Вы") return "Я";
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function LobbyParticipants({ participants, color }: { participants: LobbyParticipant[]; color: string }) {
  return <div className="waiting-participants" aria-label={`Участников: ${participants.length}`}>
    <div className="waiting-participants-copy"><UsersRound size={17} aria-hidden="true" /><span>Команда</span><strong>{participants.length}</strong></div>
    <div className="waiting-participants-avatars">
      {participants.slice(0, 4).map((participant, index) => <span className="waiting-participant-avatar" key={participant.id} title={participant.name} aria-label={participant.name} style={{ "--avatar-color": color, "--avatar-index": index } as CSSProperties}>{initials(participant.name)}</span>)}
      {participants.length > 4 && <span className="waiting-participant-more">+{participants.length - 4}</span>}
    </div>
    <span className="waiting-participants-names" aria-label="Имена игроков">{participants.map((person) => person.name).join(" · ")}</span>
  </div>;
}

function LobbyRules({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState(0);
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setPage((current) => Math.max(0, current - 1));
      if (event.key === "ArrowRight") setPage((current) => Math.min(rules.length - 1, current + 1));
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);
  const rule = rules[page];
  const Icon = rule.icon;
  return <div className="waiting-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="waiting-rules-dialog" role="dialog" aria-modal="true" aria-labelledby="waiting-rules-title">
      <div className="waiting-dialog-top"><span>ПРАВИЛА ИГРЫ</span><button ref={closeRef} type="button" onClick={onClose} aria-label="Закрыть правила" title="Закрыть"><X size={20} /></button></div>
      <div className="waiting-rule-art" key={page} aria-hidden="true">
        <span className="waiting-rule-art-orbit waiting-rule-art-orbit-one" /><span className="waiting-rule-art-orbit waiting-rule-art-orbit-two" />
        <div className="waiting-rule-art-main"><Icon size={54} strokeWidth={1.7} /></div>
        <div className="waiting-rule-art-node waiting-rule-art-node-left">{page === 0 ? <UsersRound /> : page === 1 ? <Building2 /> : <Coins />}</div>
        <div className="waiting-rule-art-node waiting-rule-art-node-right">{page === 0 ? <Lightbulb /> : page === 1 ? <Lightbulb /> : <Building2 />}</div>
        <span className="waiting-rule-art-line waiting-rule-art-line-left" /><span className="waiting-rule-art-line waiting-rule-art-line-right" />
      </div>
      <div className="waiting-rule-content"><span className="waiting-rule-count">0{page + 1} / 0{rules.length}</span><h2 id="waiting-rules-title">{rule.title}</h2><p>{rule.lead}</p></div>
      <div className="waiting-rule-nav"><button type="button" onClick={() => setPage((current) => current - 1)} disabled={page === 0} aria-label="Предыдущее правило" title="Назад"><ChevronLeft /></button><div className="waiting-rule-dots" aria-label={`Страница ${page + 1} из ${rules.length}`}>{rules.map((item, index) => <span key={item.title} className={index === page ? "is-active" : ""} />)}</div><button type="button" onClick={() => setPage((current) => current + 1)} disabled={page === rules.length - 1} aria-label="Следующее правило" title="Далее"><ChevronRight /></button></div>
    </section>
  </div>;
}

export function LobbyWaiting({ participants: participantsProp, isGameStarting: startingProp, onIntroComplete }: LobbyWaitingProps) {
  const router = useRouter();
  const { snapshot, error, loading } = useLobby("PLAYER");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [joinNotice, setJoinNotice] = useState(false);
  const previousCount = useRef<number | null>(null);
  const initialParticipantLoad = useRef(true);
  const introFired = useRef(false);
  const team = snapshot?.teams.find((item) => item.id === snapshot.teamId);
  const participants = participantsProp ?? team?.participants?.map((person) => ({ id: person.id, name: person.displayName })) ?? [];
  const isGameStarting = startingProp ?? snapshot?.status === "ACTIVE";

  useEffect(() => {
    if (loading) return;
    if (!getAccess() || snapshot?.disqualified) router.replace("/interfaces/lobby/entry");
    else if (snapshot?.status === "FINISHED") { clearAccess(); router.replace("/interfaces/lobby/entry"); }
    else if (snapshot && !snapshot.teamId) router.replace(snapshot.status === "ACTIVE" ? "/interfaces/lobby/join-team" : "/interfaces/lobby/choice");
  }, [loading, router, snapshot]);

  useEffect(() => {
    if (initialParticipantLoad.current) {
      initialParticipantLoad.current = false;
      previousCount.current ??= participants.length;
      return;
    }
    if (previousCount.current !== null && participants.length > previousCount.current) setJoinNotice(true);
    previousCount.current = participants.length;
  }, [participants.length]);
  useEffect(() => {
    if (!joinNotice) return;
    const timeout = window.setTimeout(() => setJoinNotice(false), 3000);
    return () => window.clearTimeout(timeout);
  }, [joinNotice]);
  useEffect(() => {
    if (!isGameStarting) { introFired.current = false; return; }
    if (introFired.current) return;
    const timeout = window.setTimeout(() => {
      introFired.current = true;
      onIntroComplete?.();
      if (startingProp === undefined) router.replace("/interfaces/lobby/game");
    }, 1850);
    return () => window.clearTimeout(timeout);
  }, [isGameStarting, onIntroComplete, startingProp, router]);

  async function leaveTeam() {
    const access = getAccess(); if (!access) return;
    try { await api("/lobby/leave-team", { method: "POST", token: access.token }); router.push("/interfaces/lobby/choice"); }
    catch { setLeaveOpen(false); }
  }

  const avatarStyle: CSSProperties = {
    borderColor: team?.color ?? "#087cff",
    backgroundImage: "url('/generated/team-avatars-sprite.png')",
    backgroundPosition: `${(team?.avatar ?? 0) % 5 * 25}% ${Math.floor((team?.avatar ?? 0) / 5) * (100 / 3)}%`,
  };

  return <main className={`entry-gate waiting-page ${isGameStarting ? "waiting-is-starting" : ""}`}>
    <div className="entry-gate-surface waiting-surface">
      <header className="entry-gate-header waiting-header"><LobbyBrand /><div className="waiting-header-actions"><button type="button" onClick={() => setRulesOpen(true)} aria-label="Правила игры" title="Правила игры"><BookOpen size={19} /></button><button type="button" onClick={() => setLeaveOpen(true)} aria-label="Покинуть команду" title="Покинуть команду"><DoorOpen size={19} /></button></div></header>
      <section className="waiting-body">
        <div className="waiting-heading">
          <span className="waiting-status"><span className="waiting-connection-dot" aria-hidden="true" />Команда в лобби</span>
          <h1>Ожидаем старта<span className="waiting-animated-dots" aria-label="..."><i>.</i><i>.</i><i>.</i></span></h1>
          <p className="waiting-heading-subtitle">Организатор готовит игровую сессию</p>
          <div className="waiting-team-line"><span className="waiting-team-avatar" role="img" aria-label="Аватар команды" style={avatarStyle} /><strong>{team?.name ?? "Подключение..."}</strong></div>
        </div>
        <div className="waiting-visual"><Image src="/generated/waiting-headquarters.png" alt="Штаб команды в городе" width={1280} height={1280} priority /></div>
        <div className="waiting-bottom"><LobbyParticipants participants={participants} color={team?.color ?? "#087cff"} /><p className="waiting-organizer-status"><Clock3 size={15} aria-hidden="true" />{error || "Ожидаем запуска организатором"}</p></div>
      </section>
      {isGameStarting && <div className="waiting-start-overlay" role="status"><span className="waiting-start-line">Игра начинается</span><strong>Квартал 1</strong></div>}
      {joinNotice && !isGameStarting && <div className="waiting-join-notice" role="status"><UsersRound size={16} />Новый игрок присоединился</div>}
      {rulesOpen && <LobbyRules onClose={() => setRulesOpen(false)} />}
      {leaveOpen && <div className="waiting-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLeaveOpen(false); }}><section className="waiting-leave-dialog" role="dialog" aria-modal="true" aria-labelledby="waiting-leave-title"><h2 id="waiting-leave-title">Покинуть команду?</h2><p>Вы вернётесь к выбору команды.</p><div><button type="button" onClick={() => setLeaveOpen(false)}>Остаться</button><button type="button" onClick={leaveTeam}>Покинуть</button></div></section></div>}
    </div>
  </main>;
}
