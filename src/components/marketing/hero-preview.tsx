"use client";

import { useState } from "react";
import { ScheduleMock, TrainingMock, LiveMock } from "./mocks";
import styles from "./motion.module.css";

const scenes = [
  { label: "Plan the week", title: "Everyone knows where to be.", Mock: ScheduleMock },
  { label: "Build players", title: "Give every player a clear next step.", Mock: TrainingMock },
  { label: "Follow the game", title: "Bring the dugout to every family.", Mock: LiveMock },
];

export function HeroPreview() {
  const [selected, setSelected] = useState(0);
  const scene = scenes[selected];
  return (
    <div className="rounded-3xl bg-zinc-100 p-4 ring-1 ring-zinc-200 sm:p-6">
      <div className="mb-5 flex items-center justify-between text-xs font-semibold text-zinc-600">
        <span>ONE TEAM. CONNECTED.</span>
        <span>Sample team</span>
      </div>
      <div
        role="tablist"
        aria-label="Explore 9D"
        className="mb-6 grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1"
      >
        {scenes.map((item, index) => (
          <button
            key={item.label}
            id={`hero-tab-${index}`}
            role="tab"
            aria-selected={selected === index}
            aria-controls="hero-preview"
            tabIndex={selected === index ? 0 : -1}
            onClick={() => setSelected(index)}
            onKeyDown={(event) => {
              const next =
                event.key === "ArrowRight"
                  ? (index + 1) % scenes.length
                  : event.key === "ArrowLeft"
                    ? (index + scenes.length - 1) % scenes.length
                    : event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? scenes.length - 1
                        : null;
              if (next === null) return;
              event.preventDefault();
              setSelected(next);
              document.getElementById(`hero-tab-${next}`)?.focus();
            }}
            className={`${styles.tab} min-h-12 rounded-xl px-2 py-2 text-xs font-semibold ${selected === index ? "bg-zinc-900 text-zinc-50 shadow-sm" : "text-zinc-600 hover:bg-zinc-100"}`}
          >
            {item.label}
          </button>
        ))}
      </div>
      <div
        id="hero-preview"
        role="tabpanel"
        aria-labelledby={`hero-tab-${selected}`}
        tabIndex={0}
        className="min-h-[420px]"
      >
        <div key={selected} className={styles.preview}>
          <scene.Mock />
          <p className="mt-5 text-center text-sm font-medium text-zinc-700">{scene.title}</p>
        </div>
      </div>
    </div>
  );
}
