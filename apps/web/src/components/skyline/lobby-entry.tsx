"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, CircleHelp, X } from "lucide-react";
import { LobbyBrand } from "./lobby-brand";
import { LobbyCityMap } from "./lobby-city-map";
import { api, clearAccess, getAccess, getDeviceId, saveAccess, type LobbySnapshot } from "../../lib/lobby-client";
import "./lobby-entry.css";

export function LobbyEntry() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    const access = getAccess();
    if (!access || access.role !== "PLAYER") return;
    void api<LobbySnapshot>("/auth/me", { token: access.token }).then((state) => {
      if (state.status === "FINISHED") { clearAccess(); return; }
      if (state.disqualified) return;
      router.replace(state.teamId ? state.status === "ACTIVE" ? "/interfaces/lobby/game" : "/interfaces/lobby/waiting" : "/interfaces/lobby/choice");
    }).catch(() => {});
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (code.length !== 5) {
      setError("Введите пять цифр кода");
      inputRef.current?.focus();
      return;
    }
    setBusy(true); setError("");
    try {
      const result = await api<{ token: string; sessionId: string }>("/lobby/join", { method: "POST", body: { code, deviceId: getDeviceId() } });
      saveAccess({ token: result.token, sessionId: result.sessionId, role: "PLAYER" });
      router.push("/interfaces/lobby/choice");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось войти"); }
    finally { setBusy(false); }
  }

  return (
    <main className="entry-gate">
      <div className="entry-gate-surface">
        <header className="entry-gate-header">
          <LobbyBrand />
          <button className="entry-help" type="button" aria-label="Помощь" title="Помощь" onClick={() => setHelpOpen(true)}>
            <CircleHelp />
          </button>
        </header>

        <LobbyCityMap />

        <section className="entry-gate-bottom">
          <h1>Построй свою<br />историю<span>.</span></h1>
          <form onSubmit={submit}>
            <label className="entry-code-label" htmlFor="lobby-session-code">Код сессии</label>
            <div className={`entry-code-cells ${error ? "entry-code-error" : ""}`} onClick={() => inputRef.current?.focus()}>
              {Array.from({ length: 5 }, (_, index) => (
                <span className={`entry-code-cell ${index === code.length && (focused || code.length === 0) ? "entry-code-active" : ""}`} key={index} aria-hidden="true">
                  {code[index] ?? (index === code.length ? <i className="entry-code-caret" /> : "–")}
                </span>
              ))}
              <input
                ref={inputRef}
                id="lobby-session-code"
                aria-label="Пятизначный код игровой сессии"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={5}
                pattern="[0-9]*"
                value={code}
                onChange={(event) => { setCode(event.target.value.replace(/\D/g, "").slice(0, 5)); setError(""); }}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
            </div>
            <span className="entry-code-message" role="alert">{error}</span>
            <button className="entry-submit" type="submit" disabled={busy}>Войти в лобби <ArrowRight aria-hidden="true" /></button>
          </form>
        </section>

        {helpOpen && (
          <div className="entry-help-backdrop" role="presentation" onClick={() => setHelpOpen(false)}>
            <div className="entry-help-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-help-title" onClick={(event) => event.stopPropagation()}>
              <button type="button" aria-label="Закрыть" onClick={() => setHelpOpen(false)}><X /></button>
              <h2 id="entry-help-title">Как войти в игру</h2>
              <p>Введите пятизначный код игровой сессии, который выдал организатор.</p>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
