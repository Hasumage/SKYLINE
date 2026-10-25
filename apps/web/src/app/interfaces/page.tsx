import Link from "next/link";
import {
  ArrowRight,
  Banknote,
  Building2,
  ClipboardCheck,
  DoorOpen,
  Hammer,
  Landmark,
  ListChecks,
  LockKeyhole,
  Monitor,
  Plus,
  ShieldCheck,
  Stethoscope,
  UsersRound,
} from "lucide-react";
import { LinkCard, Shell } from "../../components/skyline/ui";

const interfaceGroups = [
  {
    title: "Лобби",
    description:
      "Экраны входа, создания команды, присоединения и ожидания старта партии.",
    items: [
      {
        href: "/interfaces/lobby",
        icon: <DoorOpen className="size-5" />,
        eyebrow: "Группа",
        title: "Все экраны лобби",
        description: "Навигационный хаб по маршруту игрока до старта игры.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/lobby/entry",
        icon: <LockKeyhole className="size-5" />,
        eyebrow: "Лобби",
        title: "Вход по коду",
        description: "Первичный экран для общего кода игровой сессии.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/lobby/choice",
        icon: <ListChecks className="size-5" />,
        eyebrow: "Лобби",
        title: "Выбор действия",
        description: "Переход к созданию команды или присоединению.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/lobby/create-team",
        icon: <Plus className="size-5" />,
        eyebrow: "Лобби",
        title: "Создание команды",
        description:
          "Название, цвет через color picker и выбор аватарки команды.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/lobby/join-team",
        icon: <UsersRound className="size-5" />,
        eyebrow: "Лобби",
        title: "Присоединиться",
        description: "Код команды или выбор команды из списка.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/lobby/waiting",
        icon: <Building2 className="size-5" />,
        eyebrow: "Лобби",
        title: "Ожидание старта",
        description: "Лобби команды со статусом и составом игроков.",
        status: "ready" as const,
      },
      {
        href: "/admin/login",
        icon: <ShieldCheck className="size-5" />,
        eyebrow: "Лобби",
        title: "Вход администратора",
        description: "Создание сессии или вход по коду структуры.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/lobby/error",
        icon: <LockKeyhole className="size-5" />,
        eyebrow: "Лобби",
        title: "Ошибка кода",
        description: "Неверный, истёкший или отозванный код.",
        status: "ready" as const,
      },
    ],
  },
  {
    title: "Структуры",
    description:
      "Интерфейсы игромастеров отдельных столов и игровых структур.",
    items: [
      {
        href: "/interfaces/atm",
        icon: <Banknote className="size-5" />,
        eyebrow: "Структура",
        title: "Банкомат",
        description:
          "Выбор команды, сумма, внесение и снятие с проверкой кратности 500.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/bank",
        icon: <Landmark className="size-5" />,
        eyebrow: "Структура",
        title: "Банк",
        description: "Согласование кредита, выдача наличными или на баланс и погашение долга.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/construction",
        icon: <Hammer className="size-5" />,
        eyebrow: "Структура",
        title: "Строительство",
        description: "Каталог объектов, расчёт цены и оформление строительства.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/patents",
        icon: <ClipboardCheck className="size-5" />,
        eyebrow: "Структура",
        title: "Наука",
        description: "Создание патентов, сроки и коэффициенты.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/medicine",
        icon: <Stethoscope className="size-5" />,
        eyebrow: "Структура",
        title: "Медицина",
        description: "Активные события, команды и история.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/mayor",
        icon: <Landmark className="size-5" />,
        eyebrow: "Структура",
        title: "Мэр города",
        description: "Мобильная панель: цели, чрезвычайные ситуации и указы.",
        status: "ready" as const,
      },
      {
        href: "/admin/station/enterprises",
        icon: <Building2 className="size-5" />,
        eyebrow: "Структура",
        title: "Предприятия",
        description: "Вход администратора предприятий и статус участия в матче.",
        status: "draft" as const,
      },
    ],
  },
  {
    title: "Общие экраны",
    description:
      "Кабинеты, организатор и будущие публичные сцены проектора.",
    items: [
      {
        href: "/admin/lobby",
        icon: <ShieldCheck className="size-5" />,
        eyebrow: "Управление партией",
        title: "Организатор",
        description: "Коды, структуры, состав команд и запуск матча.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/player",
        icon: <Building2 className="size-5" />,
        eyebrow: "Команда",
        title: "Кабинет игрока",
        description: "Отдельный макет с балансом, картой, кварталом и вкладками.",
        status: "ready" as const,
      },
      {
        href: "/interfaces/projector",
        icon: <Monitor className="size-5" />,
        eyebrow: "Публичный экран",
        title: "Проектор",
        description: "Группа будущих 16:9 сцен для зала.",
        status: "draft" as const,
      },
    ],
  },
];

export default function InterfacesPage() {
  return (
    <Shell
      eyebrow="SKYLINE UI"
      title="Интерфейсы турнира"
      description="Каталог разделён на группы: у лобби и проектора будет несколько связанных экранов, у структур — отдельные рабочие места игромастеров."
    >
      <div className="mb-7 flex flex-col justify-between gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-slate-950">Текущий фокус</p>
          <p className="text-sm text-slate-600">
            Мобильное лобби в стиле банкомата: вход, настройка команды,
            color picker и сгенерированные аватарки.
          </p>
        </div>
        <Link
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700"
          href="/interfaces/lobby/entry"
        >
          Открыть вход <ArrowRight className="size-4" />
        </Link>
      </div>

      <div className="grid gap-9">
        {interfaceGroups.map((group) => (
          <section key={group.title}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-slate-950">{group.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{group.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {group.items.map((item) => (
                <LinkCard key={item.href} {...item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </Shell>
  );
}
