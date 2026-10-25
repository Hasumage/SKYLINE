"use client";

import { Droplets, House, Layers3, Mountain, Trees, Zap } from "lucide-react";
import { IconSelect } from "./icon-select";

const industries = [
  { name: "Энергетика", icon: Zap, tone: "energy" },
  { name: "Жильё", icon: House, tone: "housing" },
  { name: "Газовая отрасль", icon: Droplets, tone: "gas" },
  { name: "Металлургия", icon: Layers3, tone: "metal" },
  { name: "Деревообработка", icon: Trees, tone: "wood" },
  { name: "Угольная отрасль", icon: Mountain, tone: "coal" },
] as const;

export type IndustryName = (typeof industries)[number]["name"];

export function IndustrySelect({ value, onChange, label = "Отрасль / объект" }: { value: IndustryName; onChange: (value: IndustryName) => void; label?: string }) {
  return <IconSelect value={value} onChange={onChange} options={industries} label={label} />;
}
