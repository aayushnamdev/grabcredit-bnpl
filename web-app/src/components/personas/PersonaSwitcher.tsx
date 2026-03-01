"use client";

import React from "react";
import { usePersonaContext, type PersonaMeta } from "@/components/PersonaContext";
import { motion } from "framer-motion";
import { FlaskConical } from "lucide-react";

// Deterministic score map (scores are stable per persona)
const PERSONA_SCORES: Record<string, { score: number; tier: string; tierLabel: string }> = {
  p1: { score: 927, tier: "pre-approved", tierLabel: "Pre-Approved" },
  p2: { score: 672, tier: "approved", tierLabel: "Approved" },
  p3: { score: 489, tier: "conditional", tierLabel: "Conditional" },
  p4: { score: 312, tier: "rejected", tierLabel: "Rejected" },
  p5: { score: 0, tier: "fraud-rejected", tierLabel: "Fraud" },
};

const TIER_STYLES: Record<string, { ring: string; badge: string; text: string }> = {
  "pre-approved": { ring: "ring-brand-500", badge: "bg-brand-50 text-brand-700", text: "text-brand-600" },
  approved: { ring: "ring-accent-500", badge: "bg-blue-50 text-accent-600", text: "text-accent-500" },
  conditional: { ring: "ring-warning-500", badge: "bg-amber-50 text-amber-700", text: "text-warning-500" },
  rejected: { ring: "ring-danger-500", badge: "bg-danger-50 text-danger-700", text: "text-danger-500" },
  "fraud-rejected": { ring: "ring-danger-500", badge: "bg-danger-50 text-danger-700", text: "text-danger-500" },
};

function PersonaCard({ persona, isActive, onClick }: {
  persona: PersonaMeta;
  isActive: boolean;
  onClick: () => void;
}) {
  const info = PERSONA_SCORES[persona.id];
  const styles = TIER_STYLES[info.tier];

  return (
    <button
      onClick={onClick}
      title={!isActive ? `${persona.name} — ${info.tierLabel}` : undefined}
      className={`
        relative flex items-center gap-2.5 py-1.5 rounded-xl transition-all duration-300 cursor-pointer
        snap-start shrink-0
        ${isActive
          ? `bg-white shadow-sm ring-1 ${styles.ring} px-3 min-w-[140px]`
          : `px-1.5 hover:bg-gray-100/50 opacity-50 hover:opacity-80 ring-1 ring-transparent`
        }
      `}
    >
      {/* Avatar circle with initials */}
      <div
        className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[10px] shrink-0 shadow-sm"
        style={{ backgroundColor: persona.color }}
      >
        {persona.initials}
      </div>

      {/* Only show name + score for the active persona */}
      {isActive && (
        <div className="text-left min-w-0">
          <p className="text-[11px] font-semibold truncate text-text-primary">
            {persona.name}
          </p>
          <div className="flex items-center gap-1 mt-0.5">
            {info.score > 0 && (
              <span className={`text-[10px] font-extrabold ${styles.text}`}>
                {info.score}
              </span>
            )}
            <span className={`text-[8px] font-bold px-1.5 py-px rounded-full ${styles.badge} tracking-wide`}>
              {info.tierLabel}
            </span>
          </div>
        </div>
      )}
    </button>
  );
}

export function PersonaSwitcher() {
  const { state, activeMeta, personas, switchPersona } = usePersonaContext();

  return (
    <div className="sticky top-0 z-50 bg-white/95 backdrop-blur-xl border-b border-border/60 shadow-[0_4px_20px_-10px_rgba(0,0,0,0.1)]">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex items-center gap-4 py-2">
          {/* Demo Mode Label */}
          <div className="hidden sm:flex items-center gap-1.5 pr-4 border-r border-border/60 shrink-0">
            <div className="w-6 h-6 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center">
              <FlaskConical className="w-3.5 h-3.5 text-text-muted" />
            </div>
            <span className="text-[9px] font-bold text-text-muted uppercase tracking-widest">
              Demo
            </span>
          </div>

          {/* Persona Cards */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide snap-x snap-mandatory flex-1 py-1 px-0.5">
            {personas.map((persona) => (
              <PersonaCard
                key={persona.id}
                persona={persona}
                isActive={persona.id === state.personaId}
                onClick={() => switchPersona(persona.id)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Loading bar */}
      {state.isLoading && (
        <motion.div
          className="absolute bottom-0 left-0 h-[2px] bg-brand-500"
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: 1.5, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}
