"use client";

import { Droplets, Layers3, Mountain, Trees, Zap } from "lucide-react";
import { IconSelect } from "./icon-select";

export const resources = [
  { name: "Энергия", icon: Zap, tone: "energy" },
  { name: "Газ", icon: Droplets, tone: "gas" },
  { name: "Металл", icon: Layers3, tone: "metal" },
  { name: "Дерево", icon: Trees, tone: "wood" },
  { name: "Уголь", icon: Mountain, tone: "coal" },
] as const;

export type ResourceName = (typeof resources)[number]["name"];

export function ResourceSelect({ value, onChange, label = "Ресурс" }: { value: ResourceName; onChange: (value: ResourceName) => void; label?: string }) {
  return <IconSelect value={value} onChange={onChange} options={resources} label={label} />;
}
