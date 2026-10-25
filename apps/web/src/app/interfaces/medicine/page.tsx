"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Archive, CalendarClock, Check, CirclePlay, ClipboardPenLine, Clock3, Plus, Search, Square, Stethoscope, Users } from "lucide-react";
import { AtmScaleFrame } from "../../../components/skyline/atm-scale-frame";
import { LobbyBrand } from "../../../components/skyline/lobby-brand";
import { api, getAccess, useLobby, useMatchClock } from "../../../lib/lobby-client";
import { MatchResults } from "../../../components/skyline/match-results";
import "./medicine.css";

type EventStatus = "draft" | "active" | "finished";
type MedicalEvent = {
  id: string;
  title: string;
  duration: number;
  teamIds: string[];
  status: EventStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
};

const demoTeams = [
  { id: "alpha", name: "Команда Альфа" },
  { id: "beta", name: "Команда Бета" },
  { id: "gamma", name: "Команда Гамма" },
  { id: "delta", name: "Команда Дельта" },
  { id: "epsilon", name: "Команда Эпсилон" },
  { id: "zeta", name: "Команда Зета" },
  { id: "eta", name: "Команда Эта" },
  { id: "theta", name: "Команда Тета" },
];

function timeLabel(value?: string) {
  if (!value) return "";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function teamLabel(ids: string[], teams: { id: string; name: string }[]) {
  return ids.map((id) => teams.find((team) => team.id === id)?.name.replace("Команда ", "")).filter(Boolean).join(", ");
}

export default function MedicineInterfacePage() {
  const { snapshot, clockOffset } = useLobby("STAFF");
  const clock = useMatchClock(snapshot, clockOffset);
  const live = snapshot?.stationType === "MEDICINE";
  const teams = live ? snapshot.teams.map((team) => ({ id: team.id, name: team.name })) : demoTeams;
  const [events, setEvents] = useState<MedicalEvent[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!live) return;
    const access = getAccess();
    if (access) void api<MedicalEvent[]>("/medicine/events", { token: access.token }).then(setEvents).catch((error) => setNotice(error.message));
  }, [live, snapshot?.sequence]);

  const selected = events.find((event) => event.id === selectedId);
  const active = useMemo(() => events.filter((event) => event.status === "active" || event.status === "draft"), [events]);
  const history = useMemo(() => events.filter((event) => event.status === "finished"), [events]);
  const visibleActive = active.filter((event) => `${event.title} ${teamLabel(event.teamIds, teams)}`.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru")));
  const canStart = selected?.status === "draft" && selected.title.trim().length >= 3 && selected.teamIds.length > 0 && Number.isInteger(selected.duration) && selected.duration >= 1 && selected.duration <= 20;

  async function createEvent() {
    if (busy) return;
    if (live) {
      const access = getAccess();
      if (!access) return;
      pending.current ??= crypto.randomUUID();
      setBusy(true);
      try {
        const updated = await api<MedicalEvent[]>("/medicine/events", { method: "POST", token: access.token, body: { idempotencyKey: pending.current } });
        setEvents(updated);
        setSelectedId(updated[0].id);
        setEditing(true);
        setNotice("");
        pending.current = null;
        requestAnimationFrame(() => titleRef.current?.focus());
      } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось создать событие"); }
      finally { setBusy(false); }
      return;
    }
    const event: MedicalEvent = { id: crypto.randomUUID(), title: "", duration: 1, teamIds: [], status: "draft", createdAt: new Date().toISOString() };
    setEvents((current) => [event, ...current]);
    setSelectedId(event.id);
    setEditing(true);
    setNotice("");
    requestAnimationFrame(() => titleRef.current?.focus());
  }

  function updateEvent(patch: Partial<MedicalEvent>) {
    if (!selected || selected.status !== "draft") return;
    setEvents((current) => current.map((event) => event.id === selected.id ? { ...event, ...patch } : event));
    setNotice("");
  }

  function selectEvent(event: MedicalEvent) {
    setSelectedId(event.id);
    setEditing(false);
    setNotice("");
  }

  async function saveParameters() {
    if (!live || !selected || selected.status !== "draft" || busy) return;
    const access = getAccess();
    if (!access) return;
    setBusy(true);
    try {
      setEvents(await api<MedicalEvent[]>(`/medicine/events/${selected.id}`, { method: "PATCH", token: access.token, body: { title: selected.title, duration: selected.duration, teamIds: selected.teamIds } }));
      setNotice("Параметры сохранены");
    } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось сохранить параметры"); }
    finally { setBusy(false); }
  }

  async function startEvent() {
    if (!canStart || !selected || busy) return;
    if (live) {
      const access = getAccess();
      if (!access) return;
      setBusy(true);
      try {
        await api<MedicalEvent[]>(`/medicine/events/${selected.id}`, { method: "PATCH", token: access.token, body: { title: selected.title, duration: selected.duration, teamIds: selected.teamIds } });
        setEvents(await api<MedicalEvent[]>(`/medicine/events/${selected.id}/start`, { method: "POST", token: access.token }));
        setEditing(false);
        setNotice("Событие запущено");
      } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось запустить событие"); }
      finally { setBusy(false); }
      return;
    }
    setEvents((current) => current.map((event) => event.id === selected.id ? { ...event, title: event.title.trim(), status: "active", startedAt: new Date().toISOString() } : event));
    setEditing(false);
    setNotice("Событие запущено");
  }

  async function finishEvent() {
    if (selected?.status !== "active" || busy) return;
    if (live) {
      const access = getAccess();
      if (!access) return;
      setBusy(true);
      try {
        setEvents(await api<MedicalEvent[]>(`/medicine/events/${selected.id}/finish`, { method: "POST", token: access.token }));
        setNotice("Событие завершено");
      } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось завершить событие"); }
      finally { setBusy(false); }
      return;
    }
    setEvents((current) => current.map((event) => event.id === selected.id ? { ...event, status: "finished", finishedAt: new Date().toISOString() } : event));
    setNotice("Событие завершено");
  }

  if (snapshot?.status === "FINISHED") return <MatchResults snapshot={snapshot} />;
  return <main className="medicine-page">
    <AtmScaleFrame mobileFluid>
      <header className="medicine-header">
        <div className="medicine-brand"><LobbyBrand /></div>
        <div className="medicine-header-divider" />
        <div className="medicine-header-title"><h1>Медицина</h1><span>Медицинские события</span></div>
        <div className="medicine-clock"><span>Квартал {live ? snapshot.currentQuarter : 2}</span><strong>{live ? clock?.text ?? "00:00" : "02:14"}</strong></div>
      </header>

      <div className="medicine-layout">
        <aside className="medicine-panel medicine-events" aria-label="Активные медицинские события">
          <div className="medicine-panel-heading"><div><h2>События</h2><span>{active.filter((event) => event.status === "active").length} активных</span></div><Stethoscope size={32} /></div>
          <label className="medicine-search"><Search size={24} /><input aria-label="Поиск события или команды" placeholder="Поиск события или команды" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <div className="medicine-event-list">
            {visibleActive.map((event) => <button type="button" key={event.id} className={`medicine-event-row ${selectedId === event.id ? "is-selected" : ""}`} onClick={() => selectEvent(event)}>
              <span className={`medicine-event-icon ${event.status === "draft" ? "is-draft" : ""}`}>{event.status === "draft" ? <ClipboardPenLine size={30} /> : <Stethoscope size={30} />}</span>
              <span className="medicine-event-copy"><strong>{event.title || "Новое событие"}</strong><small>{event.status === "draft" ? "Черновик" : `${event.duration} кв. · ${event.teamIds.length} команд`}</small></span>
              <span className={`medicine-status-dot ${event.status}`} />
            </button>)}
            {!visibleActive.length && <div className="medicine-empty-list"><Stethoscope size={38} /><strong>{search ? "Ничего не найдено" : "Активных событий нет"}</strong><span>{search ? "Измените запрос" : "Создайте событие, чтобы начать работу"}</span></div>}
          </div>
        </aside>

        <section className="medicine-panel medicine-workspace" aria-label="Параметры медицинского события">
          <div className="medicine-toolbar">
            <button type="button" className="is-primary" onClick={createEvent} disabled={busy}><Plus size={22} />Создать событие</button>
            <button type="button" onClick={() => { setEditing(true); requestAnimationFrame(() => titleRef.current?.focus()); }} disabled={selected?.status !== "draft"}><ClipboardPenLine size={21} />Указать параметры</button>
            <button type="button" onClick={startEvent} disabled={!canStart || busy}><CirclePlay size={21} />Запустить</button>
            <button type="button" onClick={finishEvent} disabled={selected?.status !== "active" || busy}><Square size={19} />Завершить</button>
          </div>

          {selected ? <div className="medicine-detail">
            <div className="medicine-detail-heading"><img src="/generated/structure-medicine.png" alt="" /><div><span className={`medicine-detail-status ${selected.status}`}>{selected.status === "draft" ? "Черновик" : selected.status === "active" ? "Активно" : "Завершено"}</span><h2>{selected.title || "Новое событие"}</h2><small>Создано {timeLabel(selected.createdAt)}</small></div></div>
            {notice && <div className="medicine-notice" role="status"><Check size={20} />{notice}</div>}
            {editing && selected.status === "draft" ? <div className="medicine-form">
              <label className="medicine-field"><span>Название события</span><input ref={titleRef} value={selected.title} maxLength={80} placeholder="Введите название" onChange={(event) => updateEvent({ title: event.target.value })} /></label>
              <label className="medicine-field"><span>Продолжительность, кварталы</span><input type="number" min="1" max="20" step="1" value={selected.duration} onChange={(event) => updateEvent({ duration: Number(event.target.value) })} /></label>
              <div className="medicine-team-picker"><div><strong>Затронутые команды</strong><span>{selected.teamIds.length} выбрано</span></div><div className="medicine-team-grid">{teams.map((team) => <label key={team.id} className={selected.teamIds.includes(team.id) ? "is-checked" : ""}><input type="checkbox" checked={selected.teamIds.includes(team.id)} onChange={() => updateEvent({ teamIds: selected.teamIds.includes(team.id) ? selected.teamIds.filter((id) => id !== team.id) : [...selected.teamIds, team.id] })} /><span>{team.name}</span></label>)}</div></div>
              {live && <button type="button" onClick={saveParameters} disabled={busy}>Сохранить параметры</button>}
            </div> : <div className="medicine-summary"><div><CalendarClock size={28} /><span>Продолжительность</span><strong>{selected.duration} кв.</strong></div><div><Users size={28} /><span>Затронутые команды</span><strong>{selected.teamIds.length}</strong></div><div><Clock3 size={28} /><span>{selected.status === "finished" ? "Завершено" : selected.status === "active" ? "Запущено" : "Создано"}</span><strong>{timeLabel(selected.finishedAt ?? selected.startedAt ?? selected.createdAt)}</strong></div></div>}
            {!(editing && selected.status === "draft") && <div className="medicine-affected"><h3>Команды</h3><p>{selected.teamIds.length ? teamLabel(selected.teamIds, teams) : "Не выбраны"}</p></div>}
            <div className="medicine-rules"><h3>Последствия</h3><p>Правила последствий для медицинских событий ещё не заданы. Изменения баланса и ресурсов не применяются.</p></div>
          </div> : <div className="medicine-blank"><img src="/generated/structure-medicine.png" alt="" /><h2>Медицинские события</h2><p>Выберите событие из списка или создайте новое.</p></div>}
        </section>

        <aside className="medicine-panel medicine-history" aria-label="История медицинских событий">
          <div className="medicine-panel-heading"><div><h2>История</h2><span>{history.length} завершено</span></div><Archive size={31} /></div>
          <div className="medicine-history-list">{history.map((event) => <button type="button" key={event.id} className={`medicine-history-row ${selectedId === event.id ? "is-selected" : ""}`} onClick={() => selectEvent(event)}><strong>{event.title}</strong><span>{teamLabel(event.teamIds, teams)}</span><small>{timeLabel(event.finishedAt)} · {event.duration} кв.</small></button>)}{!history.length && <div className="medicine-empty-list"><Archive size={38} /><strong>История пуста</strong><span>Завершённые события появятся здесь</span></div>}</div>
        </aside>
      </div>
    </AtmScaleFrame>
  </main>;
}
