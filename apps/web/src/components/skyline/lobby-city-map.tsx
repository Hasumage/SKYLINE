"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Building2, Coins, Construction, Cross, FileText, Landmark, X } from "lucide-react";
import "./lobby-city-map.css";

const places = [
  { label: "Банк", icon: Coins, className: "entry-place-bank", image: null, description: "Здесь команда управляет игровыми деньгами и пользуется банковскими услугами." },
  { label: "Строительство", icon: Construction, className: "entry-place-construction", image: "/generated/structure-construction.png", description: "Строительная площадка города. Здесь появляются новые объекты и развивается инфраструктура." },
  { label: "Предприятия", icon: Building2, className: "entry-place-enterprise", image: "/generated/structure-enterprise.png", description: "Производственные объекты команды. Развивайте предприятия и принимайте решения об их работе." },
  { label: "Наука", icon: FileText, className: "entry-place-patent", image: "/generated/structure-patent.png", description: "Место для работы с идеями, разработками и патентами команды." },
  { label: "Медицина", icon: Cross, className: "entry-place-medicine", image: "/generated/structure-medicine.png", description: "Медицинская структура города помогает участникам решать вопросы здоровья в ходе игры." },
  { label: "Мэр города", icon: Landmark, className: "entry-place-mayor", image: "/generated/structure-mayor.png", description: "Администрация города принимает решения, которые влияют на жизнь и развитие города." },
];

export function LobbyCityMap() {
  const [activePlace, setActivePlace] = useState<(typeof places)[number] | null>(null);

  useEffect(() => {
    if (!activePlace) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setActivePlace(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [activePlace]);

  return (
    <>
      <div className="entry-art" aria-hidden="true">
        <Image src="/generated/port-city-diorama.png" alt="" width={1448} height={1086} priority unoptimized />
      </div>
      <div className="entry-places">
        <button className="entry-enterprise-hotspot" type="button" aria-label="Подробнее о предприятиях" onClick={() => setActivePlace(places[2])} />
        {places.map((place) => (
          <button className={`entry-place ${place.className}`} key={place.label} type="button" onClick={() => setActivePlace(place)}>
            <place.icon aria-hidden="true" />
            <span>{place.label}</span>
          </button>
        ))}
      </div>
      {activePlace && (
        <div className="entry-place-backdrop" role="presentation" onClick={() => setActivePlace(null)}>
          <div className="entry-place-dialog" role="dialog" aria-modal="true" aria-labelledby="entry-place-title" onClick={(event) => event.stopPropagation()}>
            <button className="entry-place-close" type="button" aria-label="Закрыть" onClick={() => setActivePlace(null)}><X /></button>
            <div className="entry-place-preview">
              {activePlace.image ? (
                <Image src={activePlace.image} alt="" width={1280} height={1280} unoptimized />
              ) : (
                <activePlace.icon aria-hidden="true" />
              )}
            </div>
            <h2 id="entry-place-title">{activePlace.label}</h2>
            <p>{activePlace.description}</p>
          </div>
        </div>
      )}
    </>
  );
}
