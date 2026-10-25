"use client";

import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Copy, ExternalLink, MonitorPlay, RefreshCw, UsersRound } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, getAccess } from "../../lib/lobby-client";
import { LobbyBrand } from "./lobby-brand";
import "./projector.css";

type Screen = { key: string; label: string };
type ProjectorState = {
  screen: string; automatic: boolean; nextSwitchAt: number | null; screens: Screen[];
  status: string; currentQuarter: number; totalQuarters: number; quarterDurationSec: number;
  startsAt: string | null; serverTime: number; displayToken?: string;
  receivedAt?: number;
};
type ProjectorData = {
  status: string; quarter: number;
  resources: { code: string; label: string; objectCodes: string[] }[];
  teams: { id: string; name: string; color: string; avatar: number; production: Record<string, number>; buildings: Record<string, number>; assetsCount: number }[];
  history: { quarter: number; teams: Record<string, number> }[];
};

const resourceStyle: Record<string, { color: string; image: string }> = {
  HOUSING: { color: "#f45560", image: "/generated/building-housing.png" },
  ENERGY: { color: "#087cff", image: "/generated/building-energy.png" },
  GAS: { color: "#17bde0", image: "/generated/building-gas.png" },
  METAL: { color: "#8452d7", image: "/generated/building-metal.png" },
  WOOD: { color: "#19b96c", image: "/generated/building-wood.png" },
  COAL: { color: "#364154", image: "/generated/building-coal.png" },
};
const format = (value: number) => new Intl.NumberFormat("ru-RU").format(value);
const shortName = (value: string) => value.replace(/^Команда\s+/i, "");

function MatchTime({ state }: { state: ProjectorState }) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(timer); }, []);
  if (!state.startsAt) return <div className="projector-time"><small>Матч</small><strong>Ожидание</strong></div>;
  const elapsed = Math.max(0, now + state.serverTime - (state.receivedAt ?? now) - new Date(state.startsAt).getTime());
  const duration = state.quarterDurationSec * 1000;
  const remaining = Math.max(0, duration - elapsed % duration);
  const seconds = state.status === "FINISHED" ? 0 : Math.ceil(remaining / 1000);
  const quarter = Math.min(state.totalQuarters, Math.floor(elapsed / duration) + 1);
  return <div className="projector-time"><small>Квартал {quarter}/{state.totalQuarters}</small><strong>{String(Math.floor(seconds / 60)).padStart(2, "0")}:{String(seconds % 60).padStart(2, "0")}</strong></div>;
}

function Donut({ items, total, label, center }: { items: { name: string; value: number; color: string }[]; total: number; label: string; center: string }) {
  return <div className="projector-donut">
    <ResponsiveContainer width="100%" height="100%">
      <PieChart><Pie data={items.filter((item) => item.value > 0)} dataKey="value" nameKey="name" innerRadius="56%" outerRadius="91%" paddingAngle={items.filter((item) => item.value > 0).length > 1 ? 2 : 0} isAnimationActive={false} stroke="none">
        {items.filter((item) => item.value > 0).map((item) => <Cell key={item.name} fill={item.color} />)}
      </Pie><Tooltip formatter={(value, name) => [`${format(Number(value))}`, String(name)]} /></PieChart>
    </ResponsiveContainer>
    <div className="projector-donut-center"><strong>{center}</strong><span>{label}</span></div>
    {total === 0 && <div className="projector-donut-empty" />}
  </div>;
}

function OverviewScene({ data }: { data: ProjectorData }) {
  const rows = data.resources.map((resource) => ({
    ...resource,
    count: data.teams.reduce((sum, team) => sum + resource.objectCodes.reduce((itemSum, code) => itemSum + (team.buildings[code] ?? 0), 0), 0),
    color: resourceStyle[resource.code]?.color ?? "#8794ac",
  })).sort((a, b) => b.count - a.count);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return <div className="projector-scene projector-scene-overview">
    <div className="projector-copy"><span className="projector-eyebrow">Экономика города</span><h1>Предприятия по отраслям</h1><p>{data.teams.length} команд · {total} объектов</p></div>
    <div className="projector-overview-grid">
      <Donut items={rows.map((row) => ({ name: row.label, value: row.count, color: row.color }))} total={total} center={format(total)} label="объектов" />
      <div className="projector-legend">{rows.map((row) => <div className="projector-legend-row" key={row.code}><span className="projector-legend-swatch" style={{ background: row.color }} /><span>{row.label}</span><strong>{row.count}</strong><em>{total ? Math.round(row.count / total * 100) : 0}%</em></div>)}</div>
    </div>
    <div className="projector-ticker"><span />{rows[0]?.count ? `${rows[0].label} — крупнейшая отрасль города` : "Экономика города только начинает развиваться"}</div>
  </div>;
}

function ResourceScene({ data, code }: { data: ProjectorData; code: string }) {
  const resource = data.resources.find((item) => item.code === code);
  if (!resource) return <OverviewScene data={data} />;
  const rows = data.teams.map((team) => ({ name: shortName(team.name), value: team.production[code] ?? 0, color: team.color, id: team.id })).sort((a, b) => b.value - a.value);
  const total = rows.reduce((sum, row) => sum + row.value, 0);
  const style = resourceStyle[code] ?? resourceStyle.ENERGY;
  return <div className="projector-scene projector-scene-resource" style={{ "--scene-accent": style.color } as React.CSSProperties}>
    <div className="projector-copy"><span className="projector-eyebrow">Производство · единиц в квартал</span><h1>{resource.label}</h1><p>Доли команд в общем выпуске</p></div>
    <img className="projector-resource-art" src={style.image} alt="" />
    <div className="projector-resource-grid">
      <Donut items={rows.map((row) => ({ name: row.name, value: row.value, color: row.color }))} total={total} center={format(total)} label="ед./кв." />
      <div className="projector-share-list">{rows.map((row, index) => <div className="projector-share-row" key={row.id}><span className="projector-rank">{String(index + 1).padStart(2, "0")}</span><span className="projector-share-name">{row.name}</span><strong>{total ? Math.round(row.value / total * 100) : 0}%</strong><div className="projector-share-track"><span style={{ width: `${total ? row.value / total * 100 : 0}%`, background: row.color }} /></div><small>{format(row.value)} ед./кв.</small></div>)}</div>
    </div>
  </div>;
}

function TeamScene({ data, teamId }: { data: ProjectorData; teamId: string }) {
  const team = data.teams.find((item) => item.id === teamId);
  if (!team) return <OverviewScene data={data} />;
  const total = data.resources.reduce((sum, resource) => sum + (team.production[resource.code] ?? 0), 0);
  const rows = data.resources.map((resource) => ({ name: resource.label, value: team.production[resource.code] ?? 0, fill: resourceStyle[resource.code]?.color ?? "#8895a8" })).filter((item) => item.value > 0);
  const history = data.history.map((item) => ({ quarter: `Кв. ${item.quarter}`, value: item.teams[team.id] ?? 0 }));
  return <div className="projector-scene projector-scene-team" style={{ "--scene-accent": team.color } as React.CSSProperties}>
    <div className="projector-copy"><span className="projector-eyebrow">Команда · профиль производства</span><h1>{team.name}</h1><p>{team.assetsCount} объектов · {format(total)} ед. ресурсов в квартал</p></div>
    <div className="projector-team-grid">
      <div className="projector-team-feature"><span className="projector-team-initial">{shortName(team.name).slice(0, 1)}</span><strong>{shortName(team.name)}</strong><span>Участник экономики SKYLINE</span></div>
      <div className="projector-team-charts">
        <section><h2>Структура производства</h2><div className="projector-team-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={rows} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 0 }}><CartesianGrid horizontal={false} stroke="#e5edf6" /><XAxis type="number" hide /><YAxis dataKey="name" type="category" width={90} tick={{ fill: "#526784", fontSize: 12 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => `${format(Number(value))} ед./кв.`} /><Bar dataKey="value" radius={[0, 5, 5, 0]} isAnimationActive={false}>{rows.map((row) => <Cell key={row.name} fill={row.fill} />)}</Bar></BarChart></ResponsiveContainer></div></section>
        <section><h2>Выпуск по кварталам</h2><div className="projector-team-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={history} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}><CartesianGrid vertical={false} stroke="#e5edf6" /><XAxis dataKey="quarter" tick={{ fill: "#526784", fontSize: 12 }} axisLine={false} tickLine={false} /><YAxis hide /><Tooltip formatter={(value) => `${format(Number(value))} ед.`} /><Bar dataKey="value" fill={team.color} radius={[5, 5, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></section>
      </div>
    </div>
  </div>;
}

function ViewContent({ screen, data }: { screen: string; data: ProjectorData }) {
  return screen === "overview" ? <OverviewScene data={data} /> : screen.startsWith("resource:") ? <ResourceScene data={data} code={screen.slice(9)} /> : <TeamScene data={data} teamId={screen.slice(5)} />;
}

const ProjectorVisualization = memo(function ProjectorVisualization({ screen, data }: { screen: string; data: ProjectorData }) {
  const last = useRef({ screen, data });
  const [previous, setPrevious] = useState<{ screen: string; data: ProjectorData } | null>(null);
  useLayoutEffect(() => {
    if (last.current.screen !== screen) {
      setPrevious(last.current);
      last.current = { screen, data };
      return;
    }
    last.current = { screen, data };
  }, [screen, data]);
  useEffect(() => {
    if (!previous) return;
    const timer = window.setTimeout(() => setPrevious(null), 700);
    return () => window.clearTimeout(timer);
  }, [previous]);
  return <div className="projector-stage">
    {previous && <div className="projector-transition projector-exit"><ViewContent screen={previous.screen} data={previous.data} /></div>}
    <div key={screen} className="projector-transition projector-enter"><ViewContent screen={screen} data={data} /></div>
  </div>;
});

function ProjectorScene({ screen, data, state, preview = false }: { screen: string; data: ProjectorData; state: ProjectorState; preview?: boolean }) {
  return <div className={`projector-frame${preview ? " projector-frame-preview" : ""}`}>
    <header className="projector-header"><LobbyBrand /><div className="projector-header-rule" /><span>{screen === "overview" ? "Экономика города" : screen.startsWith("resource:") ? data.resources.find((item) => item.code === screen.slice(9))?.label : data.teams.find((item) => item.id === screen.slice(5))?.name}</span><MatchTime state={state} /></header>
    <ProjectorVisualization screen={screen} data={data} />
  </div>;
}

export function ProjectorDisplay() {
  const [token, setToken] = useState("");
  const [code, setCode] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [state, setState] = useState<ProjectorState | null>(null);
  const [data, setData] = useState<ProjectorData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { setToken(new URLSearchParams(window.location.search).get("key") ?? ""); }, []);
  const refreshState = useCallback(async () => {
    if (!token) return;
    try { const next = await api<ProjectorState>("/projector/state", { token }); setState({ ...next, receivedAt: Date.now() }); setError(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Нет связи с проектором"); }
  }, [token]);
  const refreshData = useCallback(async () => {
    if (!token) return;
    try {
      const next = await api<ProjectorData>("/projector/data", { token });
      setData((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось загрузить данные"); }
  }, [token]);
  useEffect(() => {
    void refreshState(); void refreshData();
    const stateTimer = window.setInterval(() => void refreshState(), 1000);
    const dataTimer = window.setInterval(() => void refreshData(), 10000);
    return () => { window.clearInterval(stateTimer); window.clearInterval(dataTimer); };
  }, [refreshState, refreshData]);
  async function login(event: FormEvent) {
    event.preventDefault(); setLoggingIn(true); setError("");
    try {
      const access = await api<{ token: string }>("/projector/login", { method: "POST", body: { code } });
      window.history.replaceState(null, "", `/projector?key=${encodeURIComponent(access.token)}`);
      setToken(access.token);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Неверный код проектора"); }
    finally { setLoggingIn(false); }
  }
  if (!token) return <main className="projector-signin"><form onSubmit={(event) => void login(event)}><LobbyBrand /><h1>Проектор</h1><label>Код доступа<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} autoFocus /></label>{error && <p role="alert">{error}</p>}<button type="submit" disabled={loggingIn || code.trim().length !== 6}>Открыть экран</button></form></main>;
  if (!state || !data) return <div className="projector-loading">{error || "Загрузка проектора..."}</div>;
  return <><ProjectorScene screen={state.screen} state={state} data={data} />{error && <div className="projector-connection">{error}</div>}</>;
}

export function ProjectorControl() {
  const router = useRouter();
  const [state, setState] = useState<ProjectorState | null>(null);
  const [data, setData] = useState<ProjectorData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const token = state?.displayToken;
  useEffect(() => {
    const access = getAccess();
    if (access?.role !== "ORGANIZER") { router.replace("/admin/login"); return; }
    let active = true;
    void api<ProjectorState>("/admin/projector", { token: access.token }).then((next) => { if (active) setState({ ...next, receivedAt: Date.now() }); }).catch((cause) => { if (active) setError(cause.message); });
    return () => { active = false; };
  }, [router]);
  const refreshState = useCallback(async () => {
    const access = getAccess(); if (!access || !token) return;
    try {
      const nextState = await api<ProjectorState>("/admin/projector/state", { token: access.token });
      setState((current) => current ? { ...nextState, displayToken: current.displayToken, receivedAt: Date.now() } : current);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка обновления"); }
  }, [token]);
  const refreshData = useCallback(async () => {
    if (!token) return;
    try {
      const nextData = await api<ProjectorData>("/projector/data", { token });
      setData((current) => JSON.stringify(current) === JSON.stringify(nextData) ? current : nextData);
      setError("");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ошибка обновления"); }
  }, [token]);
  useEffect(() => {
    void refreshState(); void refreshData();
    const stateTimer = window.setInterval(() => void refreshState(), 1000);
    const dataTimer = window.setInterval(() => void refreshData(), 10000);
    return () => { window.clearInterval(stateTimer); window.clearInterval(dataTimer); };
  }, [refreshState, refreshData]);
  async function change(input: { screen?: string; automatic?: boolean }) {
    const access = getAccess(); if (!access) return;
    setBusy(true); setError("");
    try {
      const next = await api<ProjectorState>("/admin/projector", { method: "PATCH", token: access.token, body: input });
      setState((current) => ({ ...next, displayToken: current?.displayToken, receivedAt: Date.now() }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось сменить экран"); }
    finally { setBusy(false); }
  }
  const url = useMemo(() => token && typeof window !== "undefined" ? `${window.location.origin}/projector?key=${encodeURIComponent(token)}` : "", [token]);
  const selected = state?.screens.find((item) => item.key === state.screen)?.label ?? "Отрасли";
  return <main className="projector-control">
    <div className="projector-control-shell"><header className="projector-control-top"><LobbyBrand /><span>Панель организатора</span></header>
      <div className="projector-control-body"><div className="projector-control-heading"><button type="button" onClick={() => router.push("/admin/lobby")} title="К управлению сессией" aria-label="К управлению сессией"><ArrowLeft size={20} /></button><div><h1>Проектор</h1><p>Публичный экран игры</p></div></div>
        {error && <p className="projector-control-error" role="alert">{error}</p>}
        {!state && !error && <p>Подключение...</p>}
        {state && <><div className="projector-control-actions"><div><span className="projector-control-kicker">Сейчас на экране</span><strong>{selected}</strong></div><label className="projector-auto"><span>Автоматическое переключение<small>Каждые 15 секунд</small></span><input type="checkbox" checked={state.automatic} disabled={busy} onChange={(event) => void change({ automatic: event.target.checked })} /><i /></label></div>
          <div className="projector-control-grid"><section className="projector-control-list"><h2>Город</h2><button className={state.screen === "overview" ? "active" : ""} type="button" disabled={busy} onClick={() => void change({ screen: "overview", automatic: false })}><MonitorPlay size={20} />Предприятия по отраслям</button>
            <h2>Ресурсы</h2>{state.screens.filter((item) => item.key.startsWith("resource:")).map((item) => <button className={state.screen === item.key ? "active" : ""} type="button" disabled={busy} key={item.key} onClick={() => void change({ screen: item.key, automatic: false })}>{resourceStyle[item.key.slice(9)] ? <img className="projector-control-resource" src={resourceStyle[item.key.slice(9)].image} alt="" /> : <span className="projector-control-dot" />}{item.label}</button>)}
            <h2>Команды</h2>{state.screens.filter((item) => item.key.startsWith("team:")).map((item) => <button className={state.screen === item.key ? "active" : ""} type="button" disabled={busy} key={item.key} onClick={() => void change({ screen: item.key, automatic: false })}><UsersRound size={19} />{item.label}</button>)}</section>
            <section className="projector-control-preview"><div className="projector-preview-label"><span>Предпросмотр</span><span>{state.status === "ACTIVE" ? `Квартал ${state.currentQuarter}` : "Ожидание матча"}</span></div><div className="projector-preview-box">{data ? <ProjectorScene screen={state.screen} state={state} data={data} preview /> : <span>Загрузка данных...</span>}</div><div className="projector-link-actions"><a href={url} target="_blank" rel="noopener noreferrer"><ExternalLink size={18} />Открыть проектор</a><button type="button" title="Скопировать ссылку" aria-label="Скопировать ссылку" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }}>{copied ? <Check size={19} /> : <Copy size={19} />}</button><button type="button" title="Обновить данные" aria-label="Обновить данные" onClick={() => { void refreshState(); void refreshData(); }}><RefreshCw size={19} /></button></div></section></div>
        </>}
      </div>
    </div>
  </main>;
}
