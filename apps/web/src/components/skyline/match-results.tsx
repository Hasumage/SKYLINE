import { Building2, Landmark, Package, Trophy, type LucideIcon } from "lucide-react";
import { LobbyBrand } from "./lobby-brand";
import type { LobbySnapshot } from "../../lib/lobby-client";
import "./match-results.css";

const number = new Intl.NumberFormat("ru-RU");

function Metric({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return <div className="match-results-metric"><Icon size={18} aria-hidden="true" /><span>{label}</span><strong>{value}</strong></div>;
}

export function MatchResults({ snapshot }: { snapshot: LobbySnapshot }) {
  const winners = snapshot.results?.filter((team) => team.isWinner) ?? [];
  return <main className="match-results">
    <div className="match-results-inner">
      <header><LobbyBrand /><span>Квартал {snapshot.currentQuarter}/{snapshot.totalQuarters}</span></header>
      <div className="match-results-heading"><h1>Сессия завершена</h1><p>{winners.length === 1 ? `Победила ${winners[0].name}` : winners.length > 1 ? `Ничья: ${winners.map((team) => team.name).join(", ")}` : "Итоги команд"}</p></div>
      <div className="match-results-list">
        {snapshot.results?.map((team) => <section className="match-results-team" key={team.teamId}>
          <div className="match-results-team-heading"><div><span className="match-results-rank">{team.isWinner && <Trophy size={16} aria-hidden="true" />}{team.isWinner ? "Победитель" : `${team.rank}-е место`}</span><h2>{team.name}</h2></div><div className="match-results-score"><strong>{number.format(team.score)}</strong><span>очков</span></div></div>
          <div className="match-results-grid">
            <Metric icon={Building2} label={`Постройки · ${number.format(team.assetsCount)} шт.`} value={`+${number.format(team.buildingPoints)}`} />
            <Metric icon={Package} label={`На складе · ${number.format(team.stockUnits)} ед.`} value={`+${number.format(team.resourcePoints)}`} />
            <Metric icon={Landmark} label="Непокрытый долг" value={team.debtDeduction ? `−${number.format(team.debtDeduction)}` : "0"} />
          </div>
          {team.debt > 0 && <p className="match-results-debt-note">Долг {number.format(team.debt)} ₽ · баланс покрыл {number.format(Math.min(team.balance, team.debt))} ₽</p>}
        </section>)}
      </div>
    </div>
  </main>;
}
