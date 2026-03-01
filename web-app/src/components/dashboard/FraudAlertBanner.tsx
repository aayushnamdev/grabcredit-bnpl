"use client";

import React from "react";
import { ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";
import type { FraudResult } from "@/types/api";

interface FraudAlertBannerProps {
  fraudFlags: FraudResult;
}

export function FraudAlertBanner({ fraudFlags }: FraudAlertBannerProps) {
  if (!fraudFlags.flagged) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-danger-50 border border-red-200 rounded-xl p-4 flex gap-4"
    >
      <div className="bg-red-100 p-2 rounded-full h-fit shrink-0">
        <ShieldAlert className="w-5 h-5 text-danger-600" />
      </div>
      <div>
        <h4 className="font-bold text-danger-900 text-sm mb-1">
          Fraud Velocity Flags Detected
          <span className="ml-2 text-xs font-medium text-danger-700 bg-red-100 px-2 py-0.5 rounded-full">
            Action: {fraudFlags.action}
          </span>
        </h4>
        <ul className="list-disc list-inside text-sm text-danger-700 space-y-0.5">
          {fraudFlags.flags.map((flag, idx) => (
            <li key={idx}>{flag}</li>
          ))}
        </ul>
      </div>
    </motion.div>
  );
}
