"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeftRight, Building2, CalendarDays, Check, ChevronDown, ChevronRight, Clock3, Coins, Droplets, Factory, FileText, HardHat, House, Info, Landmark, Layers3, Mail, Map, Minus, Mountain, Package, PackageX, PieChart, Plus, Send, Trees, TrendingUp, Trophy, Wallet, X, Zap } from "lucide-react";
import { LobbyBrand } from "./lobby-brand";
import { useMatchClock, type LobbySnapshot } from "../../lib/lobby-client";
import "./player-home-preview.css";

type Tab = "city" | "assets" | "market" | "tenders" | "production";
const tabs: { id: Tab; label: string; icon: typeof Map }[] = [
  { id: "city", label: "Город", icon: Map },
  { id: "assets", label: "Активы", icon: Building2 },
  { id: "market", label: "Рынок", icon: TrendingUp },
  { id: "tenders", label: "Тендеры", icon: Landmark },
  { id: "production", label: "Производство", icon: Factory },
];
const money = new Intl.NumberFormat("ru-RU");
const resourceIcons = { Энергия: Zap, Газ: Droplets, Металл: Layers3, Дерево: Trees, Уголь: Mountain, Жильё: House };
type ResourceName = keyof typeof resourceIcons;
function ResourceIcon({ resource, size = 16 }: { resource: ResourceName; size?: number }) {
  const Icon = resourceIcons[resource];
  return <Icon className="preview-resource-icon" size={size} strokeWidth={2.2} aria-hidden="true" />;
}
function useScrollHint(itemCount: number) {
  const listRef = useRef<HTMLDivElement>(null);
  const [hasMore, setHasMore] = useState(false);
  const updateScrollHint = () => {
    const list = listRef.current;
    if (list) setHasMore(list.scrollHeight - list.scrollTop - list.clientHeight > 2);
  };
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const observer = new ResizeObserver(updateScrollHint);
    observer.observe(list);
    updateScrollHint();
    return () => observer.disconnect();
  }, [itemCount]);
  return { listRef, hasMore, updateScrollHint };
}
type PreviewAsset = { id: string; name: string; category: string; quantity: number; operating: boolean; resource: ResourceName; units: number; image: string; imageClass: string };
type MarketListing = Omit<PreviewAsset, "quantity" | "operating"> & { price: number; unitPrice: number; demand: string };
const demoAssets: PreviewAsset[] = [
  { id: "power", name: "ТЭЦ-1", category: "Энергетика", quantity: 1, operating: true, resource: "Энергия", units: 26, image: "/generated/building-energy.png", imageClass: "power" },
  { id: "housing", name: "Жилой комплекс", category: "Жильё", quantity: 2, operating: true, resource: "Жильё", units: 30, image: "/generated/building-housing.png", imageClass: "housing" },
  { id: "gas", name: "Газовый узел", category: "Газ", quantity: 1, operating: true, resource: "Газ", units: 24, image: "/generated/building-gas.png", imageClass: "gas" },
  { id: "metal", name: "Металлобаза", category: "Промышленность", quantity: 2, operating: false, resource: "Металл", units: 18, image: "/generated/building-metal.png", imageClass: "metal" },
];
const marketListings: MarketListing[] = [
  { id: "power", name: "ТЭЦ-1", category: "Энергетика", resource: "Энергия", units: 26, price: 24000, unitPrice: 60, demand: "Высокий", image: "/generated/building-energy.png", imageClass: "power" },
  { id: "gas", name: "Газовый узел", category: "Промышленность", resource: "Газ", units: 24, price: 21000, unitPrice: 80, demand: "Высокий", image: "/generated/building-gas.png", imageClass: "gas" },
  { id: "metal", name: "Металлобаза", category: "Промышленность", resource: "Металл", units: 18, price: 18000, unitPrice: 140, demand: "Средний", image: "/generated/building-metal.png", imageClass: "metal" },
  { id: "wood", name: "Лесопилка", category: "Производство", resource: "Дерево", units: 42, price: 16000, unitPrice: 20, demand: "Высокий", image: "/generated/building-wood.png", imageClass: "wood" },
  { id: "coal", name: "Угольный разрез", category: "Добыча", resource: "Уголь", units: 35, price: 17000, unitPrice: 55, demand: "Средний", image: "/generated/building-coal.png", imageClass: "coal" },
  { id: "housing", name: "Жилой комплекс", category: "Недвижимость", resource: "Жильё", units: 30, price: 32000, unitPrice: 15, demand: "Высокий", image: "/generated/building-housing.png", imageClass: "housing" },
];
const demoResources = [
  { name: "Энергия", amount: 26, tone: "energy" },
  { name: "Жильё", amount: 30, tone: "housing" },
  { name: "Газ", amount: 24, tone: "gas" },
  { name: "Металл", amount: 18, tone: "metal" },
  { name: "Дерево", amount: 42, tone: "wood" },
  { name: "Уголь", amount: 35, tone: "coal" },
] as const;
const resourcePrices: Record<ResourceName, number> = { Энергия: 60, Жильё: 15, Газ: 80, Металл: 140, Дерево: 20, Уголь: 55 };
const resourceOrder: ResourceName[] = ["Энергия", "Газ", "Уголь", "Металл", "Дерево", "Жильё"];
type CombinationInput = { kind: "resource"; name: ResourceName; amount: number } | { kind: "product"; name: string; amount: number };
type CombinationRecipe = { id: string; level: 2 | 3; title: string; image: string; inputs: [CombinationInput, CombinationInput] };
const combinationRecipes: CombinationRecipe[] = [
  { id: "comfort-housing", level: 2, title: "Комфортное жильё", image: "/generated/building-housing.png", inputs: [{ kind: "resource", name: "Жильё", amount: 10 }, { kind: "resource", name: "Энергия", amount: 5 }] },
  { id: "construction-parts", level: 2, title: "Строительные конструкции", image: "/generated/building-metal.png", inputs: [{ kind: "resource", name: "Дерево", amount: 10 }, { kind: "resource", name: "Металл", amount: 5 }] },
  { id: "heating", level: 2, title: "Теплоснабжение", image: "/generated/building-gas.png", inputs: [{ kind: "resource", name: "Газ", amount: 5 }, { kind: "resource", name: "Энергия", amount: 5 }] },
  { id: "steel", level: 2, title: "Промышленная сталь", image: "/generated/building-metal.png", inputs: [{ kind: "resource", name: "Уголь", amount: 5 }, { kind: "resource", name: "Металл", amount: 5 }] },
  { id: "processed-wood", level: 2, title: "Обработанная древесина", image: "/generated/building-wood.png", inputs: [{ kind: "resource", name: "Дерево", amount: 10 }, { kind: "resource", name: "Энергия", amount: 5 }] },
  { id: "electrical", level: 2, title: "Электрооборудование", image: "/generated/building-energy.png", inputs: [{ kind: "resource", name: "Металл", amount: 5 }, { kind: "resource", name: "Энергия", amount: 5 }] },
  { id: "fuel", level: 2, title: "Топливные брикеты", image: "/generated/building-coal.png", inputs: [{ kind: "resource", name: "Уголь", amount: 10 }, { kind: "resource", name: "Дерево", amount: 5 }] },
  { id: "gas-housing", level: 2, title: "Газифицированное жильё", image: "/generated/building-housing.png", inputs: [{ kind: "resource", name: "Жильё", amount: 10 }, { kind: "resource", name: "Газ", amount: 5 }] },
  { id: "smart-district", level: 3, title: "Умный жилой район", image: "/generated/building-housing.png", inputs: [{ kind: "product", name: "comfort-housing", amount: 1 }, { kind: "product", name: "electrical", amount: 1 }] },
  { id: "industrial-cluster", level: 3, title: "Индустриальный кластер", image: "/generated/building-metal.png", inputs: [{ kind: "product", name: "steel", amount: 1 }, { kind: "product", name: "electrical", amount: 1 }] },
  { id: "eco-quarter", level: 3, title: "Экоквартал", image: "/generated/building-wood.png", inputs: [{ kind: "product", name: "processed-wood", amount: 1 }, { kind: "product", name: "heating", amount: 1 }] },
  { id: "logistics-center", level: 3, title: "Логистический центр", image: "/generated/building-coal.png", inputs: [{ kind: "product", name: "construction-parts", amount: 1 }, { kind: "product", name: "fuel", amount: 1 }] },
];
type ContractPartner = { id: string; name: string; image: string; production: Record<ResourceName, number>; available: Record<ResourceName, number> };
const contractPartners: ContractPartner[] = [
  { id: "beta", name: "Команда Бета", image: "/generated/building-housing.png", production: { Энергия: 26, Газ: 24, Уголь: 35, Металл: 18, Дерево: 42, Жильё: 30 }, available: { Энергия: 14, Газ: 10, Уголь: 12, Металл: 8, Дерево: 18, Жильё: 9 } },
  { id: "gamma", name: "Команда Гамма", image: "/generated/building-energy.png", production: { Энергия: 52, Газ: 24, Уголь: 0, Металл: 18, Дерево: 0, Жильё: 30 }, available: { Энергия: 19, Газ: 6, Уголь: 0, Металл: 7, Дерево: 0, Жильё: 5 } },
  { id: "delta", name: "Команда Дельта", image: "/generated/building-metal.png", production: { Энергия: 0, Газ: 24, Уголь: 35, Металл: 36, Дерево: 42, Жильё: 0 }, available: { Энергия: 0, Газ: 8, Уголь: 16, Металл: 15, Дерево: 12, Жильё: 0 } },
];
type ContractStatus = "active" | "incoming" | "outgoing";
type PreviewContract = { id: string; partnerId: string; title: string; description: string; image: string; status: ContractStatus; give: ResourceName; giveAmount: number; receive: ResourceName; receiveAmount: number; share: number; quarters: number; elapsed?: number; endRequested?: boolean };
const demoContracts: PreviewContract[] = [
  { id: "incoming-beta", partnerId: "beta", title: "Жилой квартал", description: "Совместное производство жилья для развития города.", image: "/generated/building-housing.png", status: "incoming", give: "Металл", giveAmount: 8, receive: "Дерево", receiveAmount: 18, share: 60, quarters: 4 },
  { id: "active-gamma", partnerId: "gamma", title: "Энергетический узел", description: "Совместный выпуск энергии для городских объектов.", image: "/generated/building-energy.png", status: "active", give: "Газ", giveAmount: 10, receive: "Энергия", receiveAmount: 19, share: 50, quarters: 4, elapsed: 2 },
];
type TenderRequirement = { resource: ResourceName; collected: number; required: number; team: number };
type PreviewTender = { id: string; title: string; icon: typeof Zap; imageClass: string; deadline: string; requirements: TenderRequirement[] };
type TenderContributions = Record<string, Partial<Record<ResourceName, number>>>;
const demoTenders: PreviewTender[] = [
  { id: "energy", title: "Развитие энергетики", icon: Zap, imageClass: "energy", deadline: "2 квартала", requirements: [
    { resource: "Металл", collected: 60, required: 85, team: 12 },
    { resource: "Энергия", collected: 45, required: 65, team: 10 },
    { resource: "Дерево", collected: 30, required: 45, team: 5 },
    { resource: "Газ", collected: 25, required: 40, team: 8 },
    { resource: "Уголь", collected: 20, required: 30, team: 4 },
    { resource: "Жильё", collected: 15, required: 22, team: 3 },
  ] },
  { id: "housing", title: "Жилой комплекс", icon: House, imageClass: "housing", deadline: "1 квартал", requirements: [
    { resource: "Металл", collected: 18, required: 70, team: 4 },
    { resource: "Дерево", collected: 24, required: 60, team: 6 },
    { resource: "Энергия", collected: 12, required: 50, team: 2 },
    { resource: "Газ", collected: 9, required: 30, team: 2 },
    { resource: "Уголь", collected: 6, required: 20, team: 1 },
    { resource: "Жильё", collected: 12, required: 40, team: 3 },
  ] },
];
const demoSnapshot: LobbySnapshot = {
  sessionId: "preview", status: "ACTIVE", currentQuarter: 2, quarterDurationSec: 300,
  totalQuarters: 15, startsAt: null, serverTime: 0, sequence: 0, role: "PLAYER",
  stationType: null, participantId: "preview-player", teamId: "preview-team", disqualified: false,
  teams: [{ id: "preview-team", name: "Команда Альфа", code: "A314", color: "#087cff", avatar: 0, balance: 128000, assetsCount: 6, members: 2 }],
  stations: ["ENTERPRISES", "BANK", "MAYOR"].map((type) => ({ type, enabled: true, ready: true, assigned: true })),
  transactions: [{ id: "preview-transaction", teamId: "preview-team", type: "deposit", amount: 12500, createdAt: "" }],
};

function MatchTimer({ snapshot, offset }: { snapshot: LobbySnapshot; offset: number }) {
  const clock = useMatchClock(snapshot, offset);
  const progress = clock?.fraction ?? 1;
  return <div className="preview-player-timer" aria-label={`Квартал ${clock?.quarter ?? snapshot.currentQuarter} из ${snapshot.totalQuarters}, осталось ${clock?.text ?? "00:00"}`}>
    <svg viewBox="0 0 64 64" aria-hidden="true"><circle className="preview-player-timer-track" cx="32" cy="32" r="27" /><circle className="preview-player-timer-progress" cx="32" cy="32" r="27" style={{ strokeDasharray: `${progress * 169.65} 169.65` }} /></svg>
    <div className="preview-player-timer-label"><small>Квартал {clock?.quarter ?? snapshot.currentQuarter}/{snapshot.totalQuarters}</small><strong>{snapshot.status === "FINISHED" ? "00:00" : clock?.text ?? "00:00"}</strong></div>
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
  return <section className="preview-player-map" aria-label="Карта города"><div className="preview-player-map-art">
    <img className="preview-player-map-image" src="/generated/player-city-reference.png" alt="Изометрический город SKYLINE с промышленной гаванью, деловым центром и мэрией" />
    {pins.map((pin) => { const Icon = pin.icon; return <button key={pin.id} type="button" className={`preview-player-map-pin preview-player-map-pin--${pin.position} preview-player-map-pin--${pin.tone}${selected === pin.id ? " is-selected" : ""}`} onClick={() => setSelected(pin.id)} aria-label={`${pin.title}: ${pin.detail}`}>
      <span className="preview-player-map-pin-icon"><Icon size={13} strokeWidth={2.5} /></span><span><strong>{pin.title}</strong><small>{pin.detail}</small></span>
    </button>; })}
    {activePin && <div className="preview-player-map-detail" role="status"><div><strong>{activePin.title}</strong><span>{activePin.detail}</span></div><button type="button" title="Закрыть" aria-label="Закрыть" onClick={() => setSelected(null)}><X size={17} /></button></div>}
  </div>
  </section>;
}

function BalanceRow({ balance, teamName }: { balance: number; teamName: string }) {
  return <div className="preview-player-balance" aria-label={`Баланс команды ${teamName}`}><span className="preview-player-balance-icon"><Wallet size={27} fill="currentColor" strokeWidth={1.7} /></span><div className="preview-player-balance-total"><small>Баланс</small><strong>{money.format(balance)} ₽</strong></div></div>;
}

function PlayerOverview({ balance, teamName, purchases }: { balance: number; teamName: string; purchases: PreviewAsset[] }) {
  const assets = [...demoAssets, ...purchases];
  const buildingCount = assets.filter((asset) => !asset.operating).reduce((total, asset) => total + asset.quantity, 0);
  return <section className="preview-player-overview" aria-label="Баланс и объекты команды"><BalanceRow balance={balance} teamName={teamName} /><div className="preview-assets-summary">
    <div><span className="preview-assets-summary-value"><span className="preview-assets-summary-figure"><span className="preview-assets-summary-icon"><Building2 size={17} /></span><strong>{assets.reduce((total, asset) => total + asset.quantity, 0)}</strong></span><small>предприятий</small></span></div>
    <div><span className="preview-assets-summary-value"><span className="preview-assets-summary-figure"><span className="preview-assets-summary-icon"><PieChart size={17} /></span><strong>{new Set(assets.map((asset) => asset.category)).size}</strong></span><small>отрасли</small></span></div>
    <div><span className="preview-assets-summary-value"><span className="preview-assets-summary-figure"><span className="preview-assets-summary-icon"><HardHat size={17} /></span><strong>{buildingCount}</strong></span><small>строятся</small></span></div>
  </div></section>;
}

function AssetsPanel({ purchases, contributions, sales, spent, onSell }: { purchases: PreviewAsset[]; contributions: TenderContributions; sales: Partial<Record<ResourceName, number>>; spent: Partial<Record<ResourceName, number>>; onSell: (resource: ResourceName, quantity: number) => void }) {
  const [filter, setFilter] = useState<"all" | "operating" | "building">("all");
  const [selected, setSelected] = useState<PreviewAsset | null>(null);
  const [saleOpen, setSaleOpen] = useState(false);
  const [saleResource, setSaleResource] = useState<ResourceName>("Энергия");
  const [saleQuantity, setSaleQuantity] = useState(1);
  const assets = [...demoAssets, ...purchases];
  const yieldByResource = new globalThis.Map<ResourceName, number>();
  for (const asset of assets) if (asset.operating) yieldByResource.set(asset.resource, (yieldByResource.get(asset.resource) ?? 0) + asset.units * asset.quantity);
  const visible = assets.filter((asset) => filter === "all" || asset.operating === (filter === "operating"));
  const scrollHint = useScrollHint(visible.length);
  const available = (resource: ResourceName) => (demoResources.find((item) => item.name === resource)?.amount ?? 0) - Object.values(contributions).reduce((sum, tender) => sum + (tender[resource] ?? 0), 0) - (sales[resource] ?? 0) - (spent[resource] ?? 0);
  const saleMax = available(saleResource);
  const openSale = () => { setSaleResource(demoResources.find((item) => available(item.name) > 0)?.name ?? "Энергия"); setSaleQuantity(1); setSaleOpen(true); };
  return <section className="preview-assets" aria-label="Активы команды">
    <div className="preview-resources-heading"><h2 className="preview-resources-title">Ресурсы активов</h2><button type="button" className="preview-resource-sell" onClick={openSale} disabled={!demoResources.some((item) => available(item.name) > 0)}><Coins size={16} />Продать</button></div>
    <div className="preview-resources-grid">{demoResources.map(({ name, tone }) => { const yieldAmount = yieldByResource.get(name) ?? 0; return <div key={name} className={`preview-resource preview-resource--${tone}`}><ResourceIcon resource={name} size={21} /><span><small>{name}</small><strong>{available(name)} ед.</strong><small className={`preview-resource-yield${yieldAmount === 0 ? " is-zero" : ""}`}>{yieldAmount > 0 ? "+" : ""}{yieldAmount} ед./кв</small></span></div>; })}</div>
    <div className="preview-assets-heading"><h2>Ваши активы</h2><div className="preview-assets-filters" aria-label="Фильтр активов">{[["all", "Все"], ["operating", "Доходные"], ["building", "Строятся"]].map(([id, label]) => <button key={id} type="button" className={filter === id ? "is-active" : ""} aria-pressed={filter === id} onClick={() => setFilter(id as typeof filter)}>{label}</button>)}</div></div>
    <div className="preview-assets-list-wrap"><div ref={scrollHint.listRef} onScroll={scrollHint.updateScrollHint} className={`preview-assets-list${scrollHint.hasMore ? " has-more" : ""}`}>{visible.map((asset) => <button key={asset.id} type="button" className="preview-asset-row" onClick={() => setSelected(asset)}>
      <span className={`preview-asset-image preview-asset-image--${asset.imageClass}`} style={{ backgroundImage: `url(${asset.image})` }} />
      <span className="preview-asset-copy"><strong>{asset.name}{asset.quantity > 1 ? ` · ${asset.quantity} шт.` : ""}</strong><span><ResourceIcon resource={asset.resource} size={11} />{asset.category}</span><small className={asset.operating ? "is-operating" : "is-building"}>{asset.operating ? "Работает" : "Строится"} · {asset.units * asset.quantity} ед./кв</small></span>
      <ChevronRight size={15} aria-hidden="true" />
    </button>)}{!visible.length && <p className="preview-assets-empty">Построек пока нет</p>}</div>{scrollHint.hasMore && <span className="preview-scroll-more" aria-hidden="true"><ChevronDown size={15} /></span>}</div>
    {selected && <div className="preview-asset-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="preview-asset-dialog" role="dialog" aria-modal="true" aria-label={selected.name}>
      <button className="preview-asset-close" type="button" onClick={() => setSelected(null)} aria-label="Закрыть" title="Закрыть"><X size={18} /></button>
      <div className={`preview-asset-dialog-image preview-asset-image--${selected.imageClass}`} style={{ backgroundImage: `url(${selected.image})` }} />
      <h2>{selected.name}</h2><p>{selected.category} · {selected.quantity} {selected.quantity === 1 ? "постройка" : "постройки"}</p>
      <div className="preview-asset-dialog-yield"><span>Выпуск за квартал<br />{selected.units} ед. с постройки</span><strong>{selected.units * selected.quantity} ед. {selected.resource.toLowerCase()}</strong></div>
      <p className="preview-asset-dialog-status">{selected.operating ? "Работает и пополняет склад в конце квартала" : "Строится: выпуск начнётся со следующего квартала"}</p>
    </section></div>}
    {saleOpen && <div className="preview-asset-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSaleOpen(false); }}><section className="preview-asset-dialog preview-sale-dialog" role="dialog" aria-modal="true" aria-label="Продать ресурсы"><button className="preview-asset-close" type="button" onClick={() => setSaleOpen(false)} aria-label="Закрыть"><X size={18} /></button><h2>Продать ресурсы</h2><div className="preview-sale-choices">{demoResources.map(({ name }) => <button key={name} type="button" className={saleResource === name ? "is-active" : ""} disabled={available(name) <= 0} aria-pressed={saleResource === name} onClick={() => { setSaleResource(name); setSaleQuantity(1); }}><ResourceIcon resource={name} size={17} /><span>{name}<small>{available(name)} ед. · {money.format(resourcePrices[name])} ₽/ед.</small></span></button>)}</div><div className="preview-sale-quantity"><label htmlFor="preview-sale-amount">Количество</label><input id="preview-sale-amount" type="number" min={1} max={saleMax} value={saleQuantity} onChange={(event) => setSaleQuantity(Math.min(saleMax, Math.max(0, Number(event.target.value))))} /></div><input className="preview-sale-slider" type="range" aria-label="Количество для продажи" min={1} max={Math.max(1, saleMax)} value={Math.min(Math.max(1, saleQuantity), Math.max(1, saleMax))} onChange={(event) => setSaleQuantity(Number(event.target.value))} /><p>К зачислению: <strong>{money.format(saleQuantity * resourcePrices[saleResource])} ₽</strong></p><button type="button" className="preview-market-confirm" disabled={saleQuantity < 1 || saleQuantity > saleMax} onClick={() => { onSell(saleResource, saleQuantity); setSaleOpen(false); }}>Продать за {money.format(saleQuantity * resourcePrices[saleResource])} ₽</button></section></div>}
  </section>;
}

function MarketPanel({ balance, onBuy }: { balance: number; onBuy: (listing: MarketListing, quantity: number) => void }) {
  const [filter, setFilter] = useState("Все");
  const [selected, setSelected] = useState<MarketListing | null>(null);
  const [quantity, setQuantity] = useState(1);
  const visible = marketListings.filter((item) => filter === "Все" || item.resource === filter);
  const scrollHint = useScrollHint(visible.length);
  return <section className="preview-market" aria-label="Рынок построек">
    <div className="preview-market-rates" aria-label="Стоимость одной единицы ресурса"><h3>Цена за 1 ед. ресурса</h3><div>{marketListings.map((item) => <button type="button" key={item.id} className={filter === item.resource ? "is-active" : ""} aria-pressed={filter === item.resource} onClick={() => setFilter(filter === item.resource ? "Все" : item.resource)}><span className="preview-market-rate-label"><ResourceIcon resource={item.resource} size={19} /><small>{item.resource}</small></span><strong>{money.format(item.unitPrice)} ₽<span className="preview-market-unit">/ед.</span></strong></button>)}</div></div>
    <div className="preview-market-list-wrap"><div ref={scrollHint.listRef} onScroll={scrollHint.updateScrollHint} className={`preview-market-list${scrollHint.hasMore ? " has-more" : ""}`}>{visible.map((item) => <article className="preview-market-row" key={item.id}>
      <div className={`preview-market-image preview-asset-image--${item.imageClass}`} style={{ backgroundImage: `url(${item.image})` }} />
      <div className="preview-market-copy"><strong>{item.name}</strong><span><ResourceIcon resource={item.resource} size={16} />{item.resource}</span><small>+{item.units} ед./квартал</small></div>
      <div className="preview-market-price"><strong>{money.format(item.price)} ₽</strong><small>Спрос: {item.demand.toLowerCase()}</small></div>
      <button type="button" className="preview-market-buy" onClick={() => { setSelected(item); setQuantity(1); }}>Купить</button>
    </article>)}</div>{scrollHint.hasMore && <span className="preview-scroll-more" aria-hidden="true"><ChevronDown size={15} /></span>}</div>
    {selected && <div className="preview-asset-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="preview-asset-dialog preview-market-dialog" role="dialog" aria-modal="true" aria-label={`Покупка: ${selected.name}`}>
      <button className="preview-asset-close" type="button" onClick={() => setSelected(null)} aria-label="Закрыть" title="Закрыть"><X size={18} /></button>
      <div className={`preview-asset-dialog-image preview-asset-image--${selected.imageClass}`} style={{ backgroundImage: `url(${selected.image})` }} /><h2>{selected.name}</h2><p>{selected.resource}: +{selected.units} ед. с постройки за квартал</p><div className="preview-market-quantity"><span>Количество</span><div><button type="button" aria-label="Уменьшить количество" disabled={quantity === 1} onClick={() => setQuantity((value) => value - 1)}><Minus size={16} /></button><strong>{quantity}</strong><button type="button" aria-label="Увеличить количество" disabled={quantity === 10} onClick={() => setQuantity((value) => value + 1)}><Plus size={16} /></button></div></div><div className="preview-asset-dialog-yield"><span>Выпуск за квартал</span><strong>+{selected.units * quantity} ед.</strong></div><button type="button" className="preview-market-confirm" disabled={selected.price * quantity > balance} onClick={() => { onBuy(selected, quantity); setSelected(null); }}>Купить за {money.format(selected.price * quantity)} ₽</button>{selected.price * quantity > balance && <p className="preview-market-error">Недостаточно средств</p>}
    </section></div>}
  </section>;
}

function TenderProgress({ value, max, label, teamValue = 0 }: { value: number; max: number; label: string; teamValue?: number }) {
  const filledPercent = Math.min(100, value / max * 100);
  const teamPercent = Math.min(filledPercent, teamValue / max * 100);
  return <div className="preview-tender-track" role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={max} aria-valuetext={teamValue > 0 ? `${value} из ${max}, вклад команды ${teamValue}` : undefined}><span style={{ width: `${filledPercent - teamPercent}%` }} />{teamValue > 0 && <span className="is-team" style={{ width: `${teamPercent}%` }} />}</div>;
}

function TendersPanel({ contributions, sales, spent, onContribute }: { contributions: TenderContributions; sales: Partial<Record<ResourceName, number>>; spent: Partial<Record<ResourceName, number>>; onContribute: (tenderId: string, resource: ResourceName, quantity: number) => void }) {
  const [expandedId, setExpandedId] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedResource, setSelectedResource] = useState<ResourceName>("Металл");
  const [quantity, setQuantity] = useState(1);
  const [showHelp, setShowHelp] = useState(false);
  const scrollHint = useScrollHint(expandedId === "" ? 0 : expandedId === "energy" ? 1 : 2);
  const selectedTender = demoTenders.find((tender) => tender.id === selectedId);
  const selectedRequirement = selectedTender?.requirements.find((requirement) => requirement.resource === selectedResource);
  const available = (demoResources.find((resource) => resource.name === selectedResource)?.amount ?? 0) - Object.values(contributions).reduce((sum, donation) => sum + (donation[selectedResource] ?? 0), 0) - (sales[selectedResource] ?? 0) - (spent[selectedResource] ?? 0);
  const remaining = selectedRequirement ? selectedRequirement.required - selectedRequirement.collected - (contributions[selectedTender?.id ?? ""]?.[selectedResource] ?? 0) : 0;
  const maxContribution = Math.max(0, Math.min(available, remaining));
  const openContribution = (tender: PreviewTender) => { setSelectedId(tender.id); setSelectedResource(tender.requirements[0].resource); setQuantity(1); };
  const contribute = () => {
    if (!selectedTender || !Number.isInteger(quantity) || quantity < 1 || quantity > maxContribution) return;
    onContribute(selectedTender.id, selectedResource, quantity);
    setSelectedId(null);
  };
  return <section className="preview-tenders" aria-label="Активные тендеры">
    <div ref={scrollHint.listRef} onScroll={scrollHint.updateScrollHint} className={`preview-tenders-scroll${scrollHint.hasMore ? " has-more" : ""}`}>
      <div className="preview-tenders-heading"><h2>Активные тендеры</h2><button type="button" onClick={() => setShowHelp(true)}><Info size={14} />Как это работает?</button></div>
      <div className="preview-tenders-list">{demoTenders.map((tender) => {
        const total = tender.requirements.reduce((sum, item) => sum + item.required, 0);
        const collected = tender.requirements.reduce((sum, item) => sum + item.collected + (contributions[tender.id]?.[item.resource] ?? 0), 0);
        const percent = Math.round(collected / total * 100);
        const Icon = tender.icon;
        const expanded = expandedId === tender.id;
        return <article className={`preview-tender-card${expanded ? " is-expanded" : ""}`} key={tender.id}>
          <button type="button" className={`preview-tender-banner preview-tender-banner--${tender.imageClass}`} onClick={() => setExpandedId(expanded ? "" : tender.id)} aria-expanded={expanded}>
            <span className="preview-tender-deadline"><Clock3 size={12} />До конца: {tender.deadline}</span>
            <span className="preview-tender-banner-title"><span className="preview-tender-banner-icon"><Icon size={17} fill={tender.id === "energy" ? "currentColor" : "none"} /></span><strong>{tender.title}</strong><ChevronRight size={16} /></span>
          </button>
          <div className="preview-tender-overall"><span><strong>Общий прогресс</strong><b>{percent}%</b></span><TenderProgress value={collected} max={total} label={`${tender.title}: общий прогресс`} /></div>
          <div className="preview-tender-detail" aria-hidden={!expanded} inert={!expanded}>
            <div className="preview-tender-detail-inner"><div className="preview-tender-detail-content">
            <div className="preview-tender-table-heading"><strong>Требуемые ресурсы</strong><span>Собрано / Требуется</span></div>
            <div className="preview-tender-legend"><span><i className="is-other" />Другие команды</span><span><i className="is-team" />Команда Альфа</span></div>
            <div className="preview-tender-lines">{tender.requirements.map((item) => { const contributed = contributions[tender.id]?.[item.resource] ?? 0; return <div className="preview-tender-line" key={item.resource}><span><ResourceIcon resource={item.resource} size={14} />{item.resource}</span><TenderProgress value={item.collected + contributed} max={item.required} teamValue={item.team + contributed} label={`${item.resource}: собрано`} /><strong>{item.collected + contributed} / {item.required} ед.</strong></div>; })}</div>
            <div className="preview-tender-rewards"><span><Layers3 size={19} /><strong>125%</strong><small>стоимости вложенных ресурсов</small></span><span><Trophy size={19} /><small>Дополнительная премия при полном выполнении</small></span></div>
            <button type="button" className="preview-tender-contribute" disabled={percent >= 100} onClick={() => openContribution(tender)}>{percent >= 100 ? "Тендер выполнен" : "Внести ресурсы"}</button>
            </div></div>
          </div>
        </article>;
      })}</div>
    </div>
    {scrollHint.hasMore && <span className="preview-scroll-more" aria-hidden="true"><ChevronDown size={15} /></span>}
    {showHelp && <div className="preview-asset-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowHelp(false); }}><section className="preview-asset-dialog preview-tender-dialog" role="dialog" aria-modal="true" aria-label="Как работают тендеры"><button className="preview-asset-close" type="button" onClick={() => setShowHelp(false)} aria-label="Закрыть"><X size={18} /></button><h2>Как работают тендеры</h2><p>Команды вместе собирают ресурсы до срока завершения проекта.</p><div className="preview-tenders-rules"><div><PackageX size={21} /><span><strong>Ресурсы не возвращаются</strong><small>Внесённые единицы списываются со склада команды.</small></span></div><div><Clock3 size={21} /><span><strong>Выплата после срока</strong><small>Награда за вклад начисляется после завершения тендера.</small></span></div><div><Trophy size={21} /><span><strong>Бонус при полном выполнении</strong><small>Если собрать всё необходимое, команда получит дополнительную премию.</small></span></div></div></section></div>}
    {selectedTender && <div className="preview-asset-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedId(null); }}><form className="preview-asset-dialog preview-tender-dialog" role="dialog" aria-modal="true" aria-label={`Внести ресурсы: ${selectedTender.title}`} onSubmit={(event) => { event.preventDefault(); contribute(); }}><button className="preview-asset-close" type="button" onClick={() => setSelectedId(null)} aria-label="Закрыть"><X size={18} /></button><h2>Внести ресурсы</h2><p>{selectedTender.title}</p><label>Ресурс<select value={selectedResource} onChange={(event) => { setSelectedResource(event.target.value as ResourceName); setQuantity(1); }}>{selectedTender.requirements.map((item) => <option key={item.resource} value={item.resource}>{item.resource}</option>)}</select></label><label>Количество<input type="number" min={1} max={maxContribution} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} /></label><p>На складе: {available} ед. · Требуется ещё: {remaining} ед.</p><button className="preview-tender-contribute" type="submit" disabled={!Number.isInteger(quantity) || quantity < 1 || quantity > maxContribution}>Внести</button></form></div>}
  </section>;
}

function ContractCard({ contract, canAccept, onAccept, onRemove, onToggleEnd }: { contract: PreviewContract; canAccept: boolean; onAccept: () => void; onRemove: () => void; onToggleEnd: () => void }) {
  const partner = contractPartners.find((item) => item.id === contract.partnerId);
  const estimate = Math.round((contract.giveAmount * resourcePrices[contract.give] + contract.receiveAmount * resourcePrices[contract.receive]) * contract.share / 100);
  const statusLabel = contract.status === "active" ? "Активный контракт" : contract.status === "incoming" ? "Входящее предложение" : "Исходящее предложение";
  return <article className={`preview-contract-card preview-contract-card--${contract.status}`}>
    <div className="preview-contract-card-top"><span className="preview-contract-status">{contract.status === "incoming" ? <Mail size={14} /> : contract.status === "outgoing" ? <Send size={14} /> : <TrendingUp size={14} />}{statusLabel}</span><span className="preview-contract-time">{contract.status === "active" ? contract.endRequested ? "Завершится в конце кв." : `${contract.elapsed ?? 1}-й из ${contract.quarters} кв.` : contract.status === "incoming" ? "Новое" : "Ожидает ответа"}</span></div>
    <div className="preview-contract-card-head"><img src={contract.image} alt="" /><div><h4>{contract.title}</h4><span>Команда Альфа {contract.status === "incoming" ? "←" : contract.status === "outgoing" ? "→" : "×"} {partner?.name ?? "Команда"}</span><p>{contract.description}</p></div></div>
    <div className="preview-contract-swap"><div><small>Наша команда</small><span><ResourceIcon resource={contract.give} size={17} />{contract.give}<strong>{contract.giveAmount} ед.</strong></span></div><ArrowLeftRight size={18} /><div><small>{partner?.name ?? "Партнёр"}</small><span><ResourceIcon resource={contract.receive} size={17} />{contract.receive}<strong>{contract.receiveAmount} ед.</strong></span></div></div>
    <div className="preview-contract-facts"><div><PieChart size={16} /><span>Доли<strong>{contract.share}% / {100 - contract.share}%</strong></span></div><div><CalendarDays size={16} /><span>Срок<strong>{contract.quarters} кв.</strong></span></div><div title="Оценка по текущим ценам ресурсов"><Coins size={16} /><span>Оценка доли<strong>≈ {money.format(estimate)} ₽/кв.</strong></span></div></div>
    {contract.status === "active" && <div className="preview-contract-progress" aria-label={`Прошло ${contract.elapsed ?? 1} из ${contract.quarters} кварталов`}>{Array.from({ length: contract.quarters }, (_, index) => <span key={index} className={index < (contract.elapsed ?? 1) ? "is-complete" : ""} />)}</div>}
    {contract.status === "incoming" ? <div className="preview-contract-actions"><button type="button" className="is-primary" disabled={!canAccept} onClick={onAccept}><Check size={16} />Принять</button><button type="button" className="is-danger" onClick={onRemove}><X size={16} />Отклонить</button>{!canAccept && <small>Недостаточно ресурсов на складе для принятия.</small>}</div> : contract.status === "outgoing" ? <button type="button" className="preview-contract-secondary" onClick={onRemove}>Отозвать предложение</button> : <button type="button" className="preview-contract-secondary" onClick={onToggleEnd}>{contract.endRequested ? "Отменить запрос на завершение" : "Завершить в конце квартала"}</button>}
  </article>;
}

function CombinationCatalog({ stock, products, teamRequests, onStart, onTeamRequest }: { stock: (resource: ResourceName) => number; products: Record<string, number>; teamRequests: Record<string, string>; onStart: (recipe: CombinationRecipe) => boolean; onTeamRequest: (recipe: CombinationRecipe, partnerId: string) => void }) {
  const [level, setLevel] = useState<2 | 3>(2);
  const [selected, setSelected] = useState<CombinationRecipe | null>(null);
  const [mode, setMode] = useState<"self" | "team">("self");
  const [partnerId, setPartnerId] = useState(contractPartners[0].id);
  const inputName = (input: CombinationInput) => input.kind === "resource" ? input.name : combinationRecipes.find((recipe) => recipe.id === input.name)?.title ?? input.name;
  const inputStock = (input: CombinationInput) => input.kind === "resource" ? stock(input.name) : products[input.name] ?? 0;
  const batches = (recipe: CombinationRecipe) => Math.min(...recipe.inputs.map((input) => Math.floor(inputStock(input) / input.amount)));
  const open = (recipe: CombinationRecipe, nextMode: "self" | "team") => { setSelected(recipe); setMode(nextMode); setPartnerId(contractPartners[0].id); };
  return <section className="preview-combinations">
    <div className="preview-combinations-heading"><h2>Все объединения</h2></div>
    <div className="preview-combinations-levels" role="tablist" aria-label="Уровень объединения"><button type="button" role="tab" aria-selected={level === 2} className={level === 2 ? "is-active" : ""} onClick={() => setLevel(2)}>II уровень</button><button type="button" role="tab" aria-selected={level === 3} className={level === 3 ? "is-active" : ""} onClick={() => setLevel(3)}>III уровень</button></div>
    <div className="preview-combinations-scroll">{combinationRecipes.filter((recipe) => recipe.level === level).map((recipe) => { const canStart = batches(recipe) > 0; const missing = recipe.inputs.find((input) => inputStock(input) < input.amount); return <article key={recipe.id} className={`preview-combination-card${canStart ? "" : " is-unavailable"}`}>
      <div className="preview-combination-main"><img src={recipe.image} alt="" /><div><strong>{recipe.title}</strong><small>{recipe.inputs.map(inputName).join(" + ")}</small></div><span>{recipe.level} ур.</span></div>
      <div className="preview-combination-bottom"><div className="preview-combination-requirements"><div>{recipe.inputs.map((input, index) => <span key={input.name}>{index > 0 && <i>+</i>}{input.kind === "resource" ? <ResourceIcon resource={input.name} size={15} /> : <Package size={15} />}{inputName(input)} <b>{input.amount}</b></span>)}</div><small className={canStart ? "is-ready" : ""}>{canStart ? `Доступно: ${batches(recipe)} ${batches(recipe) === 1 ? "партия" : "партии"}` : missing ? `Не хватает: ${missing.amount - inputStock(missing)} ед. ${inputName(missing)}` : "Недоступно"}{(products[recipe.id] ?? 0) > 0 && ` · Готово: ${products[recipe.id]}`}{teamRequests[recipe.id] && ` · Запрос: ${contractPartners.find((item) => item.id === teamRequests[recipe.id])?.name}`}</small></div><div className="preview-combination-actions"><button type="button" className="is-self" disabled={!canStart} onClick={() => open(recipe, "self")}>Самостоятельно</button><button type="button" className="is-team" onClick={() => open(recipe, "team")}>С командой</button></div></div>
    </article>; })}</div>
    {selected && <div className="preview-asset-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="preview-asset-dialog preview-combination-dialog" role="dialog" aria-modal="true" aria-label={`${mode === "self" ? "Запустить" : "Предложить"}: ${selected.title}`}><button type="button" className="preview-asset-close" aria-label="Закрыть" onClick={() => setSelected(null)}><X size={18} /></button><h2>{selected.title}</h2><div className="preview-combination-dialog-inputs">{selected.inputs.map((input) => <div key={input.name}><span>{inputName(input)}</span><strong>{input.amount} ед.</strong></div>)}</div>{mode === "team" && <label>Команда<select value={partnerId} onChange={(event) => setPartnerId(event.target.value)}>{contractPartners.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<button type="button" className="preview-contracts-primary" onClick={() => { if (mode === "self") { if (onStart(selected)) setSelected(null); } else { onTeamRequest(selected, partnerId); setSelected(null); } }}>{mode === "self" ? "Запустить 1 партию" : "Отправить предложение"}</button></section></div>}
  </section>;
}

function ProductionResources({ production, stock, own = false }: { production: (resource: ResourceName) => number; stock: (resource: ResourceName) => number; own?: boolean }) {
  return <div className={`preview-production-grid${own ? " preview-production-grid--own" : " preview-production-grid--partner"}`}>
    {resourceOrder.map((resource, index) => <div key={resource} className={`preview-production-tile preview-production-tile--${index}${production(resource) === 0 && stock(resource) === 0 ? " is-zero" : ""}`}>
      <div className="preview-production-tile-name"><ResourceIcon resource={resource} size={18} /><strong>{resource}</strong></div>
      <div className="preview-production-tile-values"><span><small>В квартал</small><strong>{production(resource)}</strong></span><span><small>На складе</small><strong>{stock(resource)}</strong></span></div>
    </div>)}
  </div>;
}

function ContractsPanel({ contributions, sales, spent, products, teamRequests, offers, setOffers, onStartCombination, onTeamRequest }: { contributions: TenderContributions; sales: Partial<Record<ResourceName, number>>; spent: Partial<Record<ResourceName, number>>; products: Record<string, number>; teamRequests: Record<string, string>; offers: PreviewContract[]; setOffers: React.Dispatch<React.SetStateAction<PreviewContract[]>>; onStartCombination: (recipe: CombinationRecipe) => boolean; onTeamRequest: (recipe: CombinationRecipe, partnerId: string) => void }) {
  const [view, setView] = useState<"production" | "contracts" | "combinations">("combinations");
  const [status, setStatus] = useState<ContractStatus>("incoming");
  const [filter, setFilter] = useState<ResourceName | null>(null);
  const [expanded, setExpanded] = useState("beta");
  const [partnerId, setPartnerId] = useState<string | null>(null);
  const [give, setGive] = useState<ResourceName>("Дерево");
  const [giveAmount, setGiveAmount] = useState(1);
  const [receive, setReceive] = useState<ResourceName>("Металл");
  const [receiveAmount, setReceiveAmount] = useState(1);
  const [share, setShare] = useState(50);
  const [quarters, setQuarters] = useState(1);
  const [projectTitle, setProjectTitle] = useState("Совместное производство");
  const partner = contractPartners.find((item) => item.id === partnerId);
  const ownStock = (resource: ResourceName) => (demoResources.find((item) => item.name === resource)?.amount ?? 0)
    - Object.values(contributions).reduce((sum, donation) => sum + (donation[resource] ?? 0), 0) - (sales[resource] ?? 0) - (spent[resource] ?? 0);
  const ownProduction = (resource: ResourceName) => demoAssets.reduce((sum, asset) => sum + (asset.operating && asset.resource === resource ? asset.units * asset.quantity : 0), 0);
  const openOffer = (next: ContractPartner) => {
    setPartnerId(next.id);
    setGive("Дерево");
    setGiveAmount(1);
    setReceive("Металл");
    setReceiveAmount(1);
    setShare(50);
    setQuarters(1);
    setProjectTitle("Совместное производство");
  };
  const submitOffer = () => {
    if (!partner || !projectTitle.trim() || give === receive || !Number.isInteger(giveAmount) || !Number.isInteger(receiveAmount)
      || giveAmount < 1 || receiveAmount < 1 || giveAmount > ownStock(give)
      || receiveAmount > partner.available[receive]) return;
    setOffers((current) => [{ id: crypto.randomUUID(), partnerId: partner.id, title: projectTitle.trim(), description: "Совместный выпуск ресурсов для городских проектов.", image: partner.image, status: "outgoing", give, giveAmount, receive, receiveAmount, share, quarters }, ...current]);
    setPartnerId(null);
    setView("contracts");
    setStatus("outgoing");
  };
  const filteredPartners = contractPartners.filter((item) => !filter || item.production[filter] > 0);
  const visibleOffers = offers.filter((item) => item.status === status);
  const sectionTabs = <div className="preview-contracts-tabs" role="tablist" aria-label="Разделы производства">
    <button type="button" role="tab" aria-selected={view === "combinations"} className={view === "combinations" ? "is-active" : ""} onClick={() => setView("combinations")}><Package size={15} />Объединения</button>
    <button type="button" role="tab" aria-selected={view === "production"} className={view === "production" ? "is-active" : ""} onClick={() => setView("production")}><Building2 size={15} />Ресурсы</button>
    <button type="button" role="tab" aria-selected={view === "contracts"} className={view === "contracts" ? "is-active" : ""} onClick={() => setView("contracts")}><FileText size={15} />Контракты{offers.length > 0 && <b>{offers.length}</b>}</button>
  </div>;
  if (view === "combinations") return <section className="preview-contracts">{sectionTabs}<CombinationCatalog stock={ownStock} products={products} teamRequests={teamRequests} onStart={onStartCombination} onTeamRequest={onTeamRequest} /></section>;
  return <section className="preview-contracts">
    {sectionTabs}
    <div className="preview-contracts-scroll">
      {view === "production" ? <>
        <div className="preview-contracts-section-title"><h3>Ваша команда</h3></div>
        <ProductionResources own production={ownProduction} stock={ownStock} />
        <div className="preview-contracts-section-title"><h3>Команды</h3><span>{filteredPartners.length} из {contractPartners.length}</span></div>
        <div className="preview-contracts-filters" aria-label="Фильтр по ресурсу"><button type="button" className={!filter ? "is-active" : ""} aria-pressed={!filter} onClick={() => setFilter(null)}>Все</button>{resourceOrder.map((resource) => <button type="button" key={resource} className={filter === resource ? "is-active" : ""} aria-pressed={filter === resource} onClick={() => setFilter(resource)}><ResourceIcon resource={resource} size={14} />{resource}</button>)}</div>
        <div className="preview-contracts-partners">{filteredPartners.map((item) => { const isOpen = expanded === item.id; return <article key={item.id} className="preview-contracts-partner">
          <button type="button" className="preview-contracts-partner-head" aria-expanded={isOpen} onClick={() => setExpanded(isOpen ? "" : item.id)}><img src={item.image} alt="" /><span><strong>{item.name}</strong><small>{resourceOrder.filter((resource) => item.available[resource] > 0).length} ресурсов доступно</small></span><ChevronDown size={17} className={isOpen ? "is-open" : ""} /></button>
          {isOpen && <div className="preview-contracts-partner-body"><ProductionResources production={(resource) => item.production[resource]} stock={(resource) => item.available[resource]} /><button type="button" className="preview-contracts-primary" onClick={() => openOffer(item)}><ArrowLeftRight size={16} />Предложить контракт</button></div>}
        </article>; })}</div>
      </> : <>
        <div className="preview-contracts-section-title"><h3>Совместные проекты</h3><button type="button" onClick={() => setView("production")}>Новое предложение <ChevronRight size={14} /></button></div>
        <div className="preview-contract-status-tabs" role="tablist" aria-label="Статусы контрактов">{(["active", "incoming", "outgoing"] as const).map((item) => <button type="button" role="tab" key={item} aria-selected={status === item} className={status === item ? "is-active" : ""} onClick={() => setStatus(item)}>{item === "active" ? "Активные" : item === "incoming" ? "Входящие" : "Исходящие"}{offers.some((offer) => offer.status === item) && <b>{offers.filter((offer) => offer.status === item).length}</b>}</button>)}</div>
        {visibleOffers.length === 0 ? <div className="preview-contracts-empty"><FileText size={27} /><strong>{status === "active" ? "Активных контрактов нет" : status === "incoming" ? "Входящих предложений нет" : "Исходящих предложений нет"}</strong><span>{status === "outgoing" ? "Выберите команду и предложите обмен ресурсами." : "Новые контракты появятся здесь."}</span>{status === "outgoing" && <button type="button" onClick={() => setView("production")}>К командам</button>}</div> : <div className="preview-contracts-offers">{visibleOffers.map((offer) => <ContractCard key={offer.id} contract={offer} canAccept={ownStock(offer.give) >= offer.giveAmount} onAccept={() => { setOffers((current) => current.map((item) => item.id === offer.id ? { ...item, status: "active", elapsed: 1 } : item)); setStatus("active"); }} onRemove={() => setOffers((current) => current.filter((item) => item.id !== offer.id))} onToggleEnd={() => setOffers((current) => current.map((item) => item.id === offer.id ? { ...item, endRequested: !item.endRequested } : item))} />)}</div>}
      </>}
    </div>
    {partner && <div className="preview-asset-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPartnerId(null); }}><form className="preview-asset-dialog preview-contract-dialog" role="dialog" aria-modal="true" aria-label={`Предложить контракт: ${partner.name}`} onSubmit={(event) => { event.preventDefault(); submitOffer(); }}><button type="button" className="preview-asset-close" aria-label="Закрыть" onClick={() => setPartnerId(null)}><X size={18} /></button><h2>Предложение для {partner.name}</h2><label className="preview-contract-project">Название проекта<input type="text" maxLength={50} value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} /></label><div className="preview-contract-form-sides"><div><strong>Вы отдаёте</strong><label>Ресурс<select value={give} onChange={(event) => { const next = event.target.value as ResourceName; setGive(next); if (next === receive) setReceive(resourceOrder.find((resource) => resource !== next && partner.available[resource] > 0) ?? receive); setGiveAmount(1); }}>{resourceOrder.filter((resource) => ownStock(resource) > 0).map((resource) => <option key={resource} value={resource}>{resource}</option>)}</select></label><label>Количество<input type="number" min={1} max={ownStock(give)} value={giveAmount} onChange={(event) => setGiveAmount(Number(event.target.value))} /></label><small>На складе: {ownStock(give)} ед.</small></div><div><strong>{partner.name} отдаёт</strong><label>Ресурс<select value={receive} onChange={(event) => { setReceive(event.target.value as ResourceName); setReceiveAmount(1); }}>{resourceOrder.filter((resource) => resource !== give && partner.available[resource] > 0).map((resource) => <option key={resource} value={resource}>{resource}</option>)}</select></label><label>Количество<input type="number" min={1} max={partner.available[receive]} value={receiveAmount} onChange={(event) => setReceiveAmount(Number(event.target.value))} /></label><small>Доступно: {partner.available[receive]} ед.</small></div></div><div className="preview-contract-form-row"><label>Доля дохода вашей команды <strong>{share}%</strong><input type="range" min={10} max={90} step={5} value={share} onChange={(event) => setShare(Number(event.target.value))} /></label><span>Партнёр: {100 - share}%</span></div><label className="preview-contract-duration">Срок, кварталов<select value={quarters} onChange={(event) => setQuarters(Number(event.target.value))}>{[1, 2, 3, 4].map((count) => <option key={count} value={count}>{count}</option>)}</select></label><button type="submit" className="preview-contracts-primary" disabled={!projectTitle.trim() || give === receive || giveAmount < 1 || receiveAmount < 1 || !Number.isInteger(giveAmount) || !Number.isInteger(receiveAmount) || giveAmount > ownStock(give) || receiveAmount > partner.available[receive]}><Send size={16} />Отправить предложение</button></form></div>}
  </section>;
}

function TabContent({ tab, snapshot, purchases, balance, contributions, sales, spent, products, teamRequests, offers, setOffers, onContribute, onBuy, onSell, onStartCombination, onTeamRequest }: { tab: Tab; snapshot: LobbySnapshot; purchases: PreviewAsset[]; balance: number; contributions: TenderContributions; sales: Partial<Record<ResourceName, number>>; spent: Partial<Record<ResourceName, number>>; products: Record<string, number>; teamRequests: Record<string, string>; offers: PreviewContract[]; setOffers: React.Dispatch<React.SetStateAction<PreviewContract[]>>; onContribute: (tenderId: string, resource: ResourceName, quantity: number) => void; onBuy: (listing: MarketListing, quantity: number) => void; onSell: (resource: ResourceName, quantity: number) => void; onStartCombination: (recipe: CombinationRecipe) => boolean; onTeamRequest: (recipe: CombinationRecipe, partnerId: string) => void }) {
  if (tab === "city") return <City snapshot={snapshot} />;
  if (tab === "assets") return <AssetsPanel purchases={purchases} contributions={contributions} sales={sales} spent={spent} onSell={onSell} />;
  if (tab === "market") return <MarketPanel balance={balance} onBuy={onBuy} />;
  if (tab === "production") return <ContractsPanel contributions={contributions} sales={sales} spent={spent} products={products} teamRequests={teamRequests} offers={offers} setOffers={setOffers} onStartCombination={onStartCombination} onTeamRequest={onTeamRequest} />;
  return <TendersPanel contributions={contributions} sales={sales} spent={spent} onContribute={onContribute} />;
}

export function PlayerHomePreview() {
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("city");
  const [visibleTab, setVisibleTab] = useState<Tab>("city");
  const [tabLeaving, setTabLeaving] = useState(false);
  const tabTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [balance, setBalance] = useState(demoSnapshot.teams[0].balance);
  const [purchases, setPurchases] = useState<PreviewAsset[]>([]);
  const [contributions, setContributions] = useState<TenderContributions>({});
  const [sales, setSales] = useState<Partial<Record<ResourceName, number>>>({});
  const [spent, setSpent] = useState<Partial<Record<ResourceName, number>>>({});
  const [products, setProducts] = useState<Record<string, number>>({});
  const [teamRequests, setTeamRequests] = useState<Record<string, string>>({});
  const [offers, setOffers] = useState<PreviewContract[]>(demoContracts);
  useEffect(() => { setStartsAt(new Date(Date.now() - 466000).toISOString()); }, []);
  useEffect(() => () => { if (tabTimer.current) clearTimeout(tabTimer.current); }, []);
  const snapshot = { ...demoSnapshot, startsAt };
  const team = demoSnapshot.teams[0];
  const available = (resource: ResourceName) => (demoResources.find((item) => item.name === resource)?.amount ?? 0)
    - Object.values(contributions).reduce((sum, donation) => sum + (donation[resource] ?? 0), 0)
    - (sales[resource] ?? 0) - (spent[resource] ?? 0);
  const buy = (listing: MarketListing, quantity: number) => {
    const cost = listing.price * quantity;
    if (cost > balance) return;
    setBalance((value) => value - cost);
    setPurchases((items) => [...items, { ...listing, id: `${listing.id}-${items.length}`, quantity, operating: false }]);
  };
  const contribute = (tenderId: string, resource: ResourceName, quantity: number) => {
    if (quantity < 1 || quantity > available(resource)) return;
    setContributions((current) => ({ ...current, [tenderId]: { ...current[tenderId], [resource]: (current[tenderId]?.[resource] ?? 0) + quantity } }));
  };
  const sell = (resource: ResourceName, quantity: number) => {
    if (quantity < 1 || quantity > available(resource)) return;
    setSales((current) => ({ ...current, [resource]: (current[resource] ?? 0) + quantity }));
    setBalance((current) => current + quantity * resourcePrices[resource]);
  };
  const startCombination = (recipe: CombinationRecipe) => {
    if (recipe.inputs.some((input) => (input.kind === "resource" ? available(input.name) : products[input.name] ?? 0) < input.amount)) return false;
    setSpent((current) => {
      const next = { ...current };
      recipe.inputs.forEach((input) => { if (input.kind === "resource") next[input.name] = (next[input.name] ?? 0) + input.amount; });
      return next;
    });
    setProducts((current) => {
      const next = { ...current, [recipe.id]: (current[recipe.id] ?? 0) + 1 };
      recipe.inputs.forEach((input) => { if (input.kind === "product") next[input.name] = (next[input.name] ?? 0) - input.amount; });
      return next;
    });
    return true;
  };
  const switchTab = (next: Tab) => {
    if (tabTimer.current) clearTimeout(tabTimer.current);
    setTab(next);
    if (next === visibleTab || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setVisibleTab(next);
      setTabLeaving(false);
      return;
    }
    setTabLeaving(true);
    tabTimer.current = setTimeout(() => {
      setVisibleTab(next);
      setTabLeaving(false);
      tabTimer.current = null;
    }, 140);
  };

  return <main className="preview-player-home">
    <header className="preview-player-header"><div className="preview-player-header-copy"><LobbyBrand /></div><strong className="preview-player-header-team" title={team.name}>{team.name}</strong><MatchTimer snapshot={snapshot} offset={0} /></header>
    <PlayerOverview balance={balance} teamName={team.name} purchases={purchases} />
    <div key={visibleTab} className={`preview-player-view${tabLeaving ? " is-leaving" : ""}`} aria-hidden={tabLeaving} inert={tabLeaving}><TabContent tab={visibleTab} snapshot={snapshot} purchases={purchases} balance={balance} contributions={contributions} sales={sales} spent={spent} products={products} teamRequests={teamRequests} offers={offers} setOffers={setOffers} onContribute={contribute} onBuy={buy} onSell={sell} onStartCombination={startCombination} onTeamRequest={(recipe, partnerId) => setTeamRequests((current) => ({ ...current, [recipe.id]: partnerId }))} /></div>
    <nav className="preview-player-nav" aria-label="Разделы игры">{tabs.map(({ id, label, icon: Icon }) => <button key={id} className={tab === id ? "is-active" : ""} type="button" aria-current={tab === id ? "page" : undefined} onClick={() => switchTab(id)}><Icon size={20} strokeWidth={tab === id ? 2.6 : 2.1} /><span>{label}</span></button>)}</nav>
  </main>;
}
