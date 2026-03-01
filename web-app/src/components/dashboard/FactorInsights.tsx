"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { FactorResult } from "@/types/api";
import { motion, AnimatePresence } from "framer-motion";

interface FactorInsightsProps {
  factors: {
    purchaseConsistency: FactorResult;
    dealEngagement: FactorResult;
    financialTrajectory: FactorResult;
    riskSignals: FactorResult;
    accountMaturity: FactorResult;
  };
}

const FACTOR_META: Record<string, { label: string; icon: string }> = {
  purchaseConsistency: { label: "Purchase Consistency", icon: "📊" },
  dealEngagement: { label: "Deal Engagement", icon: "🎯" },
  financialTrajectory: { label: "Financial Trajectory", icon: "📈" },
  riskSignals: { label: "Risk Signals", icon: "🛡️" },
  accountMaturity: { label: "Account Maturity", icon: "⏳" },
};

function getScoreColor(score: number): string {
  if (score >= 80) return "text-brand-700 bg-brand-50 border-brand-200";
  if (score >= 60) return "text-accent-600 bg-blue-50 border-blue-200";
  if (score >= 40) return "text-amber-700 bg-amber-50 border-amber-200";
  return "text-danger-700 bg-danger-50 border-red-200";
}

function getBarColor(score: number): string {
  if (score >= 80) return "bg-brand-500";
  if (score >= 60) return "bg-accent-500";
  if (score >= 40) return "bg-warning-500";
  return "bg-danger-500";
}

export function FactorInsights({ factors }: FactorInsightsProps) {
  // Find weakest factor to expand by default
  const entries = Object.entries(factors) as [string, FactorResult][];
  const weakestKey = entries.reduce((min, [key, f]) =>
    f.score < (factors as Record<string, FactorResult>)[min].score ? key : min
  , entries[0][0]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set([weakestKey]));

  const toggle = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-text-primary mb-1">Factor Insights</h3>
      <p className="text-xs text-text-muted mb-4">Explainable scoring — see what drives each factor</p>

      <div className="space-y-2">
        {entries.map(([key, factor]) => {
          const meta = FACTOR_META[key];
          const isOpen = expanded.has(key);
          const colorClass = getScoreColor(factor.score);
          const barColor = getBarColor(factor.score);

          return (
            <div key={key} className="border border-border rounded-xl overflow-hidden">
              <button
                onClick={() => toggle(key)}
                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors"
              >
                <span className="text-base">{meta.icon}</span>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{meta.label}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${colorClass}`}>
                      {Math.round(factor.score)}
                    </span>
                    <span className="text-[10px] text-text-muted font-medium">
                      w: {(factor.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full mt-1.5">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barColor}`}
                      style={{ width: `${factor.score}%` }}
                    />
                  </div>
                </div>
                <ChevronDown
                  className={`w-4 h-4 text-text-muted shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-3 pt-0">
                      <ul className="space-y-1.5 ml-7">
                        {factor.reasons.slice(0, 4).map((reason, i) => (
                          <li key={i} className="text-xs text-text-secondary flex items-start gap-2">
                            <span className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${barColor}`} />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </div>
  );
}
