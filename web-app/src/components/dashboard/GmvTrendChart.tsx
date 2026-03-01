"use client";

import React from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface GmvTrendChartProps {
  gmvTrend: number[];
}

const MONTH_LABELS = [
  "Mar", "Apr", "May", "Jun", "Jul", "Aug",
  "Sep", "Oct", "Nov", "Dec", "Jan", "Feb",
];

export function GmvTrendChart({ gmvTrend }: GmvTrendChartProps) {
  const data = gmvTrend.map((value, i) => ({
    month: MONTH_LABELS[i] || `M${i + 1}`,
    gmv: value,
  }));

  return (
    <div className="card p-6">
      <h3 className="font-semibold text-text-primary mb-4">GMV Trend (12 Months)</h3>
      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gmvGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#60a600" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#60a600" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#8a8a8a" }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fill: "#8a8a8a" }}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
              width={40}
            />
            <Tooltip
              contentStyle={{
                borderRadius: "12px",
                border: "1px solid #e5e7eb",
                boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                fontSize: 13,
              }}
              formatter={(value: number | undefined) => [`₹${(value ?? 0).toLocaleString()}`, "GMV"]}
            />
            <Area
              type="monotone"
              dataKey="gmv"
              stroke="#60a600"
              strokeWidth={2}
              fill="url(#gmvGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
