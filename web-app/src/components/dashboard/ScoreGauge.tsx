"use client";

import React from "react";
import { motion } from "framer-motion";

interface ScoreGaugeProps {
  score: number;
  tier: string;
  maxScore?: number;
}

export function ScoreGauge({ score, tier, maxScore = 1000 }: ScoreGaugeProps) {
  const percentage = Math.min(score / maxScore, 1);
  const circumference = 2 * Math.PI * 70; // radius = 70
  const strokeDashoffset = circumference * (1 - percentage);

  const color = score >= 800 ? "#60a600" :
    score >= 600 ? "#2491ef" :
    score >= 400 ? "#f59e0b" :
    "#ef4444";

  const tierLabel = tier === "pre-approved" ? "Pre-Approved" :
    tier === "approved" ? "Approved" :
    tier === "conditional" ? "Conditional" :
    tier === "fraud-rejected" ? "Fraud Flagged" :
    "Rejected";

  const tierBg = score >= 800 ? "bg-brand-50 text-brand-700" :
    score >= 600 ? "bg-blue-50 text-blue-700" :
    score >= 400 ? "bg-warning-50 text-amber-700" :
    "bg-danger-50 text-danger-700";

  return (
    <div className="card p-6 flex flex-col items-center justify-center">
      <h3 className="font-semibold text-text-primary mb-4 self-start">GrabCredit Score</h3>

      <div className="relative w-[180px] h-[180px]">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 160 160">
          {/* Background circle */}
          <circle
            cx="80" cy="80" r="70"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="10"
          />
          {/* Animated score arc */}
          <motion.circle
            cx="80" cy="80" r="70"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-extrabold tracking-tighter"
            style={{ color }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-xs text-text-muted font-medium">/ {maxScore}</span>
        </div>
      </div>

      <div className={`mt-4 px-3 py-1 rounded-full text-xs font-bold ${tierBg}`}>
        {tierLabel}
      </div>
    </div>
  );
}
