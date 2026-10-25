"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUpRight, BadgeInfo, ChartNoAxesCombined, ChevronRight, Clock3, Factory, FileText, Flag, Handshake, Landmark, ShoppingCart, Target, UsersRound, X } from "lucide-react";
import { IndustrySelect, type IndustryName } from "../../../components/skyline/industry-select";
import { LobbyBrand } from "../../../components/skyline/lobby-brand";
import { MatchResults } from "../../../components/skyline/match-results";
import { useLobby } from "../../../lib/lobby-client";
import { ResourceSelect, resources, type ResourceName } from "../../../components/skyline/resource-select";
import "./mayor.css";

type Tab = "overview" | "goals" | "emergency" | "decrees";
type DecreeId = "industry" | "aid" | "priority";

const decrees = [
  { id: "industry" as const, title: "Промышленное стимулирование", description: "Снижает стоимость строительства объектов выбранной отрасли", effect: "−500 ₽ на объект, до 2 кварталов", icon: Factory, tone: "orange" },
  { id: "aid" as const, title: "Программа взаимопомощи", description: "Повышает эффективность ресурсов, направленных на восстановление после аварии", effect: "Взносы ×1,5 на 1 квартал", icon: Handshake, tone: "green" },
  { id: "priority" as const, title: "Муниципальный приоритет", description: "Временно повышает спрос на выбранный ресурс через рыночную модель", effect: "Повышенный спрос на 2 квартала", icon: ChartNoAxesCombined, tone: "blue" },
];

type Incident = {
  id: string;
  title: string;
  team: string;
  image: string;
  resource: ResourceName;
  loss: number;
  quarters: number;
  status: "active" | "resolved";
  needs: { name: ResourceName; value: number; total: number }[];
  help: { team: string; quantity: number; resource: ResourceName }[];
};

const incidents: Incident[] = [
  { id: "gas", title: "Авария на газовом заводе", team: "Команда Гамма", image: "/generated/building-gas.png", resource: "Газ", loss: 24, quarters: 2, status: "active", needs: [{ name: "Металл", value: 4, total: 10 }, { name: "Дерево", value: 6, total: 10 }, { name: "Энергия", value: 2, total: 4 }], help: [{ team: "Команда Бета", quantity: 6, resource: "Металл" }, { team: "Команда Альфа", quantity: 2, resource: "Энергия" }] },
  { id: "power", title: "Сбой на электростанции", team: "Команда Бета", image: "/generated/building-energy.png", resource: "Энергия", loss: 26, quarters: 1, status: "active", needs: [{ name: "Металл", value: 3, total: 8 }, { name: "Газ", value: 1, total: 4 }, { name: "Дерево", value: 4, total: 6 }], help: [{ team: "Команда Дельта", quantity: 3, resource: "Металл" }] },
  { id: "metal", title: "Пожар на металлургическом заводе", team: "Команда Дельта", image: "/generated/building-metal.png", resource: "Металл", loss: 18, quarters: 2, status: "resolved", needs: [{ name: "Энергия", value: 6, total: 6 }, { name: "Дерево", value: 8, total: 8 }], help: [{ team: "Команда Зета", quantity: 8, resource: "Дерево" }] },
  { id: "wood", title: "Повреждение деревообработки", team: "Команда Зета", image: "/generated/building-wood.png", resource: "Дерево", loss: 42, quarters: 3, status: "resolved", needs: [{ name: "Металл", value: 5, total: 5 }, { name: "Энергия", value: 4, total: 4 }], help: [{ team: "Команда Эта", quantity: 4, resource: "Энергия" }] },
  { id: "coal", title: "Обвал на угольном объекте", team: "Команда Эта", image: "/generated/building-coal.png", resource: "Уголь", loss: 35, quarters: 2, status: "resolved", needs: [{ name: "Металл", value: 7, total: 7 }, { name: "Дерево", value: 6, total: 6 }], help: [] },
];

const activeIncidents = incidents.filter((incident) => incident.status === "active");
const resolvedIncidents = incidents.filter((incident) => incident.status === "resolved");
const resourceGenitive: Record<ResourceName, string> = { "Энергия": "энергии", "Газ": "газа", "Металл": "металла", "Дерево": "дерева", "Уголь": "угля" };

function ResourceIcon({ name }: { name: ResourceName }) {
  const resource = resources.find((item) => item.name === name) ?? resources[0];
  const Icon = resource.icon;
  return <span className={`mayor-resource-icon mayor-resource-icon--${resource.tone}`}><Icon size={27} strokeWidth={2.5} /></span>;
}

function Progress({ value, total }: { value: number; total: number }) {
  return <div className="mayor-progress" aria-label={`${value} из ${total}`}>{Array.from({ length: total }, (_, index) => <span key={index} className={index < value ? "is-filled" : ""} />)}</div>;
}

function ResourceNeed({ name, value, total }: { name: ResourceName; value: number; total: number }) {
  return <div className="mayor-need"><div><ResourceIcon name={name} /><span>{name}<strong>{value}/{total} <small>ед.</small></strong></span></div><div className="mayor-need-track"><span style={{ width: `${Math.min(100, value / total * 100)}%` }} /></div></div>;
}

export default function MayorInterfacePage() {
  const { snapshot } = useLobby("STAFF");
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedDecree, setSelectedDecree] = useState<DecreeId | null>(null);
  const [selectedIndustry, setSelectedIndustry] = useState<IndustryName>("Энергетика");
  const [selectedResource, setSelectedResource] = useState<ResourceName>("Энергия");
  const [selectedIncidentId, setSelectedIncidentId] = useState(activeIncidents[0].id);
  const [issuedCount, setIssuedCount] = useState(2);
  const [issuedThisQuarter, setIssuedThisQuarter] = useState(false);
  const [activeDecree, setActiveDecree] = useState("");
  const [expandedGoal, setExpandedGoal] = useState("diversification");

  useEffect(() => {
    if (!selectedDecree) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setSelectedDecree(null); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [selectedDecree]);

  function issueDecree() {
    const decree = decrees.find((item) => item.id === selectedDecree);
    if (!decree || issuedThisQuarter || issuedCount >= 5) return;
    setIssuedCount((count) => count + 1);
    setIssuedThisQuarter(true);
    setActiveDecree(`${decree.title}${decree.id === "industry" ? ` · ${selectedIndustry}` : decree.id === "priority" ? ` · ${selectedResource}` : ""}`);
    setSelectedDecree(null);
  }

  const currentDecree = decrees.find((item) => item.id === selectedDecree);
  const currentIncident = incidents.find((incident) => incident.id === selectedIncidentId) ?? activeIncidents[0];
  const headings: Record<Tab, { title: string; subtitle: string }> = {
    overview: { title: "Мэр города", subtitle: "Мобильная панель игротеха" },
    goals: { title: "Мэр города", subtitle: "Цели развития города" },
    emergency: { title: "Чрезвычайная ситуация", subtitle: "Нужно организовать помощь" },
    decrees: { title: "Указы мэра", subtitle: "Ограниченные полномочия" },
  };

  if (snapshot?.status === "FINISHED") return <MatchResults snapshot={snapshot} />;
  return <main className="mayor-page"><div className="mayor-phone">
    <header className="mayor-header"><div className="mayor-header-copy"><LobbyBrand /><h1>{headings[tab].title}</h1><p>{headings[tab].subtitle}</p></div><div className="mayor-clock"><span>Квартал 6</span><strong>02:14</strong></div></header>
    <div className="mayor-content">
      {(tab === "overview" || tab === "decrees") && <div className="mayor-metrics">
        {tab === "decrees" ? <><div><span className="mayor-metric-icon"><FileText /></span><span>Осталось указов<strong>{5 - issuedCount}/5</strong></span></div><div><span className="mayor-metric-icon"><Clock3 /></span><span>Новый указ:<strong className="mayor-metric-note">{issuedThisQuarter ? "в следующем квартале" : "не более 1 за квартал"}</strong></span></div></> : <><div><span className="mayor-metric-icon"><Flag /></span><span>Цели<strong>1/3</strong></span></div><div><span className="mayor-metric-icon mayor-metric-icon--danger"><AlertTriangle /></span><span>ЧП<strong>{activeIncidents.length}</strong></span></div><div><span className="mayor-metric-icon"><FileText /></span><span>Указы<strong>{5 - issuedCount}/5</strong></span></div></>}
      </div>}

      {tab === "overview" && <div className="mayor-stack">
        <button type="button" className="mayor-overview-emergency" onClick={() => { setSelectedIncidentId(activeIncidents[0].id); setTab("emergency"); }}><div className="mayor-card-title"><AlertTriangle size={30} /><h2>Требуют внимания</h2><span>{activeIncidents.length} ЧП <ChevronRight size={17} /></span></div><div className="mayor-emergency-list">{activeIncidents.map((incident) => <div key={incident.id}><img src={incident.image} alt="" /><span><strong>{incident.title}</strong><small>{incident.team} · {incident.quarters} кв.</small></span></div>)}</div></button>
        <button type="button" className="mayor-overview-link" onClick={() => setTab("goals")}><span className="mayor-tile mayor-tile--blue"><Target /></span><span><strong>Цель мэра</strong><b>Экономическая диверсификация</b><small>4 из 5 развитых отраслей</small><Progress value={4} total={5} /></span><ChevronRight /></button>
      </div>}

      {tab === "goals" && <div className="mayor-stack">
        <button type="button" className={`mayor-goal ${expandedGoal === "diversification" ? "is-expanded" : ""}`} onClick={() => setExpandedGoal(expandedGoal === "diversification" ? "" : "diversification")} aria-expanded={expandedGoal === "diversification"}><div className="mayor-goal-head"><span className="mayor-tile mayor-tile--blue"><Target /></span><span><strong>Экономическая диверсификация</strong><small>4 из 5 развитых отраслей</small><Progress value={4} total={5} /></span></div>{expandedGoal === "diversification" && <div className="mayor-goal-detail"><p>Нужно развивать несколько отраслей одновременно</p><h3>Развитые отрасли</h3><div className="mayor-resource-grid">{resources.map((resource) => <span key={resource.name} className={resource.name === "Уголь" ? "is-pending" : ""}><ResourceIcon name={resource.name} />{resource.name}</span>)}</div></div>}</button>
        <button type="button" className={`mayor-goal ${expandedGoal === "stability" ? "is-expanded" : ""}`} onClick={() => setExpandedGoal(expandedGoal === "stability" ? "" : "stability")} aria-expanded={expandedGoal === "stability"}><div className="mayor-goal-head"><span className="mayor-tile mayor-tile--red"><AlertTriangle /></span><span><strong>Устойчивость города</strong><small>{resolvedIncidents.length} из {incidents.length} аварий устранены</small><Progress value={resolvedIncidents.length} total={incidents.length} /></span></div>{expandedGoal === "stability" && <div className="mayor-goal-detail"><p>Важно быстро восстанавливать производство после аварий</p></div>}</button>
        <button type="button" className={`mayor-goal ${expandedGoal === "cooperation" ? "is-expanded" : ""}`} onClick={() => setExpandedGoal(expandedGoal === "cooperation" ? "" : "cooperation")} aria-expanded={expandedGoal === "cooperation"}><div className="mayor-goal-head"><span className="mayor-tile mayor-tile--green"><Handshake /></span><span><strong>Взаимопомощь команд</strong><small>1 из 2 случаев помощи</small><Progress value={1} total={2} /></span></div>{expandedGoal === "cooperation" && <div className="mayor-goal-detail"><p>Команды должны участвовать в поддержке пострадавших</p></div>}</button>
      </div>}

      {tab === "emergency" && <div className="mayor-stack">
        <section className="mayor-incident-picker"><h2>Активные <span>{activeIncidents.length}</span></h2><div>{activeIncidents.map((incident) => <button type="button" key={incident.id} className={selectedIncidentId === incident.id ? "is-selected" : ""} onClick={() => setSelectedIncidentId(incident.id)}><img src={incident.image} alt="" /><span><strong>{incident.title}</strong><small>{incident.team}</small></span><ChevronRight size={19} /></button>)}</div><h2>Завершены <span>{resolvedIncidents.length}</span></h2><div>{resolvedIncidents.map((incident) => <button type="button" key={incident.id} className={selectedIncidentId === incident.id ? "is-selected" : ""} onClick={() => setSelectedIncidentId(incident.id)}><img src={incident.image} alt="" /><span><strong>{incident.title}</strong><small>{incident.team}</small></span><ChevronRight size={19} /></button>)}</div></section>
        <div className={`mayor-alert ${currentIncident.status === "resolved" ? "is-resolved" : ""}`}>{currentIncident.status === "active" ? <AlertTriangle size={29} /> : <BadgeInfo size={29} />}{currentIncident.status === "active" ? "Авария активна" : "Авария устранена"}</div>
        <section className="mayor-incident"><div className="mayor-incident-head"><img src={currentIncident.image} alt="" /><div><h2>{currentIncident.title}</h2><p><UsersRound /> {currentIncident.team}</p><strong><ResourceIcon name={currentIncident.resource} /> −{currentIncident.loss} ед. {resourceGenitive[currentIncident.resource]} / квартал</strong><span>{currentIncident.quarters} {currentIncident.quarters === 1 ? "квартал" : "квартала"} <Clock3 size={16} /></span></div></div><div className="mayor-incident-needs"><h3>{currentIncident.status === "active" ? "Нужно для восстановления" : "Передано для восстановления"}</h3><div>{currentIncident.needs.map((need) => <ResourceNeed key={need.name} {...need} />)}</div></div></section>
        <section className="mayor-help"><div className="mayor-help-head"><span className="mayor-tile mayor-tile--blue"><UsersRound /></span><div><h2>Помощь команд</h2>{currentIncident.help.length ? currentIncident.help.map((entry) => <p key={`${entry.team}-${entry.resource}`}><Handshake /> {entry.team} — <strong>{entry.quantity} ед. {resourceGenitive[entry.resource]}</strong></p>) : <p>Взносов не было</p>}</div></div>{currentIncident.status === "active" && <div className="mayor-help-note"><BadgeInfo /> Мэр должен договориться с командами о дополнительной помощи</div>}</section>
        {currentIncident.status === "active" && <button type="button" className="mayor-emergency-decree-link" onClick={() => { setTab("decrees"); setSelectedDecree("aid"); }}>Открыть указ о взаимопомощи <ChevronRight size={18} /></button>}
      </div>}

      {tab === "decrees" && <div className="mayor-stack mayor-decree-list">{activeDecree && <div className="mayor-active-decree"><FileText size={21} /><span>Указ в этом квартале: <strong>{activeDecree}</strong></span></div>}{decrees.map((decree) => { const Icon = decree.icon; return <button type="button" key={decree.id} className="mayor-decree" onClick={() => setSelectedDecree(decree.id)}><span className={`mayor-tile mayor-tile--${decree.tone}`}><Icon /></span><span><strong>{decree.title}</strong><small>{decree.description}</small><em>{decree.id === "industry" ? <ArrowDown /> : decree.id === "aid" ? <ArrowUpRight /> : <ShoppingCart />}{decree.effect}</em></span><ChevronRight /></button>; })}<div className="mayor-info"><BadgeInfo size={26} /><span><strong>Важно</strong><small>Указы нельзя применять бесконечно. Мэр распределяет их на всю игровую сессию.</small></span></div></div>}
    </div>
    <nav className="mayor-nav" aria-label="Разделы мэра">{([{ id: "overview", label: "Обзор", icon: Landmark }, { id: "goals", label: "Цели", icon: Flag }, { id: "emergency", label: "ЧП", icon: AlertTriangle }, { id: "decrees", label: "Указы", icon: FileText }] as const).map((item) => { const Icon = item.icon; return <button type="button" key={item.id} className={tab === item.id ? "is-active" : ""} aria-current={tab === item.id ? "page" : undefined} onClick={() => { setTab(item.id); setSelectedDecree(null); }}><Icon size={25} fill={item.id === "goals" && tab === item.id ? "currentColor" : "none"} /><span>{item.label}</span></button>; })}</nav>
    {currentDecree && <div className="mayor-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedDecree(null); }}><section className="mayor-modal" role="dialog" aria-modal="true" aria-labelledby="mayor-modal-title"><div className="mayor-modal-top"><h2 id="mayor-modal-title">{currentDecree.title}</h2><button type="button" aria-label="Закрыть" onClick={() => setSelectedDecree(null)}><X size={22} /></button></div><p>{currentDecree.description}</p><div className="mayor-modal-effect">{currentDecree.effect}</div>{currentDecree.id === "industry" && <div className="mayor-modal-field"><span>Отрасль</span><IndustrySelect value={selectedIndustry} onChange={setSelectedIndustry} label="Отрасль для указа" /></div>}{currentDecree.id === "priority" && <div className="mayor-modal-field"><span>Ресурс</span><ResourceSelect value={selectedResource} onChange={setSelectedResource} label="Ресурс для указа" /></div>}<button type="button" className="mayor-issue-button" disabled={issuedThisQuarter || issuedCount >= 5} onClick={issueDecree}>{issuedThisQuarter ? "Новый указ в следующем квартале" : issuedCount >= 5 ? "Лимит указов исчерпан" : "Применить указ"}</button></section></div>}
  </div></main>;
}
