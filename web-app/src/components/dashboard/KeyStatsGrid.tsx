"use client";

import React from "react";
import {
  ShoppingBag,
  CalendarDays,
  Layers,
  TrendingUp,
  RotateCcw,
  IndianRupee,
  BadgePercent,
} from "lucide-react";
import type { UserProfile } from "@/types/api";

interface KeyStatsGridProps {
  profile: UserProfile;
}

export function KeyStatsGrid({ profile }: KeyStatsGridProps) {
  const gmvArr = profile.gmv_trend_12m;
  const firstHalf = gmvArr.slice(0, 6).reduce((a, b) => a + b, 0);
  const secondHalf = gmvArr.slice(6).reduce((a, b) => a + b, 0);
  const gmvChange = firstHalf > 0
    ? Math.round(((secondHalf - firstHalf) / firstHalf) * 100)
    : 0;
  const gmvTrendLabel = gmvChange > 0 ? `+${gmvChange}%` : gmvChange === 0 ? "Flat" : `${gmvChange}%`;

  const stats = [
    {
      label: "Transactions",
      value: profile.total_transactions.toLocaleString(),
      icon: ShoppingBag,
      color: "text-brand-600",
      bg: "bg-brand-50",
    },
    {
      label: "Account Age",
      value: `${profile.active_months} months`,
      icon: CalendarDays,
      color: "text-accent-500",
      bg: "bg-blue-50",
    },
    {
      label: "Categories",
      value: profile.categories_shopped.length.toString(),
      icon: Layers,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    {
      label: "GMV Trend",
      value: gmvTrendLabel,
      icon: TrendingUp,
      color: gmvChange < 0 ? "text-danger-500" : "text-brand-600",
      bg: gmvChange < 0 ? "bg-danger-50" : "bg-brand-50",
    },
    {
      label: "Return Rate",
      value: `${(profile.return_rate * 100).toFixed(1)}%`,
      icon: RotateCcw,
      color: profile.return_rate > 0.05 ? "text-danger-500" : "text-brand-600",
      bg: profile.return_rate > 0.05 ? "bg-danger-50" : "bg-brand-50",
    },
    {
      label: "Deal Redemption",
      value: `${(profile.deal_redemption_rate * 100).toFixed(0)}%`,
      icon: BadgePercent,
      color: profile.deal_redemption_rate > 0.3 ? "text-brand-600" : "text-warning-500",
      bg: profile.deal_redemption_rate > 0.3 ? "bg-brand-50" : "bg-amber-50",
    },
    {
      label: "Avg Monthly Spend",
      value: `₹${profile.avg_monthly_spend.toLocaleString()}`,
      icon: IndianRupee,
      color: "text-text-primary",
      bg: "bg-gray-50",
    },
  ];

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-text-primary mb-4">Key Signals</h3>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="bg-gray-50 border border-border rounded-xl p-3.5 flex flex-col gap-2"
          >
            <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center`}>
              <stat.icon className={`w-4 h-4 ${stat.color}`} />
            </div>
            <div>
              <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-text-muted font-medium">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
