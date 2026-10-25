"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { ArrowLeft, ArrowRight, UserRoundPlus, UsersRound } from "lucide-react";
import { LobbyBrand } from "./lobby-brand";
import { LobbyCityMap } from "./lobby-city-map";
import { clearAccess, getAccess, useLobby } from "../../lib/lobby-client";
import "./lobby-entry.css";
import "./lobby-choice.css";

export function LobbyChoice() {
  const router = useRouter();
  const { snapshot, loading } = useLobby("PLAYER");
  useEffect(() => {
    if (loading) return;
    if (!getAccess()) router.replace("/interfaces/lobby/entry");
    else if (snapshot?.status === "FINISHED") { clearAccess(); router.replace("/interfaces/lobby/entry"); }
    else if (snapshot?.teamId) router.replace(snapshot.status === "ACTIVE" ? "/interfaces/lobby/game" : "/interfaces/lobby/waiting");
  }, [loading, router, snapshot]);
  return (
    <main className="entry-gate choice-page">
      <div className="entry-gate-surface choice-surface">
        <header className="entry-gate-header">
          <LobbyBrand />
          <Link className="choice-back" href="/interfaces/lobby/entry" aria-label="Вернуться к вводу кода" title="Назад">
            <ArrowLeft aria-hidden="true" />
          </Link>
        </header>

        <LobbyCityMap />

        <section className="choice-content">
          <h1>Настройка команды</h1>
          <p>{snapshot?.status === "ACTIVE" ? "Игра уже идёт. Присоединитесь к команде" : "Создайте команду или присоединитесь к существующей"}</p>
          <nav className="choice-actions" aria-label="Действие с командой">
            {snapshot?.status !== "ACTIVE" && <Link className="choice-action choice-action-primary" href="/interfaces/lobby/create-team">
              <span className="choice-action-icon"><UsersRound aria-hidden="true" /></span>
              <span>Создать команду</span>
              <ArrowRight className="choice-action-arrow" aria-hidden="true" />
            </Link>}
            <Link className="choice-action choice-action-secondary" href="/interfaces/lobby/join-team">
              <span className="choice-action-icon"><UserRoundPlus aria-hidden="true" /></span>
              <span>Присоединиться</span>
              <ArrowRight className="choice-action-arrow" aria-hidden="true" />
            </Link>
          </nav>
        </section>
      </div>
    </main>
  );
}
