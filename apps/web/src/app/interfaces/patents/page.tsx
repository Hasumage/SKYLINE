"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Building2,
  Check,
  ChevronRight,
  Clock3,
  FileCheck2,
  FileText,
  Info,
  ListFilter,
  Search,
  TrendingUp,
  X,
} from "lucide-react";
import { AtmScaleFrame } from "../../../components/skyline/atm-scale-frame";
import { IndustrySelect, type IndustryName } from "../../../components/skyline/industry-select";
import { LobbyBrand } from "../../../components/skyline/lobby-brand";
import { api, getAccess, useLobby, useMatchClock } from "../../../lib/lobby-client";
import { MatchResults } from "../../../components/skyline/match-results";
import "./patents.css";

type Team = { id: string; name: string; tone: string };
type Patent = {
  id: string;
  teamId: string;
  name: string;
  industry: string;
  duration: number;
  coefficient: number;
  registeredQuarter: number;
};
type PatentForm = { name: string; industry: IndustryName; duration: number; coefficient: number };

const CURRENT_QUARTER = 2;
const demoTeams: Team[] = [
  { id: "alpha", name: "Команда Альфа", tone: "blue" },
  { id: "beta", name: "Команда Бета", tone: "violet" },
  { id: "gamma", name: "Команда Гамма", tone: "green" },
  { id: "delta", name: "Команда Дельта", tone: "orange" },
  { id: "epsilon", name: "Команда Эпсилон", tone: "rose" },
  { id: "zeta", name: "Команда Зета", tone: "cyan" },
  { id: "eta", name: "Команда Эта", tone: "amber" },
  { id: "theta", name: "Команда Тета", tone: "sky" },
];
const emptyPatentForm: PatentForm = { name: "", industry: "Энергетика", duration: 2, coefficient: 1.2 };

function patentIsActive(patent: Patent, quarter: number) {
  return quarter < patent.registeredQuarter + patent.duration;
}

function TeamIcon({ tone }: { tone: string }) {
  return <span className={`science-team-icon science-team-icon--${tone}`}><Building2 size={38} strokeWidth={2.6} /></span>;
}

export default function PatentsInterfacePage() {
  const { snapshot, clockOffset } = useLobby("STAFF");
  const clock = useMatchClock(snapshot, clockOffset);
  const live = snapshot?.stationType === "PATENT_OFFICE";
  const teams: Team[] = live ? snapshot.teams.map((team, index) => ({ id: team.id, name: team.name, tone: demoTeams[index % demoTeams.length].tone })) : demoTeams;
  const currentQuarter = live ? snapshot.currentQuarter : CURRENT_QUARTER;
  const [selectedTeamId, setSelectedTeamId] = useState("alpha");
  const [search, setSearch] = useState("");
  const [patents, setPatents] = useState<Patent[]>([]);
  const [form, setForm] = useState<PatentForm>(emptyPatentForm);
  const [notice, setNotice] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<{ fingerprint: string; key: string } | null>(null);

  useEffect(() => {
    if (live && teams.length && !teams.some((team) => team.id === selectedTeamId)) setSelectedTeamId(teams[0].id);
  }, [live, snapshot?.teams, selectedTeamId]);
  useEffect(() => {
    if (!live) return;
    const access = getAccess();
    if (access) void api<Patent[]>("/science/patents", { token: access.token }).then(setPatents).catch((error) => setNotice(error.message));
  }, [live, snapshot?.sequence]);

  useEffect(() => {
    if (!listOpen) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setListOpen(false); };
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, [listOpen]);

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? teams[0];
  const visibleTeams = teams.filter((team) => team.name.toLocaleLowerCase("ru").includes(search.trim().toLocaleLowerCase("ru")));
  const activeCount = patents.filter((patent) => patent.teamId === selectedTeamId && patentIsActive(patent, currentQuarter)).length;
  const validForm = form.name.trim().length >= 3 && form.name.trim().length <= 80 && form.duration >= 1 && form.duration <= 4 && form.coefficient >= 1.1 && form.coefficient <= 2;
  const visiblePatents = patents.filter((patent) => patentIsActive(patent, currentQuarter) && (patent.name.toLocaleLowerCase("ru").includes(listSearch.trim().toLocaleLowerCase("ru")) || teams.find((team) => team.id === patent.teamId)?.name.toLocaleLowerCase("ru").includes(listSearch.trim().toLocaleLowerCase("ru"))));

  function selectTeam(teamId: string) {
    setSelectedTeamId(teamId);
    setForm(emptyPatentForm);
    setNotice("");
  }

  function changeForm(patch: Partial<PatentForm>) {
    setForm((current) => ({ ...current, ...patch }));
    setNotice("");
  }

  async function registerPatent() {
    if (!validForm || activeCount >= 2 || busy || !selectedTeam) return;
    if (live) {
      const access = getAccess();
      if (!access) return;
      const fingerprint = JSON.stringify({ selectedTeamId, form });
      if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, key: crypto.randomUUID() };
      setBusy(true);
      try {
        setPatents(await api<Patent[]>("/science/patents", { method: "POST", token: access.token, body: { teamId: selectedTeamId, ...form, idempotencyKey: pending.current.key } }));
        pending.current = null;
        setNotice(`Патент «${form.name.trim()}» зарегистрирован для команды ${selectedTeam.name}`);
        setForm(emptyPatentForm);
      } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось зарегистрировать патент"); }
      finally { setBusy(false); }
      return;
    }
    setPatents((current) => [{
      id: `patent-${Date.now()}`,
      teamId: selectedTeamId,
      name: form.name.trim(),
      industry: form.industry,
      duration: form.duration,
      coefficient: form.coefficient,
      registeredQuarter: currentQuarter,
    }, ...current]);
    setNotice(`Патент «${form.name.trim()}» зарегистрирован для команды ${selectedTeam.name}`);
    setForm(emptyPatentForm);
  }

  if (snapshot?.status === "FINISHED") return <MatchResults snapshot={snapshot} />;
  return <main className="science-page">
    <AtmScaleFrame>
      <header className="science-header">
        <div className="science-brand"><LobbyBrand /></div>
        <div className="science-header-divider" />
        <div className="science-header-title"><h1>Наука</h1><span>Патенты</span></div>
        <div className="science-clock"><span>Квартал {currentQuarter}</span><strong>{live ? clock?.text ?? "00:00" : "02:14"}</strong></div>
      </header>

      <div className="science-layout">
        <aside className="science-teams" aria-label="Команды">
          <label className="science-search"><Search size={25} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Поиск команды..." aria-label="Поиск команды" /></label>
          <div className="science-team-list">
            {visibleTeams.map((team) => {
              const count = patents.filter((patent) => patent.teamId === team.id && patentIsActive(patent, currentQuarter)).length;
              return <button type="button" key={team.id} className={`science-team-row ${team.id === selectedTeamId ? "is-selected" : ""}`} aria-current={team.id === selectedTeamId ? "true" : undefined} onClick={() => selectTeam(team.id)}>
                <TeamIcon tone={team.tone} />
                <span><strong>{team.name}</strong><small>{count ? `${count} ${count === 1 ? "активный патент" : "активных патента"}` : "Патентов нет"}</small></span>
                <ChevronRight size={24} />
              </button>;
            })}
            {!visibleTeams.length && <p className="science-empty">Команды не найдены</p>}
          </div>
        </aside>

        <section className="science-workspace" aria-label="Патент команды">
          <div className="science-team-heading">
            <img src="/generated/structure-patent.png" alt="" />
            <div><h2>{selectedTeam?.name ?? "Выберите команду"}</h2><span><Check size={17} /> Выбрана команда</span></div>
          </div>
          {notice && <div className="science-notice" role="status"><Check size={22} />{notice}</div>}
          <div className="science-form">
            <label><span>Название патента</span><input value={form.name} maxLength={80} onChange={(event) => changeForm({ name: event.target.value })} placeholder="Название разработки" /></label>
            <div className="science-industry-field"><span>Отрасль / объект</span><IndustrySelect value={form.industry} onChange={(industry) => changeForm({ industry })} /></div>
            <label><span>Срок действия, кварталы</span><input type="number" min="1" max="4" step="1" value={form.duration} onChange={(event) => changeForm({ duration: Number(event.target.value) })} /></label>
            <label><span>Коэффициент дохода</span><select value={form.coefficient} onChange={(event) => changeForm({ coefficient: Number(event.target.value) })}>{Array.from({ length: 10 }, (_, index) => Number((1.1 + index * 0.1).toFixed(1))).map((coefficient) => <option value={coefficient} key={coefficient}>×{coefficient.toFixed(1)}</option>)}</select></label>
            <div className="science-form-row"><span>Действующих патентов у команды</span><strong><FileText size={20} /> {activeCount} из 2</strong></div>
          </div>

          <div className="science-parameters"><h3>Параметры патента</h3><div><span><Clock3 size={25} /><small>Срок действия</small><strong>{form.duration} {form.duration === 1 ? "квартал" : form.duration < 5 ? "квартала" : "кварталов"}</strong></span><span><TrendingUp size={25} /><small>Коэффициент</small><strong>×{form.coefficient.toFixed(1)}</strong></span><span><FileCheck2 size={25} /><small>Лимит команды</small><strong>2 патента</strong></span></div></div>
          {activeCount >= 2 && <p className="science-error" role="alert">У команды уже два действующих патента.</p>}
          {!validForm && form.name.trim() && <p className="science-error" role="alert">Проверьте название, срок и коэффициент.</p>}
          <div className="science-actions"><button type="button" className="is-primary" onClick={registerPatent} disabled={!validForm || activeCount >= 2 || busy || !selectedTeam}>Зарегистрировать патент</button><button type="button" onClick={() => { setListSearch(""); setListOpen(true); }}><ListFilter size={19} /> Патенты</button></div>
        </section>

        <aside className="science-sidebar" aria-label="Информация о патентах">
          <div className="science-info"><h3><Info size={27} /> О патентах</h3><p>Не более 2 действующих патентов на команду.</p><p>Срок действия задаётся в кварталах.</p><p>Коэффициент дохода не выше ×2.</p><p>Рекомендуемый диапазон: ×1.1–×1.3.</p><p>Стоимость и прибыль определяются правилами турнира или решением игротеха.</p></div>
          <div className="science-registered"><h3><FileText size={26} /> Зарегистрированные патенты</h3><div>{patents.filter((patent) => patentIsActive(patent, currentQuarter)).slice(0, 5).map((patent) => <div key={patent.id}><strong>{patent.name}</strong><small>{teams.find((team) => team.id === patent.teamId)?.name}</small><b>×{patent.coefficient.toFixed(1)}</b></div>)}{!patents.some((patent) => patentIsActive(patent, currentQuarter)) && <p className="science-empty">Патентов пока нет</p>}</div></div>
        </aside>
      </div>
    </AtmScaleFrame>
    {listOpen && typeof document !== "undefined" && createPortal(<div className="science-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setListOpen(false); }}><section className="science-dialog" role="dialog" aria-modal="true" aria-labelledby="science-dialog-title"><div className="science-dialog-header"><h2 id="science-dialog-title">Действующие патенты</h2><button type="button" aria-label="Закрыть" title="Закрыть" onClick={() => setListOpen(false)}><X size={23} /></button></div><label><ListFilter size={20} /><input value={listSearch} onChange={(event) => setListSearch(event.target.value)} placeholder="Поиск патента или команды" aria-label="Поиск патента или команды" /></label><div className="science-dialog-list">{visiblePatents.map((patent) => <article key={patent.id}><div><strong>{patent.name}</strong><small>{teams.find((team) => team.id === patent.teamId)?.name} · {patent.industry}</small></div><span>×{patent.coefficient.toFixed(1)} · {patent.duration} кв.</span></article>)}{!visiblePatents.length && <p>Патенты не найдены</p>}</div></section></div>, document.body)}
  </main>;
}
