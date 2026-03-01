"use client";

import React from "react";

interface CreditLimitBarProps {
  creditLimit: number;
  tier: string;
}

const TIER_CONFIG: Record<string, { color: string; bg: string; barColor: string; label: string }> = {
  "pre-approved": { color: "text-brand-700", bg: "bg-brand-50", barColor: "bg-brand-500", label: "Pre-Approved" },
  approved: { color: "text-accent-600", bg: "bg-blue-50", barColor: "bg-accent-500", label: "Approved" },
  conditional: { color: "text-amber-700", bg: "bg-amber-50", barColor: "bg-warning-500", label: "Conditional" },
  rejected: { color: "text-danger-700", bg: "bg-danger-50", barColor: "bg-danger-500", label: "Rejected" },
  "fraud-rejected": { color: "text-danger-700", bg: "bg-danger-50", barColor: "bg-danger-500", label: "Fraud Rejected" },
};

const MAX_LIMIT = 100000;

export function CreditLimitBar({ creditLimit, tier }: CreditLimitBarProps) {
  const config = TIER_CONFIG[tier] || TIER_CONFIG.rejected;
  const pct = Math.min((creditLimit / MAX_LIMIT) * 100, 100);

  return (
    <div className={`rounded-xl p-4 border ${config.bg} border-opacity-60`} style={{ borderColor: "var(--color-border)" }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-text-muted">Credit Limit</span>
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${config.bg} ${config.color}`}>
            {config.label}
          </span>
        </div>
        <span className={`text-lg font-extrabold ${config.color}`}>
          {creditLimit > 0 ? `₹${creditLimit.toLocaleString()}` : "N/A"}
        </span>
      </div>
      <div className="w-full h-2.5 bg-white rounded-full overflow-hidden border border-gray-200">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${config.barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {creditLimit > 0 && (
        <div className="flex justify-between mt-1.5 text-[10px] text-text-muted font-medium">
          <span>₹0</span>
          <span>₹{MAX_LIMIT.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
