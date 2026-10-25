"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Landmark, Map, TrendingUp, Wallet, X, Zap, House, Droplets, Layers3, Trees, Mountain, Minus, Plus, Coins } from "lucide-react";
import { LobbyBrand } from "./lobby-brand";
import { MatchResults } from "./match-results";
import { api, getAccess, useLobby, useMatchClock, type LobbySnapshot } from "../../lib/lobby-client";
import "./player-home.css";

type Tab = "city" | "assets" | "market" | "tenders";
const tabs: { id: Tab; label: string; icon: typeof Map }[] = [
  { id: "city", label: "Город", icon: Map },
  { id: "assets", label: "Активы", icon: Building2 },
  { id: "market", label: "Рынок", icon: TrendingUp },
  { id: "tenders", label: "Тендеры", icon: Landmark },
];
const money = new Intl.NumberFormat("ru-RU");
type MarketObject = { id: string; code: string; category: string; currentPrice: number; builtCount: number; yields: { code: string; label: string; unitsPerQuarter: number; currentUnitPrice: number }[] };
type ResourceOffer = { code: string; label: string; quantity: number; currentUnitPrice: number };
type Tender = { id: string; title: string; objectTypeCode: string | null; deadlineQuarter: number; status: "ACTIVE" | "COMPLETED" | "CLOSED"; requirements: { resourceCode: string; label: string; required: number; collected: number; team: number }[] };
const objectIcons = { HOUSING: House, ENERGY: Zap, GAS: Droplets, METAL: Layers3, WOOD: Trees, COAL: Mountain } as const;
const objectNames: Record<string, string> = { HOUSING: "Жилой комплекс", ENERGY: "Электростанция", GAS: "Газовый объект", METAL: "Металлургия", WOOD: "Деревообработка", COAL: "Угольный объект" };
function objectImage(code: string) { return `/generated/building-${code.toLowerCase()}.png`; }
function ObjectIcon({ code }: { code: string }) { const Icon = objectIcons[code as keyof typeof objectIcons] ?? Building2; return <Icon size={19} />; }

function MatchTimer({ snapshot, offset }: { snapshot: LobbySnapshot; offset: number }) {
  const clock = useMatchClock(snapshot, offset);
  const progress = clock?.fraction ?? 1;
  return <div className="player-timer" aria-label={`Квартал ${clock?.quarter ?? snapshot.currentQuarter} из ${snapshot.totalQuarters}, осталось ${clock?.text ?? "00:00"}`}>
    <svg viewBox="0 0 64 64" aria-hidden="true"><circle className="player-timer-track" cx="32" cy="32" r="27" /><circle className="player-timer-progress" cx="32" cy="32" r="27" style={{ strokeDasharray: `${progress * 169.65} 169.65` }} /></svg>
    <div className="player-timer-label"><small>Квартал {clock?.quarter ?? snapshot.currentQuarter}/{snapshot.totalQuarters}</small><strong>{snapshot.status === "FINISHED" ? "00:00" : clock?.text ?? "00:00"}</strong></div>
  </div>;
}

function City({ snapshot }: { snapshot: LobbySnapshot }) {
  const [selected, setSelected] = useState<string | null>(null);
  const enabled = (type: string) => snapshot.stations.some((station) => station.type === type && station.enabled);
  const pins = [
    { id: "enterprises", title: "Предприятия", detail: enabled("ENTERPRISES") ? "Структура открыта" : "Пока закрыто", icon: Building2, tone: "orange", position: "industry" },
    { id: "bank", title: "Банк", detail: enabled("BANK") ? "Операции открыты" : "Пока закрыто", icon: Wallet, tone: "green", position: "business" },
    { id: "mayor", title: "Мэр города", detail: enabled("MAYOR") ? "Структура открыта" : "Пока закрыто", icon: Landmark, tone: "blue", position: "civic" },
    snapshot.transactions?.[0] && { id: "activity", title: snapshot.transactions[0].type === "deposit" ? "Баланс пополнен" : "Средства сняты", detail: `${money.format(snapshot.transactions[0].amount)} ₽`, icon: Wallet, tone: "blue", position: "activity" },
  ].filter((pin): pin is Exclude<typeof pin, false | undefined> => Boolean(pin));
  const activePin = pins.find((pin) => pin.id === selected);
  return <section className="player-map" aria-label="Карта города"><div className="player-map-art">
    <img className="player-map-image" src="/generated/player-city-reference.png" alt="Изометрический город SKYLINE с промышленной гаванью, деловым центром и мэрией" />
    {pins.map((pin) => { const Icon = pin.icon; return <button key={pin.id} type="button" className={`player-map-pin player-map-pin--${pin.position} player-map-pin--${pin.tone}${selected === pin.id ? " is-selected" : ""}`} onClick={() => setSelected(pin.id)} aria-label={`${pin.title}: ${pin.detail}`}>
      <span className="player-map-pin-icon"><Icon size={13} strokeWidth={2.5} /></span><span><strong>{pin.title}</strong><small>{pin.detail}</small></span>
    </button>; })}
    {activePin && <div className="player-map-detail" role="status"><div><strong>{activePin.title}</strong><span>{activePin.detail}</span></div><button type="button" title="Закрыть" aria-label="Закрыть" onClick={() => setSelected(null)}><X size={17} /></button></div>}
  </div>
  </section>;
}

function AssetsPanel({ snapshot, offers, busy, error, onSell }: { snapshot: LobbySnapshot; offers: ResourceOffer[]; busy: boolean; error: string; onSell: (offer: ResourceOffer, quantity: number) => Promise<boolean> }) {
  const assets = snapshot.assets ?? [];
  const resources = snapshot.resources ?? [];
  const currentQuarter = snapshot.currentQuarter;
  const [selected, setSelected] = useState<ResourceOffer | null>(null);
  const [quantity, setQuantity] = useState(1);
  const current = offers.find((item) => item.code === selected?.code) ?? selected;
  const saleAvailable = Math.min(1_000_000, resources.find((item) => item.code === current?.code)?.quantity ?? 0);
  return <section className="player-detail-scroll" aria-label="Активы команды">
    <h2>Ресурсы активов</h2>
    <div className="player-resource-grid">{Object.entries(objectIcons).map(([code]) => {
      const stock = resources.find((item) => item.code === code);
      const offer = offers.find((item) => item.code === code);
      const perQuarter = assets.filter((asset) => asset.firstProductionQuarter <= currentQuarter && asset.code === code).reduce((sum, asset) => sum + asset.quantity * (asset.yields.find((item) => item.code === code)?.unitsPerQuarter ?? 0), 0);
      return <div key={code} className="player-resource"><ObjectIcon code={code} /><span><small>{stock?.label ?? offer?.label ?? (code === "HOUSING" ? "Жильё" : objectNames[code])}</small><strong>{stock?.quantity ?? 0} ед.</strong><small className="player-resource-yield">+{perQuarter} ед./кв</small>{offer && <small className="player-resource-price">{money.format(offer.currentUnitPrice)} ₽/ед.</small>}</span><button type="button" className="player-resource-sell" disabled={!offer?.currentUnitPrice || !stock?.quantity || snapshot.status !== "ACTIVE"} onClick={() => { if (offer) { setSelected(offer); setQuantity(1); } }}><Coins size={14} />Продать</button></div>;
    })}</div>
    {snapshot.loan && <div className="player-loan"><Landmark size={21} /><span><strong>Кредит: осталось {money.format(snapshot.loan.remaining)} ₽</strong><small>Платёж за квартал {money.format(snapshot.loan.paymentPerQuarter)} ₽</small></span></div>}
    <h2>Ваши объекты</h2>
    <div className="player-object-list">{assets.map((asset) => {
      const running = asset.firstProductionQuarter <= currentQuarter;
      return <article key={asset.id} className="player-object"><img src={objectImage(asset.code)} alt="" /><span><strong>{objectNames[asset.code] ?? asset.category}{asset.quantity > 1 ? ` · ${asset.quantity} шт.` : ""}</strong><small>{asset.category}</small><small className={running ? "is-running" : ""}>{running ? "Работает" : "Строится"} · {asset.yields.reduce((sum, item) => sum + item.unitsPerQuarter * asset.quantity, 0)} ед./кв</small></span></article>;
    })}{!assets.length && <p className="player-empty">У команды пока нет объектов</p>}</div>
    {current && <div className="player-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="player-dialog" role="dialog" aria-modal="true" aria-label={`Продажа: ${current.label}`}><button type="button" className="player-dialog-close" aria-label="Закрыть" onClick={() => setSelected(null)}><X size={20} /></button><h2>Продать {current.label.toLowerCase()}</h2><p>На складе: {resources.find((item) => item.code === current.code)?.quantity ?? 0} ед. · Цена: {money.format(current.currentUnitPrice)} ₽/ед.</p><div className="player-sale-quantity"><label htmlFor="player-sale-amount">Количество</label><input id="player-sale-amount" type="number" min={1} max={saleAvailable} value={quantity} onChange={(event) => setQuantity(Math.min(saleAvailable, Math.max(0, Number(event.target.value))))} /></div><input className="player-sale-slider" type="range" aria-label="Количество для продажи" min={1} max={Math.max(1, saleAvailable)} value={Math.min(Math.max(1, quantity), Math.max(1, saleAvailable))} onChange={(event) => setQuantity(Number(event.target.value))} /><p>К зачислению: <strong>{money.format(current.currentUnitPrice * quantity)} ₽</strong></p><button type="button" className="player-buy" disabled={busy || quantity < 1 || quantity > saleAvailable} onClick={async () => { if (await onSell(current, quantity)) setSelected(null); }}>{busy ? "Продаём..." : `Продать за ${money.format(current.currentUnitPrice * quantity)} ₽`}</button>{error && <p className="player-buy-error" role="alert">{error}</p>}</section></div>}
  </section>;
}

function MarketPanel({ catalog, balance, busy, error, onBuy }: { catalog: MarketObject[]; balance: number; busy: boolean; error: string; onBuy: (object: MarketObject, quantity: number) => Promise<boolean> }) {
  const [selected, setSelected] = useState<MarketObject | null>(null);
  const [quantity, setQuantity] = useState(1);
  const price = selected?.currentPrice ?? 0;
  return <section className="player-detail-scroll" aria-label="Рынок построек"><h2>Рынок построек</h2><div className="player-object-list">{catalog.map((object) => {
    return <article key={object.id} className="player-object player-market-object"><img src={objectImage(object.code)} alt="" /><span><strong>{objectNames[object.code] ?? object.category}</strong><small>{object.yields.map((item) => `+${item.unitsPerQuarter} ${item.label.toLowerCase()}/кв · ${money.format(item.currentUnitPrice)} ₽/ед.`).join(" · ")}</small><b>{money.format(object.currentPrice)} ₽</b></span><button type="button" onClick={() => { setSelected(object); setQuantity(1); }}>Купить</button></article>;
  })}{!catalog.length && <p className="player-empty">Каталог пока пуст</p>}</div>
    {selected && <div className="player-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="player-dialog" role="dialog" aria-modal="true" aria-label={`Покупка: ${objectNames[selected.code] ?? selected.category}`}><button type="button" className="player-dialog-close" aria-label="Закрыть" onClick={() => setSelected(null)}><X size={20} /></button><img src={objectImage(selected.code)} alt="" /><h2>{objectNames[selected.code] ?? selected.category}</h2><p>{selected.yields.map((item) => `+${item.unitsPerQuarter * quantity} ед. ${item.label.toLowerCase()} за квартал`).join(" · ")}</p><div className="player-quantity"><span>Количество</span><button type="button" aria-label="Уменьшить" disabled={quantity <= 1} onClick={() => setQuantity(quantity - 1)}><Minus size={17} /></button><strong>{quantity}</strong><button type="button" aria-label="Увеличить" disabled={quantity >= 20} onClick={() => setQuantity(quantity + 1)}><Plus size={17} /></button></div><button type="button" className="player-buy" disabled={busy || price * quantity > balance} onClick={async () => { if (await onBuy(selected, quantity)) setSelected(null); }}>{busy ? "Оформляем..." : `Купить за ${money.format(price * quantity)} ₽`}</button>{price * quantity > balance && <p className="player-buy-error">Недостаточно средств</p>}{error && <p className="player-buy-error" role="alert">{error}</p>}</section></div>}
  </section>;
}

function TendersPanel({ tenders, stocks, quarter, busy, onContribute }: { tenders: Tender[]; stocks: LobbySnapshot["resources"]; quarter: number; busy: boolean; onContribute: (tender: Tender, resourceCode: string, quantity: number) => Promise<boolean> }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Tender | null>(null);
  const [resourceCode, setResourceCode] = useState("");
  const [quantity, setQuantity] = useState(1);
  const requirement = selected?.requirements.find((item) => item.resourceCode === resourceCode);
  const available = stocks?.find((item) => item.code === resourceCode)?.quantity ?? 0;
  const remaining = requirement ? requirement.required - requirement.collected : 0;
  return <section className="player-detail-scroll" aria-label="Тендеры"><h2>Тендеры</h2><div className="player-tender-list">{tenders.map((tender) => {
    const required = tender.requirements.reduce((sum, item) => sum + item.required, 0);
    const collected = tender.requirements.reduce((sum, item) => sum + item.collected, 0);
    const expanded = expandedId === tender.id;
    return <article className="player-tender" key={tender.id}>
      <button type="button" className="player-tender-banner" onClick={() => setExpandedId(expanded ? null : tender.id)} aria-expanded={expanded} style={tender.objectTypeCode ? { backgroundImage: `linear-gradient(0deg, #fff 0%, #ffffff11 100%), url(${objectImage(tender.objectTypeCode)})` } : undefined}><span>{tender.status === "ACTIVE" ? `До конца: ${Math.max(0, tender.deadlineQuarter - quarter + 1)} кв.` : tender.status === "COMPLETED" ? "Выполнен" : "Завершён"}</span><strong>{tender.title}</strong></button>
      <div className="player-tender-summary"><span>Общий прогресс <b>{required ? Math.round(collected / required * 100) : 0}%</b></span><div className="player-tender-track"><i style={{ width: `${required ? collected / required * 100 : 0}%` }} /></div></div>
      {expanded && <div className="player-tender-body"><div className="player-tender-legend"><span><i />Другие команды</span><span><i />Ваша команда</span></div>{tender.requirements.map((item) => <div className="player-tender-line" key={item.resourceCode}><span><ObjectIcon code={item.resourceCode} />{item.label}</span><div className="player-tender-track"><i style={{ width: `${(item.collected - item.team) / item.required * 100}%` }} /><i className="is-team" style={{ width: `${item.team / item.required * 100}%` }} /></div><b>{item.collected}/{item.required}</b></div>)}{tender.status === "ACTIVE" && <button type="button" className="player-buy" onClick={() => { setSelected(tender); setResourceCode(tender.requirements.find((item) => item.collected < item.required)?.resourceCode ?? tender.requirements[0]?.resourceCode ?? ""); setQuantity(1); }}>Внести ресурсы</button>}</div>}
    </article>;
  })}{!tenders.length && <p className="player-empty">Активные тендеры пока не объявлены</p>}</div>
    {selected && <div className="player-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="player-dialog" role="dialog" aria-modal="true" aria-label={`Внести ресурсы: ${selected.title}`}><button type="button" className="player-dialog-close" aria-label="Закрыть" onClick={() => setSelected(null)}><X size={20} /></button><h2>Внести ресурсы</h2><p>{selected.title}</p><div className="player-resource-choices">{selected.requirements.map((item) => <button type="button" key={item.resourceCode} className={resourceCode === item.resourceCode ? "is-active" : ""} disabled={item.collected >= item.required} onClick={() => { setResourceCode(item.resourceCode); setQuantity(1); }}><ObjectIcon code={item.resourceCode} />{item.label}</button>)}</div><p>На складе: {available} ед. · Требуется ещё: {remaining} ед.</p><label className="player-tender-amount">Количество<input type="number" min={1} max={Math.min(available, remaining)} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><button type="button" className="player-buy" disabled={busy || !Number.isInteger(quantity) || quantity < 1 || quantity > available || quantity > remaining} onClick={async () => { if (await onContribute(selected, resourceCode, quantity)) setSelected(null); }}>{busy ? "Вносим..." : "Внести"}</button></section></div>}
  </section>;
}

function TabContent({ tab, snapshot, catalog, offers, tenders, busy, marketError, onBuy, onSell, onContribute }: { tab: Tab; snapshot: LobbySnapshot; catalog: MarketObject[]; offers: ResourceOffer[]; tenders: Tender[]; busy: boolean; marketError: string; onBuy: (object: MarketObject, quantity: number) => Promise<boolean>; onSell: (offer: ResourceOffer, quantity: number) => Promise<boolean>; onContribute: (tender: Tender, resourceCode: string, quantity: number) => Promise<boolean> }) {
  if (tab === "city") return <City snapshot={snapshot} />;
  if (tab === "assets") return <AssetsPanel snapshot={snapshot} offers={offers} busy={busy} error={marketError} onSell={onSell} />;
  if (tab === "market") return <MarketPanel catalog={catalog} balance={snapshot.teams.find((item) => item.id === snapshot.teamId)?.balance ?? 0} busy={busy} error={marketError} onBuy={onBuy} />;
  return <TendersPanel tenders={tenders} stocks={snapshot.resources} quarter={snapshot.currentQuarter} busy={busy} onContribute={onContribute} />;
}

export function PlayerHome() {
  const { snapshot, error, loading, clockOffset, refresh } = useLobby("PLAYER");
  const [tab, setTab] = useState<Tab>("city");
  const [catalog, setCatalog] = useState<MarketObject[]>([]);
  const [offers, setOffers] = useState<ResourceOffer[]>([]);
  const [tenders, setTenders] = useState<Tender[]>([]);
  const [marketError, setMarketError] = useState("");
  const [buying, setBuying] = useState(false);
  const [contributing, setContributing] = useState(false);
  const [selling, setSelling] = useState(false);
  const [loanOpen, setLoanOpen] = useState(false);
  const [loanAmount, setLoanAmount] = useState(0);
  const [payingLoan, setPayingLoan] = useState(false);
  const pendingLoanPayment = useRef<{ fingerprint: string; key: string } | null>(null);
  const pendingPurchase = useRef<{ fingerprint: string; key: string } | null>(null);
  const pendingContribution = useRef<{ fingerprint: string; key: string } | null>(null);
  const pendingSale = useRef<{ fingerprint: string; key: string } | null>(null);
  const team = snapshot?.teams.find((item) => item.id === snapshot.teamId);
  useEffect(() => { if (snapshot?.disqualified) setTab("city"); }, [snapshot?.disqualified]);
  useEffect(() => {
    if (tab !== "assets" || !snapshot || snapshot.disqualified) return;
    const access = getAccess();
    if (!access) return;
    void api<ResourceOffer[]>("/market/resources", { token: access.token }).then(setOffers).catch((cause) => setMarketError(cause.message));
  }, [tab, snapshot?.sequence, snapshot?.disqualified]);
  useEffect(() => {
    if (tab !== "market" || !snapshot || snapshot.disqualified) return;
    const access = getAccess();
    if (!access) return;
    void api<MarketObject[]>("/market/catalog", { token: access.token }).then(setCatalog).catch((cause) => setMarketError(cause.message));
  }, [tab, snapshot?.sequence, snapshot?.disqualified]);
  useEffect(() => {
    if (tab !== "tenders" || !snapshot || snapshot.disqualified) return;
    const access = getAccess();
    if (!access) return;
    void api<Tender[]>("/tenders", { token: access.token }).then(setTenders).catch((cause) => setMarketError(cause.message));
  }, [tab, snapshot?.sequence, snapshot?.disqualified]);

  async function buy(object: MarketObject, quantity: number) {
    const access = getAccess();
    if (!access || buying || snapshot?.status !== "ACTIVE") { setMarketError("Покупки доступны во время матча"); return false; }
    const fingerprint = `${object.id}:${quantity}:${snapshot.teamId}`;
    if (pendingPurchase.current?.fingerprint !== fingerprint) pendingPurchase.current = { fingerprint, key: crypto.randomUUID() };
    setBuying(true);
    try {
      await api("/market/purchases", { method: "POST", token: access.token, body: { objectTypeId: object.id, quantity, idempotencyKey: pendingPurchase.current.key } });
      pendingPurchase.current = null;
      setMarketError("");
      await refresh();
      return true;
    } catch (cause) { setMarketError(cause instanceof Error ? cause.message : "Не удалось купить объект"); return false; }
    finally { setBuying(false); }
  }

  async function sell(offer: ResourceOffer, quantity: number) {
    const access = getAccess();
    if (!access || selling || snapshot?.status !== "ACTIVE") { setMarketError("Продажа доступна во время матча"); return false; }
    const fingerprint = `${offer.code}:${quantity}:${offer.currentUnitPrice}:${snapshot.teamId}`;
    if (pendingSale.current?.fingerprint !== fingerprint) pendingSale.current = { fingerprint, key: crypto.randomUUID() };
    setSelling(true);
    try {
      await api("/market/resources/sales", { method: "POST", token: access.token, body: { resourceCode: offer.code, quantity, expectedUnitPrice: offer.currentUnitPrice, idempotencyKey: pendingSale.current.key } });
      pendingSale.current = null;
      setMarketError("");
      await refresh();
      return true;
    } catch (cause) {
      setMarketError(cause instanceof Error ? cause.message : "Не удалось продать ресурс");
      void api<ResourceOffer[]>("/market/resources", { token: access.token }).then(setOffers).catch(() => {});
      return false;
    } finally { setSelling(false); }
  }

  async function contribute(tender: Tender, resourceCode: string, quantity: number) {
    const access = getAccess();
    if (!access || contributing) return false;
    const fingerprint = `${tender.id}:${resourceCode}:${quantity}:${snapshot?.teamId}`;
    if (pendingContribution.current?.fingerprint !== fingerprint) pendingContribution.current = { fingerprint, key: crypto.randomUUID() };
    setContributing(true);
    try {
      const updated = await api<Tender[]>(`/tenders/${tender.id}/contributions`, { method: "POST", token: access.token, body: { resourceCode, quantity, idempotencyKey: pendingContribution.current.key } });
      pendingContribution.current = null;
      setTenders(updated);
      setMarketError("");
      await refresh();
      return true;
    } catch (cause) { setMarketError(cause instanceof Error ? cause.message : "Не удалось внести ресурсы"); return false; }
    finally { setContributing(false); }
  }

  async function repayLoan() {
    const access = getAccess();
    const loan = snapshot?.loan;
    const balance = snapshot?.teams.find((item) => item.id === snapshot.teamId)?.balance ?? 0;
    if (!access || !loan || payingLoan || !Number.isInteger(loanAmount) || loanAmount < 1 || loanAmount > loan.remaining || loanAmount > balance) return;
    const fingerprint = `${loan.id}:${loanAmount}`;
    if (pendingLoanPayment.current?.fingerprint !== fingerprint) pendingLoanPayment.current = { fingerprint, key: crypto.randomUUID() };
    setPayingLoan(true);
    try {
      await api(`/bank/loans/${loan.id}/payments`, { method: "POST", token: access.token, body: { amount: loanAmount, idempotencyKey: pendingLoanPayment.current.key } });
      pendingLoanPayment.current = null;
      await refresh();
      setLoanOpen(false);
      setLoanAmount(0);
      setMarketError("");
    } catch (cause) { setMarketError(cause instanceof Error ? cause.message : "Не удалось погасить кредит"); }
    finally { setPayingLoan(false); }
  }

  if (!snapshot) return <main className="player-home player-home--message"><LobbyBrand /><p role={error ? "alert" : undefined}>{error || (loading ? "Загрузка сессии..." : "Нет данных сессии")}</p></main>;
  if (snapshot.status === "FINISHED") return <MatchResults snapshot={snapshot} />;
  if (snapshot.disqualified) return <main className="player-home player-home--message"><LobbyBrand /><p role="alert">Вы исключены из игры организатором.</p></main>;
  if (!team) return <main className="player-home player-home--message"><LobbyBrand /><p role="alert">Команда не найдена. Обновите страницу.</p></main>;
  const lastTransaction = snapshot.transactions?.[0];

  return <main className="player-home">
    <header className="player-header"><div className="player-header-copy"><LobbyBrand /><h1>{team.name}</h1></div><MatchTimer snapshot={snapshot} offset={clockOffset} /></header>
    <section className="player-balance" aria-label="Баланс команды"><span className="player-balance-icon"><Wallet size={23} fill="currentColor" strokeWidth={1.7} /></span><div className="player-balance-total"><small>Баланс</small><strong>{money.format(team.balance)} ₽</strong></div><div className="player-balance-metrics">{lastTransaction && <span className={lastTransaction.type === "deposit" ? "is-positive" : "is-negative"}>{lastTransaction.type === "deposit" ? "+" : "−"}{money.format(lastTransaction.amount)} ₽ <small>операция</small></span>}<span><Building2 size={13} />{team.assetsCount} {team.assetsCount === 1 ? "объект" : "объектов"}</span></div></section>
    {snapshot.loan && <button type="button" className="player-loan-action" onClick={() => { setLoanAmount(0); setLoanOpen(true); }}><Landmark size={19} /><span>Кредит · к погашению <strong>{money.format(snapshot.loan.remaining)} ₽</strong></span><span>Погасить</span></button>}
    {loanOpen && snapshot.loan && <div className="player-dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLoanOpen(false); }}><section className="player-dialog" role="dialog" aria-modal="true" aria-label="Погасить кредит"><button type="button" className="player-dialog-close" aria-label="Закрыть" onClick={() => setLoanOpen(false)}><X size={20} /></button><h2>Погашение кредита</h2><p>К погашению: <strong>{money.format(snapshot.loan.remaining)} ₽</strong></p><p>Начисленные проценты: {money.format(snapshot.loan.accruedInterest)} ₽ · На балансе: {money.format(team.balance)} ₽</p><label className="player-loan-amount">Сумма, ₽<input type="number" min={1} max={Math.min(snapshot.loan.remaining, team.balance)} step={1} value={loanAmount || ""} onChange={(event) => setLoanAmount(Number(event.target.value))} /></label><button type="button" className="player-loan-full" disabled={team.balance < snapshot.loan.remaining} onClick={() => setLoanAmount(snapshot.loan!.remaining)}>Погасить полностью</button><button type="button" className="player-buy" disabled={payingLoan || !Number.isInteger(loanAmount) || loanAmount < 1 || loanAmount > snapshot.loan.remaining || loanAmount > team.balance || snapshot.status !== "ACTIVE"} onClick={repayLoan}>{payingLoan ? "Проводим платёж..." : `Внести ${money.format(loanAmount)} ₽`}</button>{marketError && <p className="player-buy-error" role="alert">{marketError}</p>}</section></div>}
    {(error || marketError) && <p className="player-connection" role="status">{marketError || error}</p>}
    <TabContent tab={tab} snapshot={snapshot} catalog={catalog} offers={offers} tenders={tenders} busy={buying || selling || contributing} marketError={marketError} onBuy={buy} onSell={sell} onContribute={contribute} />
    <nav className="player-nav" aria-label="Разделы игры">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "is-active" : ""} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}><Icon size={20} strokeWidth={tab === id ? 2.6 : 2.1} /><span>{label}</span></button>)}</nav>
  </main>;
}
