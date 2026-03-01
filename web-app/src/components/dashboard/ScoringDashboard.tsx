"use client";

import React from "react";
import { usePersonaContext } from "@/components/PersonaContext";
import { ScoreGauge } from "./ScoreGauge";
import { RadarFactorChart } from "./RadarFactorChart";
import { GmvTrendChart } from "./GmvTrendChart";
import { FactorBarChart } from "./FactorBarChart";
import { FraudAlertBanner } from "./FraudAlertBanner";
import { KeyStatsGrid } from "./KeyStatsGrid";
import { CreditLimitBar } from "./CreditLimitBar";
import { FactorInsights } from "./FactorInsights";
import { Skeleton } from "@/components/ui/Skeleton";

export function ScoringDashboard() {
  const { state, activeMeta } = usePersonaContext();
  const { score, profile, platformAverages, isLoading } = state;

  if (isLoading || !score || !profile) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between mb-2">
          <div>
            <Skeleton className="h-7 w-64 mb-2" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
          <Skeleton className="h-[300px] rounded-xl" />
        </div>
        <Skeleton className="h-[260px] rounded-xl" />
        <Skeleton className="h-[120px] rounded-xl" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Header with persona name and score */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-4 border-b border-border/60 gap-3">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
            <span className="text-gradient text-gradient-brand">Credit Profile</span>
            <span className="text-base font-semibold text-text-muted/60">&mdash;</span>
            <span className="text-xl font-bold px-3 py-1 bg-white shadow-sm rounded-lg border border-border/50" style={{ color: activeMeta.color }}>
              {activeMeta.name}
            </span>
          </h2>
          <p className="text-text-secondary text-sm font-medium mt-2">
            Real-time Underwriting Engine &middot; Active Score: <strong className="text-text-primary">{score.score}</strong>
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Credit Limit Bar */}
        <CreditLimitBar creditLimit={score.creditLimit} tier={score.tier} />

        {/* Fraud banner */}
        {score.fraudFlags.flagged && (
          <FraudAlertBanner fraudFlags={score.fraudFlags} />
        )}

        {/* Row 1: Score Gauge | Radar Chart | GMV Trend */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ScoreGauge score={score.score} tier={score.tier} />
          <RadarFactorChart factors={score.factors} score={score.score} />
          <GmvTrendChart gmvTrend={profile.gmv_trend_12m} />
        </div>

        {/* Row 2: Factor bar chart with platform comparison */}
        <FactorBarChart factors={score.factors} platformAverages={platformAverages} />

        {/* Row 3: Factor Insights — explainable scoring */}
        <FactorInsights factors={score.factors} />

        {/* Row 4: Key stats grid */}
        <KeyStatsGrid profile={profile} />
      </div>
    </div>
  );
}
