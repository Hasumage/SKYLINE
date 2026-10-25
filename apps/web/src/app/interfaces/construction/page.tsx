"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Building2,
  Check,
  ChevronRight,
  Droplets,
  HardHat,
  House,
  Layers3,
  Mountain,
  Search,
  Trees,
  X,
  Zap,
} from "lucide-react";
import { AtmScaleFrame } from "../../../components/skyline/atm-scale-frame";
import { api, getAccess, useLobby, useMatchClock } from "../../../lib/lobby-client";
import { MatchResults } from "../../../components/skyline/match-results";
import "./construction.css";

type Team = {
  id: string;
  name: string;
  balance: number;
  tone: string;
  buildings: Record<string, number>;
};
type Building = {
  id: string;
  name: string;
  basePrice: number;
  priceStep: number;
  currentPrice?: number;
  initialBuilt: number;
  image: string;
  resource: string;
  units: number;
};
type View = "catalog" | "form";

const initialTeams: Team[] = [
  {
    id: "alpha",
    name: "Команда Альфа",
    balance: 25000,
    tone: "blue",
    buildings: {},
  },
  {
    id: "beta",
    name: "Команда Бета",
    balance: 40000,
    tone: "violet",
    buildings: { housing: 1 },
  },
  {
    id: "gamma",
    name: "Команда Гамма",
    balance: 37500,
    tone: "green",
    buildings: {},
  },
  {
    id: "delta",
    name: "Команда Дельта",
    balance: 50000,
    tone: "orange",
    buildings: { energy: 2 },
  },
  {
    id: "epsilon",
    name: "Команда Эпсилон",
    balance: 30000,
    tone: "rose",
    buildings: {},
  },
  {
    id: "zeta",
    name: "Команда Зета",
    balance: 20000,
    tone: "cyan",
    buildings: { metal: 1 },
  },
  {
    id: "eta",
    name: "Команда Эта",
    balance: 25000,
    tone: "amber",
    buildings: {},
  },
  {
    id: "theta",
    name: "Команда Тета",
    balance: 35000,
    tone: "sky",
    buildings: {},
  },
];

const demoBuildings: Building[] = [
  {
    id: "housing",
    name: "Жильё",
    basePrice: 2000,
    priceStep: 250,
    initialBuilt: 12,
    image: "/generated/building-housing.png",
    resource: "Жильё",
    units: 30,
  },
  {
    id: "energy",
    name: "Электростанция",
    basePrice: 7000,
    priceStep: 500,
    initialBuilt: 6,
    image: "/generated/building-energy.png",
    resource: "Энергия",
    units: 26,
  },
  {
    id: "gas",
    name: "Газовый объект",
    basePrice: 9000,
    priceStep: 500,
    initialBuilt: 7,
    image: "/generated/building-gas.png",
    resource: "Газ",
    units: 24,
  },
  {
    id: "metal",
    name: "Металлургия",
    basePrice: 12000,
    priceStep: 1000,
    initialBuilt: 3,
    image: "/generated/building-metal.png",
    resource: "Металл",
    units: 18,
  },
  {
    id: "wood",
    name: "Деревообработка",
    basePrice: 4000,
    priceStep: 500,
    initialBuilt: 7,
    image: "/generated/building-wood.png",
    resource: "Дерево",
    units: 42,
  },
  {
    id: "coal",
    name: "Угольный объект",
    basePrice: 10000,
    priceStep: 500,
    initialBuilt: 5,
    image: "/generated/building-coal.png",
    resource: "Уголь",
    units: 35,
  },
];

const resourceFilters = [
  { name: "Все", icon: Building2, tone: "all" },
  { name: "Жильё", icon: House, tone: "housing" },
  { name: "Энергия", icon: Zap, tone: "energy" },
  { name: "Газ", icon: Droplets, tone: "gas" },
  { name: "Металл", icon: Layers3, tone: "metal" },
  { name: "Дерево", icon: Trees, tone: "wood" },
  { name: "Уголь", icon: Mountain, tone: "coal" },
];

const tones: Record<string, { tile: string; icon: string; bar: string }> = {
  blue: {
    tile: "from-blue-50 to-sky-100",
    icon: "from-sky-400 to-blue-700",
    bar: "bg-blue-600",
  },
  violet: {
    tile: "from-violet-50 to-purple-100",
    icon: "from-violet-400 to-purple-700",
    bar: "bg-violet-600",
  },
  green: {
    tile: "from-emerald-50 to-green-100",
    icon: "from-emerald-400 to-green-700",
    bar: "bg-emerald-600",
  },
  orange: {
    tile: "from-orange-50 to-amber-100",
    icon: "from-orange-400 to-orange-700",
    bar: "bg-orange-500",
  },
  rose: {
    tile: "from-rose-50 to-pink-100",
    icon: "from-rose-400 to-rose-700",
    bar: "bg-rose-500",
  },
  cyan: {
    tile: "from-cyan-50 to-cyan-100",
    icon: "from-cyan-400 to-cyan-700",
    bar: "bg-cyan-600",
  },
  amber: {
    tile: "from-amber-50 to-yellow-100",
    icon: "from-amber-400 to-amber-700",
    bar: "bg-amber-500",
  },
  sky: {
    tile: "from-sky-50 to-blue-100",
    icon: "from-sky-400 to-blue-600",
    bar: "bg-sky-600",
  },
};

const money = (value: number) =>
  `${new Intl.NumberFormat("ru-RU").format(value).replace(/[\u00a0\u202f]/g, " ")} ₽`;
const formatNumber = (value: number) =>
  new Intl.NumberFormat("ru-RU").format(value).replace(/[\u00a0\u202f]/g, " ");
const parseNumber = (value: string) => Number(value.replace(/\D/g, "")) || 0;

function SkylineLogo() {
  return (
    <div className="flex items-end gap-[2px]">
      {[28, 54, 72, 44].map((height, index) => (
        <div
          key={height}
          className="w-[14px] rounded-t-[4px] bg-gradient-to-b from-cyan-300 to-blue-700 shadow-[0_12px_24px_rgba(0,117,255,0.22)]"
          style={{ height, marginBottom: index === 0 || index === 3 ? 0 : 6 }}
        />
      ))}
      <div className="ml-[-60px] h-[8px] w-[92px] rounded-full bg-blue-600" />
    </div>
  );
}

function TeamIcon({ tone }: { tone: string }) {
  return (
    <div
      className={`grid size-[82px] place-items-center rounded-[12px] bg-gradient-to-br ${tones[tone].tile}`}
    >
      <div className="flex h-[54px] items-end gap-[4px]">
        {[24, 40, 56, 32].map((height) => (
          <div
            key={height}
            className={`w-[10px] rounded-t-[3px] bg-gradient-to-b ${tones[tone].icon}`}
            style={{ height }}
          />
        ))}
      </div>
    </div>
  );
}

function BuildingArt({ building }: { building: Building }) {
  return (
    <span
      className={`construction-building-art${building.image ? "" : " construction-building-art--generic"}`}
      role="img"
      aria-label={building.name}
      style={{
        backgroundImage: building.image ? `url('${building.image}')` : undefined,
      }}
    >
      {!building.image && <Building2 aria-hidden="true" />}
    </span>
  );
}

export default function ConstructionInterfacePage() {
  const { snapshot, clockOffset, refresh } = useLobby("STAFF");
  const clock = useMatchClock(snapshot, clockOffset);
  const live = snapshot?.stationType === "CONSTRUCTION";
  const [demoTeams, setDemoTeams] = useState(initialTeams);
  const [catalog, setCatalog] = useState<{ id: string; code: string; category: string; currentPrice: number; builtCount: number; yields: { code: string; label: string; unitsPerQuarter: number; currentUnitPrice: number }[] }[]>([]);
  const [busy, setBusy] = useState(false);
  const pendingPurchase = useRef<{ fingerprint: string; key: string } | null>(null);
  const teams: Team[] = live ? snapshot.teams.map((item, index) => ({ id: item.id, name: item.name, balance: item.balance, tone: initialTeams[index % initialTeams.length].tone, buildings: Object.fromEntries(Object.entries(item.buildings ?? {}).map(([code, count]) => [catalog.find((object) => object.code === code)?.id ?? code.toLowerCase(), count])) })) : demoTeams;
  const buildings: Building[] = live && catalog.length ? catalog.map((item) => {
    const template = demoBuildings.find((building) => building.id === item.code.toLowerCase());
    const resourceTemplate = demoBuildings.find((building) => building.resource === item.yields[0]?.label);
    return {
      ...(template ?? resourceTemplate ?? demoBuildings[0]),
      id: item.id,
      name: template?.name ?? item.category,
      image: template?.image ?? resourceTemplate?.image ?? "",
      currentPrice: item.currentPrice,
      basePrice: 0,
      priceStep: 0,
      initialBuilt: item.builtCount,
      resource: item.yields[0]?.label ?? template?.resource ?? item.category,
      units: item.yields[0]?.unitsPerQuarter ?? template?.units ?? 0,
    };
  }) : demoBuildings;
  const [selectedTeamId, setSelectedTeamId] = useState("alpha");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("catalog");
  const [selectedBuildingId, setSelectedBuildingId] = useState("housing");
  const [demoBuiltCounts, setDemoBuiltCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(demoBuildings.map((item) => [item.id, item.initialBuilt])),
  );
  const builtCounts = live ? Object.fromEntries(buildings.map((item) => [item.id, item.initialBuilt])) : demoBuiltCounts;
  const [quantityInput, setQuantityInput] = useState("1");
  const [customPrice, setCustomPrice] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [resourceFilter, setResourceFilter] = useState("Все");
  const [catalogFilter, setCatalogFilter] = useState("Все");

  useEffect(() => {
    if (!live) return;
    const access = getAccess();
    if (!access) return;
    void api<typeof catalog>("/construction/catalog", { token: access.token }).then(setCatalog).catch((error) => setNotice(error.message));
  }, [live, snapshot?.sequence]);

  useEffect(() => {
    if (live && snapshot.teams.length && !snapshot.teams.some((item) => item.id === selectedTeamId)) setSelectedTeamId(snapshot.teams[0].id);
  }, [live, snapshot?.teams, selectedTeamId]);

  useEffect(() => {
    if (live && catalog.length && !catalog.some((item) => item.id === selectedBuildingId)) setSelectedBuildingId(catalog[0].id);
  }, [live, catalog, selectedBuildingId]);

  useEffect(() => {
    if (!pickerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPickerOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [pickerOpen]);

  const team = teams.find((item) => item.id === selectedTeamId) ?? teams[0] ?? initialTeams[0];
  const building =
    buildings.find((item) => item.id === selectedBuildingId) ?? buildings[0];
  const visibleTeams = useMemo(
    () =>
      teams.filter((item) =>
        item.name
          .toLocaleLowerCase("ru")
          .includes(search.trim().toLocaleLowerCase("ru")),
      ),
    [teams, search],
  );
  const marketPrice =
    building.currentPrice ?? building.basePrice +
    (builtCounts[building.id] ?? building.initialBuilt) * building.priceStep;
  const unitPrice =
    customPrice === null ? marketPrice : parseNumber(customPrice);
  const quantity = Number(quantityInput);
  const total = unitPrice * quantity;
  const validDeal =
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    quantity <= 100 &&
    Number.isInteger(unitPrice) &&
    unitPrice > 0 &&
    unitPrice <= 1000000 &&
    Number.isSafeInteger(total) &&
    total % 500 === 0;

  function selectBuilding(id: string) {
    setSelectedBuildingId(id);
    setCustomPrice(null);
    setQuantityInput("1");
    setNotice("");
    setView("form");
    setPickerOpen(false);
  }

  async function confirm() {
    if (!validDeal || busy) return;
    if (live) {
      if (snapshot.status !== "ACTIVE") { setNotice("Дождитесь начала матча"); return; }
      if (!snapshot.teams.some((item) => item.id === team.id)) { setNotice("Выберите команду"); return; }
      const access = getAccess();
      if (!access || !catalog.some((item) => item.id === building.id)) return;
      const fingerprint = `${team.id}:${building.id}:${quantity}:${unitPrice}`;
      if (pendingPurchase.current?.fingerprint !== fingerprint) pendingPurchase.current = { fingerprint, key: crypto.randomUUID() };
      setBusy(true);
      try {
        await api("/construction/purchases", { method: "POST", token: access.token, body: { teamId: team.id, objectTypeId: building.id, quantity, unitPrice, idempotencyKey: pendingPurchase.current.key } });
        pendingPurchase.current = null;
        await refresh();
        setNotice(`${team.name}: построено ${quantity} × ${building.name.toLowerCase()}, получено наличными ${money(total)}`);
        setCustomPrice(null);
        setQuantityInput("1");
      } catch (error) { setNotice(error instanceof Error ? error.message : "Не удалось оформить строительство"); }
      finally { setBusy(false); }
      return;
    }
    setDemoTeams((current) =>
      current.map((item) =>
        item.id === team.id
          ? {
              ...item,
              buildings: {
                ...item.buildings,
                [building.id]: (item.buildings[building.id] ?? 0) + quantity,
              },
            }
          : item,
      ),
    );
    setDemoBuiltCounts((current) => ({
      ...current,
      [building.id]: (current[building.id] ?? building.initialBuilt) + quantity,
    }));
    setNotice(
      `${team.name}: построено ${quantity} × ${building.name.toLowerCase()}, получено наличными ${money(total)}`,
    );
    setCustomPrice(null);
    setQuantityInput("1");
  }

  if (snapshot?.status === "FINISHED") return <MatchResults snapshot={snapshot} />;
  return (
    <main className="flex min-h-screen justify-center overflow-auto bg-[#f5fbff] p-4 text-[#05072c]">
      <AtmScaleFrame>
        <header className="relative h-[136px] border-b border-[#d8e7f5] bg-white">
          <div className="flex h-full items-center px-[48px]">
            <div className="flex items-center gap-[18px]">
              <SkylineLogo />
              <div className="text-[54px] font-black leading-none tracking-[-0.04em]">
                SKYLINE
              </div>
            </div>
            <div className="ml-[30px] h-[80px] w-px bg-[#cbdcf0]" />
            <div className="ml-[40px]">
              <h1 className="text-[42px] font-black leading-[42px] tracking-[-0.04em]">
                Строительство
              </h1>
              <p className="mt-[10px] text-[28px] font-medium leading-none text-[#3d59bf]">
                {view === "catalog" ? "Панель игротеха" : "Создание объекта"}
              </p>
            </div>
          </div>
          <div className="absolute right-[46px] top-[6px] grid size-[124px] place-items-center rounded-full border-[11px] border-[#e4edf9] border-t-[#0b7cff] border-r-[#0b7cff] bg-white text-center shadow-[0_10px_24px_rgba(21,72,156,0.1)]">
            <div>
              <p className="text-[13px] leading-none text-[#294ab5]">
                Квартал {live ? clock?.quarter ?? snapshot.currentQuarter : 2}
              </p>
              <p className="mt-[6px] text-[24px] font-black leading-none">
                {live ? clock?.text ?? "00:00" : "02:14"}
              </p>
            </div>
          </div>
        </header>
        <section className="grid grid-cols-[416px_minmax(0,1fr)] gap-[14px] px-[30px] pt-[28px]">
          <aside
            className="h-[858px] overflow-hidden rounded-[14px] border border-[#d8e7f5] bg-white px-[16px] py-[16px]"
            aria-label="Команды"
          >
            <label className="flex h-[56px] items-center gap-[14px] rounded-[12px] bg-[#eef6ff] px-[16px] text-[22px] text-[#4b5fba]">
              <Search className="size-[28px] shrink-0" strokeWidth={2.5} />
              <input
                className="min-w-0 flex-1 bg-transparent text-[22px] leading-none text-[#4b5fba] outline-none placeholder:text-[#4b5fba]"
                placeholder="Поиск команды..."
                aria-label="Поиск команды"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <div className="mt-[16px] h-[750px] overflow-y-auto">
              {visibleTeams.length ? (
                visibleTeams.map((item) => (
                  <button
                    key={item.id}
                    className={`group relative flex h-[91px] w-full cursor-pointer items-center border-b border-[#dce8f6] text-left transition-colors hover:rounded-[12px] hover:bg-[#eef8ff] ${item.id === team.id ? "rounded-[12px] border-b-0 bg-[#eaf6ff]" : ""}`}
                    type="button"
                    onClick={() => {
                      setSelectedTeamId(item.id);
                      setCustomPrice(null);
                      setQuantityInput("1");
                      setNotice("");
                    }}
                    aria-current={item.id === team.id ? "true" : undefined}
                  >
                    {item.id === team.id && (
                      <span
                        className={`absolute -left-[16px] top-[5px] h-[81px] w-[7px] rounded-full ${tones[item.tone].bar}`}
                      />
                    )}
                    <span className="ml-[16px]">
                      <TeamIcon tone={item.tone} />
                    </span>
                    <span className="ml-[18px] min-w-0 flex-1">
                      <strong className="block truncate text-[22px] font-black leading-none">
                        {item.name}
                      </strong>
                      <small className="mt-[7px] block truncate text-[18px] leading-none text-[#006dff]">
                        {money(item.balance)}
                      </small>
                    </span>
                    <ChevronRight
                      className="mr-[12px] size-[34px] shrink-0 text-[#4057b7]"
                      strokeWidth={2.4}
                    />
                  </button>
                ))
              ) : (
                <p className="px-[16px] py-[24px] text-[20px] text-[#5267a4]">
                  Команды не найдены
                </p>
              )}
            </div>
          </aside>

          <section
            className="h-[858px] overflow-hidden rounded-[14px] border border-[#d8e7f5] bg-white px-[25px] pt-[22px]"
            aria-label="Строительство команды"
          >
            {notice && (
              <div role="status" className="mb-[16px] flex items-start gap-[10px] rounded-[9px] bg-[#e7f9ef] p-[13px] text-[18px] text-[#087f48]">
                <Check className="size-[24px] shrink-0" />
                {notice}
              </div>
            )}
            {view === "catalog" ? (
              <>
                <div className="construction-resource-panel">
                  <h2>Тип ресурса</h2>
                  <nav className="construction-picker-filters construction-catalog-filters" aria-label="Фильтр каталога по типу ресурса">
                    {resourceFilters.map(({ name, icon: Icon, tone }) => <button key={name} type="button" data-tone={tone} className={catalogFilter === name ? "is-active" : ""} aria-pressed={catalogFilter === name} onClick={() => setCatalogFilter(name)}><Icon size={24} /><span>{name}</span></button>)}
                  </nav>
                </div>
                <h3 className="text-[27px] font-black">
                  Каталог объектов
                </h3>
                <div className="construction-catalog mt-[15px] grid grid-cols-2 gap-[12px]">
                  {buildings.filter((item) => catalogFilter === "Все" || item.resource === catalogFilter).map((item) => {
                    const price = item.currentPrice ?? item.basePrice +
                      (builtCounts[item.id] ?? item.initialBuilt) * item.priceStep;
                    return (
                      <button
                        type="button"
                        key={item.id}
                        className="construction-catalog-item flex min-w-0 items-center gap-[14px] rounded-[10px] border border-[#dce8f6] bg-white px-[12px] text-left hover:border-[#8cbfff] hover:bg-[#f3f9ff]"
                        onClick={() => selectBuilding(item.id)}
                      >
                        <BuildingArt building={item} />
                        <span className="min-w-0">
                          <strong className="block text-[21px] font-black leading-tight">
                            {item.name}
                          </strong>
                          <b className="mt-[6px] block text-[23px]">
                            {money(price)}
                          </b>
                          <small className="mt-[6px] block text-[16px] text-[#5267a4]">
                            Построено всеми: {builtCounts[item.id]}
                          </small>
                          <small className="block text-[16px] font-bold text-[#168b55]">
                            +{item.units} ед. {item.resource.toLowerCase()}/кв.
                          </small>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="mx-auto max-w-[740px]">
                <div className="flex items-center gap-[20px]">
                  <button type="button" className="flex items-center gap-[7px] text-[19px] font-bold text-[#087cff]" onClick={() => setView("catalog")}>
                    <ArrowLeft className="size-[24px]" /> Каталог объектов
                  </button>
                  <h2 className="text-[27px] font-black">Новый объект · {team.name}</h2>
                </div>
                <div className="construction-form mt-[13px] grid gap-[10px]">
                  <div className="construction-type-picker">
                    <span>Тип объекта</span>
                    <button className="construction-selected-type" type="button" onClick={() => { setResourceFilter("Все"); setPickerOpen(true); }} aria-label={`Выбрать тип объекта. Сейчас: ${building.name}`}>
                      <BuildingArt building={building} />
                      <span className="construction-selected-type-copy"><strong>{building.name}</strong><small>+{building.units} ед. {building.resource.toLowerCase()} за квартал</small></span>
                      <span className="construction-selected-type-action">Изменить <ChevronRight size={22} /></span>
                    </button>
                  </div>
                  <label>
                    <span>Количество</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="1"
                      max="100"
                      step="1"
                      value={quantityInput}
                      onChange={(event) => setQuantityInput(event.target.value)}
                    />
                  </label>
                  <div className="construction-form-row">
                    <span>Построено всеми командами</span>
                    <strong>{builtCounts[building.id]}</strong>
                  </div>
                  <div className="construction-form-row">
                    <span>Рыночная цена за объект</span>
                    <strong>{money(marketPrice)}</strong>
                  </div>
                  <label>
                    <span>Цена за объект в сделке, ₽</span>
                    <input
                      inputMode="numeric"
                      value={
                        customPrice === null
                          ? formatNumber(marketPrice)
                          : customPrice
                      }
                      onChange={(event) => {
                        const next = parseNumber(event.target.value);
                        setCustomPrice(
                          event.target.value.replace(/\D/g, "")
                            ? formatNumber(next)
                            : "",
                        );
                      }}
                    />
                  </label>
                </div>
                <div className="construction-total mt-[16px] rounded-[10px] bg-[#eef6ff] p-[16px]">
                  <h4 className="text-[20px] font-black">Расчёт наличными</h4>
                  <div className="mt-[11px] flex items-center justify-between gap-[8px] text-[19px]">
                    <span>
                      {Number.isInteger(quantity) && quantity > 0
                        ? quantity
                        : "—"}{" "}
                      шт. × {money(unitPrice)}
                    </span>
                    <strong className="text-[27px] text-[#087cff]">
                      {Number.isInteger(quantity) && quantity > 0
                        ? money(total)
                        : "—"}
                    </strong>
                  </div>
                </div>
                {!validDeal && (
                  <p
                    role="alert"
                    className="mt-[10px] text-[17px] text-rose-600"
                  >
                    {Number.isInteger(quantity) && quantity >= 1 && quantity <= 100 &&
                    Number.isInteger(unitPrice) && unitPrice > 0 && unitPrice <= 1000000 &&
                    Number.isSafeInteger(total) && total % 500 !== 0
                      ? "Итоговая сумма должна быть кратна 500 ₽."
                      : "Проверьте количество и цену объекта."}
                  </p>
                )}
                <button
                  type="button"
                  className="mt-[15px] flex h-[64px] w-full items-center justify-center gap-[10px] rounded-[10px] bg-[#087cff] text-[22px] font-bold text-white disabled:bg-[#b4d5ff]"
                  disabled={!validDeal}
                  onClick={confirm}
                >
                  <HardHat className="size-[28px]" /> Подтвердить строительство
                </button>
              </div>
            )}
          </section>
        </section>
        {pickerOpen && typeof document !== "undefined" && createPortal(
          <div className="construction-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPickerOpen(false); }}>
            <section className="construction-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="construction-picker-title">
              <header className="construction-picker-header">
                <h2 id="construction-picker-title">Выберите объект</h2>
                <button type="button" onClick={() => setPickerOpen(false)} aria-label="Закрыть" title="Закрыть"><X size={24} /></button>
              </header>
              <nav className="construction-picker-filters" aria-label="Фильтр по типу ресурса">
                {resourceFilters.map(({ name, icon: Icon }) => <button key={name} type="button" className={resourceFilter === name ? "is-active" : ""} aria-pressed={resourceFilter === name} onClick={() => setResourceFilter(name)}><Icon size={17} /><span>{name}</span></button>)}
              </nav>
              <div className="construction-picker-grid">
                {buildings.filter((item) => resourceFilter === "Все" || item.resource === resourceFilter).map((item) => {
                  const price = item.currentPrice ?? item.basePrice + (builtCounts[item.id] ?? item.initialBuilt) * item.priceStep;
                  return <button key={item.id} type="button" className={building.id === item.id ? "is-selected" : ""} aria-pressed={building.id === item.id} onClick={() => selectBuilding(item.id)}>
                    <BuildingArt building={item} />
                    <span><strong>{item.name}</strong><small>{item.resource}: +{item.units} ед./квартал</small><b>{money(price)}</b></span>
                    {building.id === item.id && <Check className="construction-picker-check" size={21} />}
                  </button>;
                })}
              </div>
            </section>
          </div>, document.body,
        )}
      </AtmScaleFrame>
    </main>
  );
}
