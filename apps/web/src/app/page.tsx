import Link from "next/link";
import { ArrowRight } from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[var(--skyline-bg)] px-6 py-8 text-slate-950">
      <section className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div>
          <p className="text-sm font-medium text-blue-600">SKYLINE</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-normal">
            Лобби экономического турнира
          </h1>
          <p className="mt-3 max-w-2xl text-base text-slate-600">
            Каркас проекта готов для этапа A: вход по коду, команды, роли,
            готовность структур и realtime-лобби.
          </p>
          <Link
            href="/interfaces"
            className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-blue-600 px-5 text-sm font-medium text-white hover:bg-blue-700"
          >
            Открыть интерфейсы <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}

