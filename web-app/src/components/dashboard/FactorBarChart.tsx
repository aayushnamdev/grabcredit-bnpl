"use client";

import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ScoreResult, PlatformAverages } from "@/types/api";

interface FactorBarChartProps {
  factors: ScoreResult["factors"];
  platformAverages: PlatformAverages | null;
}

export function FactorBarChart({ factors, platformAverages }: FactorBarChartProps) {
  const data = [
    {
      name: "Consistency",
      user: factors.purchaseConsistency.score,
      platform: platformAverages?.avgFactorScores.purchaseConsistency ?? 0,
    },
    {
      name: "Deal Quality",
      user: factors.dealEngagement.score,
      platform: platformAverages?.avgFactorScores.dealEngagement ?? 0,
    },
    {
      name: "Trajectory",
      user: factors.financialTrajectory.score,
      platform: platformAverages?.avgFactorScores.financialTrajectory ?? 0,
    },
    {
      name: "Risk Mgmt",
      user: factors.riskSignals.score,
      platform: platformAverages?.avgFactorScores.riskSignals ?? 0,
    },
    {
      name: "Maturity",
      user: factors.accountMaturity.score,
      platform: platformAverages?.avgFactorScores.accountMaturity ?? 0,
    },
  ];

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-text-primary mb-6">Factor Breakdown vs Platform Average</h3>
      <div className="h-[220px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 30, left: 10, bottom: 0 }}
            barGap={4}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              dataKey="name"
              type="category"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 12, fill: "#515151" }}
              width={90}
            />
            <Tooltip
              cursor={{ fill: "#f7f8fa" }}
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                fontSize: 13,
              }}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingBottom: 8 }}
            />
            <Bar
              dataKey="user"
              name="User Score"
              fill="#60a600"
              radius={[0, 4, 4, 0]}
              barSize={10}
            />
            <Bar
              dataKey="platform"
              name="Platform Avg"
              fill="#d6d8da"
              radius={[0, 4, 4, 0]}
              barSize={10}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
