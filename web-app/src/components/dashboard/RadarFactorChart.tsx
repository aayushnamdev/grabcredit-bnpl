"use client";

import React from "react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import type { ScoreResult } from "@/types/api";

interface RadarFactorChartProps {
  factors: ScoreResult["factors"];
  score: number;
}

export function RadarFactorChart({ factors, score }: RadarFactorChartProps) {
  const data = [
    { subject: "Consistency", A: factors.purchaseConsistency.score, fullMark: 100 },
    { subject: "Deal Quality", A: factors.dealEngagement.score, fullMark: 100 },
    { subject: "Trajectory", A: factors.financialTrajectory.score, fullMark: 100 },
    { subject: "Risk Mgmt", A: factors.riskSignals.score, fullMark: 100 },
    { subject: "Maturity", A: factors.accountMaturity.score, fullMark: 100 },
  ];

  const color = score >= 600 ? "#60a600" : score >= 400 ? "#f59e0b" : "#ef4444";

  return (
    <div className="card p-6 flex flex-col items-center">
      <h3 className="font-semibold text-text-primary mb-2 self-start">Behavioral Shape</h3>
      <div className="w-full h-[250px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
            <PolarGrid stroke="#e5e7eb" />
            <PolarAngleAxis
              dataKey="subject"
              tick={{ fill: "#515151", fontSize: 11 }}
            />
            <Radar
              name="Score"
              dataKey="A"
              stroke={color}
              fill={color}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-text-muted mt-2 px-4 text-center">
        Larger polygon area correlates with lower default risk
      </p>
    </div>
  );
}
