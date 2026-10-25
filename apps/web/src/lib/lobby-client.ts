"use client";

import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export type LobbyRole = "ORGANIZER" | "STAFF" | "PLAYER";
export type Station = { type: string; enabled: boolean; ready: boolean; assigned: boolean };
export type LobbyPlayer = { id: string; teamId: string | null; displayName: string; disqualified: boolean };
export type LobbyTeam = { id: string; name: string; code: string; color: string; avatar: number; balance: number; assetsCount: number; buildings?: Record<string, number>; members: number; participants?: LobbyPlayer[] };
export type LobbyResult = { teamId: string; name: string; balance: number; assetsCount: number; stockUnits: number; buildingPoints: number; resourcePoints: number; debt: number; debtDeduction: number; score: number; rank: number; isWinner: boolean };
export type LobbySnapshot = {
  sessionId: string; status: "WAITING" | "ACTIVE" | "FINISHED" | "PAUSED";
  currentQuarter: number; quarterDurationSec: number; totalQuarters: number; startsAt: string | null;
  serverTime: number; sequence: number; role: LobbyRole; stationType: string | null;
  participantId: string | null; teamId: string | null; disqualified: boolean;
  teams: LobbyTeam[]; stations: Station[]; participants?: LobbyPlayer[];
  results?: LobbyResult[] | null;
  resultHistory?: (LobbyResult & { phase: "START" | "QUARTER" | "FINAL"; quarter: number; recordedAt: string })[] | null;
  assets?: { id: string; code: string; category: string; quantity: number; builtInQuarter: number; firstProductionQuarter: number; yields: { code: string; label: string; unitsPerQuarter: number }[] }[];
  resources?: { code: string; label: string; quantity: number }[];
  loan?: { id: string; principal: number; total: number; remaining: number; accruedInterest: number; paymentPerQuarter: number } | null;
  transactions?: { id: string; teamId: string; type: "deposit" | "withdraw"; amount: number; createdAt: string }[];
  codes?: { player: string; projector: string; staff: Record<string, string> };
};
type Access = { token: string; sessionId: string; role: LobbyRole };
const key = "skyline-access-v1";
const deviceKey = "skyline-device-v1";

export function getDeviceId() {
  let id = localStorage.getItem(deviceKey);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(deviceKey, id); }
  return id;
}

export function getAccess(): Access | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const value = JSON.parse(stored) as Access;
    return typeof value.token === "string" && typeof value.sessionId === "string" ? value : null;
  } catch { return null; }
}

export function saveAccess(value: Access) { localStorage.setItem(key, JSON.stringify(value)); }
export function clearAccess() { localStorage.removeItem(key); }

function origin() {
  if (typeof window === "undefined") return "";
  return window.location.port === "3000" && ["localhost", "127.0.0.1"].includes(window.location.hostname)
    ? `${window.location.protocol}//${window.location.hostname}:3001` : "";
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; token?: string } = {}): Promise<T> {
  const response = await fetch(`${origin()}/api${path}`, {
    method: options.method ?? "GET",
    headers: { ...(options.body === undefined ? {} : { "Content-Type": "application/json" }), ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}) },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(typeof data.message === "string" ? data.message : Array.isArray(data.message) ? data.message.join(", ") : `HTTP ${response.status}`);
  return data as T;
}

export function useLobby(expectedRole?: LobbyRole) {
  const [snapshot, setSnapshot] = useState<LobbySnapshot | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [clockOffset, setClockOffset] = useState(0);
  useEffect(() => {
    const access = getAccess();
    if (!access || (expectedRole && access.role !== expectedRole)) {
      setLoading(false);
      setError("Войдите в сессию снова");
      return;
    }
    let live = true;
    const accept = (state: LobbySnapshot) => {
      if (!live || state.sessionId !== access.sessionId) return;
      setSnapshot((current) => !current || state.sequence >= current.sequence ? state : current);
      setClockOffset(state.serverTime - Date.now());
      setLoading(false);
    };
    void api<LobbySnapshot>("/auth/me", { token: access.token }).then(accept).catch((cause) => { if (live) { setError(cause.message); setLoading(false); } });
    const socket = io(origin() || undefined, { path: "/socket.io", auth: { token: access.token }, transports: ["websocket", "polling"] });
    socket.on("lobby:snapshot", accept);
    socket.on("match:started", accept);
    socket.on("access:revoked", () => {
      if (!live) return;
      clearAccess();
      setSnapshot(null);
      setError("Доступ администратора структуры отозван");
      socket.disconnect();
    });
    socket.on("connect_error", () => { if (live) setError("Нет соединения с сервером. Повторяем подключение..."); });
    socket.on("connect", () => { if (live) setError(""); });
    const sync = window.setInterval(() => {
      const sent = Date.now();
      socket.timeout(2500).emit("skyline:ping", (err: Error | null, answer: { ok: boolean; serverTime: number }) => {
        if (!err && answer?.ok && live) setClockOffset(answer.serverTime - (sent + Date.now()) / 2);
      });
    }, 10000);
    return () => { live = false; window.clearInterval(sync); socket.disconnect(); };
  }, [expectedRole]);
  async function refresh() {
    const access = getAccess();
    if (!access) throw new Error("Войдите в сессию снова");
    const state = await api<LobbySnapshot>("/auth/me", { token: access.token });
    setSnapshot(state);
    setClockOffset(state.serverTime - Date.now());
    setError("");
    return state;
  }
  return { snapshot, error, loading, clockOffset, refresh };
}

export function useMatchClock(snapshot: LobbySnapshot | null, offset: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);
  if (!snapshot?.startsAt) return null;
  const elapsed = Math.max(0, now + offset - new Date(snapshot.startsAt).getTime());
  const duration = snapshot.quarterDurationSec * 1000;
  const quarter = Math.min(snapshot.totalQuarters, Math.floor(elapsed / duration) + 1);
  const remaining = elapsed >= duration * snapshot.totalQuarters ? 0 : Math.max(0, duration - elapsed % duration);
  const seconds = Math.ceil(remaining / 1000);
  return { quarter, remaining, fraction: remaining / duration, text: `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}` };
}
