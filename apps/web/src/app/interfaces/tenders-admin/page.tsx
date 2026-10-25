"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clock3, Droplets, House, Layers3, Mountain, Plus, Trees, X, Zap } from "lucide-react";
import { LobbyBrand } from "../../../components/skyline/lobby-brand";
import { api, getAccess, useLobby } from "../../../lib/lobby-client";
import { MatchResults } from "../../../components/skyline/match-results";
import "./tenders-admin.css";

const objects = [
  { code: "HOUSING", name: "Жильё", icon: House },
  { code: "ENERGY", name: "Электростанция", icon: Zap },
  { code: "GAS", name: "Газовый объект", icon: Droplets },
  { code: "METAL", name: "Металлургия", icon: Layers3 },
  { code: "WOOD", name: "Деревообработка", icon: Trees },
  { code: "COAL", name: "Угольный объект", icon: Mountain },
] as const;
const resources = [
  { code: "ENERGY", name: "Энергия", icon: Zap },
  { code: "HOUSING", name: "Жильё", icon: House },
  { code: "GAS", name: "Газ", icon: Droplets },
  { code: "METAL", name: "Металл", icon: Layers3 },
  { code: "WOOD", name: "Дерево", icon: Trees },
  { code: "COAL", name: "Уголь", icon: Mountain },
] as const;
type Tender = { id: string; title: string; objectTypeCode: string | null; deadlineQuarter: number; paidAt: string | null; status: "ACTIVE" | "COMPLETED" | "CLOSED"; requirements: { resourceCode: string; label: string; required: number; collected: number; team: number }[] };

export default function TendersAdminPage() {
  const { snapshot, loading, error } = useLobby();
  const allowed = snapshot?.role === "ORGANIZER" || snapshot?.stationType === "ENTERPRISES";
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [title, setTitle] = useState("");
  const [objectTypeCode, setObjectTypeCode] = useState<string>("ENERGY");
  const [deadlineQuarter, setDeadlineQuarter] = useState(2);
  const [requirements, setRequirements] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    if (!allowed) return;
    const access = getAccess();
    if (!access) return;
    void api<Tender[]>("/tenders", { token: access.token }).then(setTenders).catch((cause) => setNotice(cause.message));
  }, [allowed, snapshot?.sequence]);
  useEffect(() => {
    if (snapshot) setDeadlineQuarter((current) => Math.max(current, Math.min(snapshot.totalQuarters, snapshot.currentQuarter + 1)));
  }, [snapshot?.currentQuarter, snapshot?.totalQuarters]);

  async function create() {
    const access = getAccess();
    if (!access || busy) return;
    const selected = resources.filter((item) => requirements[item.code] > 0).map((item) => ({ resourceCode: item.code, requiredUnits: requirements[item.code] }));
    if (!title.trim() || !selected.length) { setNotice("Укажите название и хотя бы один ресурс"); return; }
    const fingerprint = JSON.stringify({ title: title.trim(), objectTypeCode, deadlineQuarter, selected });
    if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() };
    setBusy(true);
    try {
      const updated = await api<Tender[]>("/tenders", { method: "POST", token: access.token, body: { title: title.trim(), objectTypeCode, deadlineQuarter, requirements: selected, idempotencyKey: pending.current.key } });
      setTenders(updated);
      pending.current = null;
      setTitle("");
      setRequirements({});
      setNotice("Тендер создан");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Не удалось создать тендер"); }
    finally { setBusy(false); }
  }

  async function close(id: string) {
    const access = getAccess();
    if (!access || busy) return;
    setBusy(true);
    try {
      setTenders(await api<Tender[]>(`/tenders/${id}/close`, { method: "POST", token: access.token }));
      setNotice("Тендер завершён");
    } catch (cause) { setNotice(cause instanceof Error ? cause.message : "Не удалось завершить тендер"); }
    finally { setBusy(false); }
  }

  if (!snapshot) return <main className="tenders-admin-state"><LobbyBrand /><p>{error || (loading ? "Загрузка..." : "Нет доступа к сессии")}</p></main>;
  if (snapshot.status === "FINISHED" && snapshot.role !== "ORGANIZER") return <MatchResults snapshot={snapshot} />;
  if (!allowed) return <main className="tenders-admin-state"><LobbyBrand /><p>Доступно организатору и игротеху предприятий</p></main>;
  return <main className="tenders-admin"><header><LobbyBrand /><div><h1>Тендеры</h1><span>Квартал {snapshot.currentQuarter}/{snapshot.totalQuarters}</span></div></header>
    {notice && <p className="tenders-admin-notice" role="status">{notice}</p>}
    <div className="tenders-admin-layout"><section className="tenders-admin-form">
      <h2><Plus size={20} /> Новый тендер</h2>
      <label className="tenders-admin-field">Название<input value={title} maxLength={80} onChange={(event) => setTitle(event.target.value)} placeholder="Название проекта" /></label>
      <h3>Объект</h3>
      <div className="tenders-admin-objects">{objects.map((object) => { const Icon = object.icon; return <button key={object.code} type="button" className={objectTypeCode === object.code ? "is-selected" : ""} onClick={() => setObjectTypeCode(object.code)}><Icon size={18} /><span>{object.name}</span>{objectTypeCode === object.code && <Check size={15} />}</button>; })}</div>
      <label className="tenders-admin-field">Квартал завершения<input type="number" min={Math.max(1, snapshot.currentQuarter)} max={snapshot.totalQuarters} value={deadlineQuarter} onChange={(event) => setDeadlineQuarter(Number(event.target.value))} /></label>
      <h3>Требуемые ресурсы</h3>
      <div className="tenders-admin-resources">{resources.map((resource) => { const Icon = resource.icon; return <label key={resource.code}><Icon size={18} /><span>{resource.name}</span><input type="number" min={0} max={1000000} value={requirements[resource.code] ?? 0} onChange={(event) => setRequirements((current) => ({ ...current, [resource.code]: Number(event.target.value) }))} /></label>; })}</div>
      <button type="button" className="tenders-admin-primary" disabled={busy || !title.trim() || !resources.some((item) => requirements[item.code] > 0)} onClick={create}>{busy ? "Сохраняем..." : "Создать тендер"}</button></section>
    <section className="tenders-admin-list"><h2>Тендеры сессии</h2>{tenders.map((tender) => { const required = tender.requirements.reduce((sum, item) => sum + item.required, 0); const collected = tender.requirements.reduce((sum, item) => sum + item.collected, 0); return <article key={tender.id}>
      <div className="tenders-admin-list-head"><strong>{tender.title}</strong><span><Clock3 size={14} /> Квартал {tender.deadlineQuarter}</span></div>
      <div className="tenders-admin-progress"><i style={{ width: `${required ? collected / required * 100 : 0}%` }} /></div>
      <small>{collected}/{required} ед. · {tender.status === "ACTIVE" ? "Активен" : tender.status === "COMPLETED" ? "Выполнен" : "Завершён"}</small>
      <small className="tenders-admin-reward">{tender.paidAt ? "Выплата начислена" : "При выполнении: 125% рыночной стоимости взноса · по сроку: 75%"}</small>
      <div className="tenders-admin-requirements">{tender.requirements.map((item) => <span key={item.resourceCode}>{item.label} {item.collected}/{item.required}</span>)}</div>
      {tender.status === "ACTIVE" && <button type="button" disabled={busy} onClick={() => close(tender.id)}><X size={15} /> Завершить</button>}
    </article>; })}{!tenders.length && <p className="tenders-admin-empty">Тендеров пока нет</p>}</section></div>
  </main>;
}
