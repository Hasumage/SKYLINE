"use client";

import { type ReactNode, useLayoutEffect, useState } from "react";

const CANVAS_WIDTH = 1536;
const CANVAS_HEIGHT = 1024;
const PAGE_PADDING = 32;

function getScale() {
  if (typeof window === "undefined") {
    return 1;
  }

  const widthScale = (window.innerWidth - PAGE_PADDING) / CANVAS_WIDTH;
  const heightScale = (window.innerHeight - PAGE_PADDING) / CANVAS_HEIGHT;

  return Math.min(widthScale, heightScale, 1);
}

export function AtmScaleFrame({ children, mobileFluid = false }: { children: ReactNode; mobileFluid?: boolean }) {
  const [scale, setScale] = useState(0.75);
  const [compact, setCompact] = useState(false);

  useLayoutEffect(() => {
    const updateScale = () => {
      setScale(getScale());
      setCompact(mobileFluid && window.innerWidth < 768);
    };

    updateScale();
    window.addEventListener("resize", updateScale);

    return () => {
      window.removeEventListener("resize", updateScale);
    };
  }, [mobileFluid]);

  return (
    <div
      className="relative"
      style={{
        width: compact ? "100%" : CANVAS_WIDTH * scale,
        height: compact ? "auto" : CANVAS_HEIGHT * scale,
      }}
    >
      <div
        className="origin-top-left overflow-hidden bg-[#f5fbff]"
        style={{
          width: compact ? "100%" : CANVAS_WIDTH,
          height: compact ? "auto" : CANVAS_HEIGHT,
          transform: compact ? "none" : `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}

