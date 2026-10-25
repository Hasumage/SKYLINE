"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, type LucideIcon } from "lucide-react";
import "./icon-select.css";

export type IconOption<T extends string> = { name: T; icon: LucideIcon; tone: string };

export function IconSelect<T extends string>({ value, onChange, options, label }: { value: T; onChange: (value: T) => void; options: readonly IconOption<T>[]; label: string }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.name === value) ?? options[0];
  const SelectedIcon = selected.icon;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false); };
    const onEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onEscape);
    return () => { window.removeEventListener("pointerdown", onPointerDown); window.removeEventListener("keydown", onEscape); };
  }, [open]);

  return <div className="icon-select" ref={rootRef}>
    <button type="button" className="icon-select-trigger" aria-label={label} aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen((current) => !current)}><span className={`icon-select-icon icon-select-icon--${selected.tone}`}><SelectedIcon size={22} /></span><strong>{selected.name}</strong><ChevronDown size={21} className={open ? "is-open" : ""} /></button>
    {open && <div className="icon-select-menu" role="listbox" aria-label={label}>{options.map((option) => { const Icon = option.icon; return <button type="button" role="option" aria-selected={value === option.name} key={option.name} onClick={() => { onChange(option.name); setOpen(false); }}><span className={`icon-select-icon icon-select-icon--${option.tone}`}><Icon size={22} /></span><span>{option.name}</span>{value === option.name && <Check size={19} />}</button>; })}</div>}
  </div>;
}
