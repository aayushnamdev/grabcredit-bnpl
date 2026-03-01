"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
  ReactNode,
} from "react";
import type {
  UserProfile,
  ScoreResult,
  PayUEmiOptionsResult,
  PlatformAverages,
  PayUEmiCreateResponse,
} from "@/types/api";
import { PERSONA_MAP } from "@/types/api";

// Persona metadata (static, no backend needed)
export interface PersonaMeta {
  id: string;
  backendId: string;
  name: string;
  summary: string;
  initials: string;
  color: string;
}

export const PERSONAS: PersonaMeta[] = [
  { id: "p1", backendId: "user_001", name: "Priya Sharma", summary: "Power User", initials: "PS", color: "#60a600" },
  { id: "p2", backendId: "user_002", name: "Rahul Verma", summary: "Steady Spender", initials: "RV", color: "#2491ef" },
  { id: "p3", backendId: "user_003", name: "Ananya Iyer", summary: "New But Promising", initials: "AI", color: "#f59e0b" },
  { id: "p4", backendId: "user_004", name: "Vikram Singh", summary: "Declining User", initials: "VS", color: "#ef4444" },
  { id: "p5", backendId: "user_005", name: "Ghost User", summary: "Suspicious New User", initials: "GU", color: "#8a8a8a" },
];

export interface PersonaState {
  personaId: string;
  profile: UserProfile | null;
  score: ScoreResult | null;
  narrative: string | null;
  emiOptions: PayUEmiOptionsResult | null;
  platformAverages: PlatformAverages | null;
  isLoading: boolean;
  isNarrativeLoading: boolean;
}

interface PersonaContextType {
  state: PersonaState;
  activeMeta: PersonaMeta;
  personas: PersonaMeta[];
  switchPersona: (id: string) => void;
  fetchEmiOptions: (amount: number, merchantName?: string) => Promise<PayUEmiOptionsResult | null>;
  confirmEmi: (amount: number, months: number, merchantName?: string) => Promise<PayUEmiCreateResponse | null>;
}

const PersonaContext = createContext<PersonaContextType | undefined>(undefined);

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersonaState>({
    personaId: "p1",
    profile: null,
    score: null,
    narrative: null,
    emiOptions: null,
    platformAverages: null,
    isLoading: true,
    isNarrativeLoading: false,
  });

  // Cache fetched data per persona
  const cache = useRef<
    Map<string, { profile: UserProfile; score: ScoreResult; platformAverages: PlatformAverages }>
  >(new Map());

  const narrativeCache = useRef<Map<string, string>>(new Map());
  const emiCache = useRef<Map<string, PayUEmiOptionsResult>>(new Map());

  const loadPersona = useCallback(async (personaId: string) => {
    const backendId = PERSONA_MAP[personaId];
    if (!backendId) return;

    // Check cache first
    const cached = cache.current.get(personaId);
    if (cached) {
      setState((prev) => ({
        ...prev,
        personaId,
        profile: cached.profile,
        score: cached.score,
        platformAverages: cached.platformAverages,
        emiOptions: emiCache.current.get(personaId) || null,
        isLoading: false,
        narrative: narrativeCache.current.get(personaId) || null,
        isNarrativeLoading: !narrativeCache.current.has(personaId),
      }));
    } else {
      setState((prev) => ({
        ...prev,
        personaId,
        profile: null,
        score: null,
        narrative: null,
        emiOptions: null,
        platformAverages: null,
        isLoading: true,
        isNarrativeLoading: true,
      }));
    }

    // Fetch core data in parallel
    if (!cached) {
      try {
        const [profileRes, scoreRes, avgRes] = await Promise.all([
          fetch(`/api/profile?user_id=${backendId}`),
          fetch(`/api/score?user_id=${backendId}`),
          fetch(`/api/platform-averages`),
        ]);

        const [profile, score, platformAverages] = await Promise.all([
          profileRes.json(),
          scoreRes.json(),
          avgRes.json(),
        ]);

        cache.current.set(personaId, { profile, score, platformAverages });

        setState((prev) => {
          if (prev.personaId !== personaId) return prev;
          return {
            ...prev,
            profile,
            score,
            platformAverages,
            isLoading: false,
          };
        });
      } catch {
        setState((prev) => {
          if (prev.personaId !== personaId) return prev;
          return { ...prev, isLoading: false };
        });
      }
    }

    // Fetch narrative in background (non-blocking)
    if (!narrativeCache.current.has(personaId)) {
      setState((prev) => {
        if (prev.personaId !== personaId) return prev;
        return { ...prev, isNarrativeLoading: true };
      });

      try {
        const narrativeRes = await fetch(`/api/narrative?user_id=${backendId}`);
        const { narrative } = await narrativeRes.json();
        narrativeCache.current.set(personaId, narrative);

        setState((prev) => {
          if (prev.personaId !== personaId) return prev;
          return { ...prev, narrative, isNarrativeLoading: false };
        });
      } catch {
        setState((prev) => {
          if (prev.personaId !== personaId) return prev;
          return { ...prev, isNarrativeLoading: false };
        });
      }
    }
  }, []);

  // Load initial persona
  const initialized = useRef(false);
  React.useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      loadPersona("p1");
    }
  }, [loadPersona]);

  const switchPersona = useCallback(
    (id: string) => {
      if (id === state.personaId) return;
      loadPersona(id);
    },
    [state.personaId, loadPersona]
  );

  const fetchEmiOptions = useCallback(
    async (amount: number, merchantName?: string): Promise<PayUEmiOptionsResult | null> => {
      const backendId = PERSONA_MAP[state.personaId];
      if (!backendId) return null;

      const cacheKey = `${state.personaId}_${amount}`;
      const cached = emiCache.current.get(cacheKey);
      if (cached) {
        setState((prev) => ({ ...prev, emiOptions: cached }));
        return cached;
      }

      try {
        const res = await fetch("/api/emi-options", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: backendId,
            purchase_amount: amount,
            merchant_name: merchantName,
          }),
        });
        const data = await res.json();
        emiCache.current.set(cacheKey, data);
        setState((prev) => ({ ...prev, emiOptions: data }));
        return data;
      } catch {
        return null;
      }
    },
    [state.personaId]
  );

  const confirmEmi = useCallback(
    async (
      amount: number,
      months: number,
      merchantName?: string
    ): Promise<PayUEmiCreateResponse | null> => {
      const backendId = PERSONA_MAP[state.personaId];
      if (!backendId) return null;

      try {
        const res = await fetch("/api/confirm-emi", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: backendId,
            purchase_amount: amount,
            selected_months: months,
            merchant_name: merchantName,
          }),
        });
        return await res.json();
      } catch {
        return null;
      }
    },
    [state.personaId]
  );

  const activeMeta = PERSONAS.find((p) => p.id === state.personaId) || PERSONAS[0];

  return (
    <PersonaContext.Provider
      value={{
        state,
        activeMeta,
        personas: PERSONAS,
        switchPersona,
        fetchEmiOptions,
        confirmEmi,
      }}
    >
      {children}
    </PersonaContext.Provider>
  );
}

export function usePersonaContext() {
  const context = useContext(PersonaContext);
  if (context === undefined) {
    throw new Error("usePersonaContext must be used within a PersonaProvider");
  }
  return context;
}
