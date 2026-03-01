"use client";

import React, { useState, useEffect } from "react";
import { usePersonaContext } from "@/components/PersonaContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  ChevronDown,
  Sparkles,
  AlertCircle,
  ShieldAlert,
  ArrowRight,
  Calendar,
  Receipt,
  TrendingUp,
  ShieldCheck,
  Clock,
  Info,
} from "lucide-react";
import { Skeleton, SkeletonText } from "@/components/ui/Skeleton";
import type { EmiOption, PayUEmiCreateResponse } from "@/types/api";

interface BnplOfferWidgetProps {
  amount: number;
}

/** Return the first `count` complete sentences from a block of text. */
function firstSentences(text: string, count: number): string {
  const sentences = text.match(/[^.!?]+[.!?]+/g) ?? [text];
  return sentences.slice(0, count).join(' ').trim();
}

/** Returns null if the narrative is an error/unavailable string, so the UI shows a soft fallback. */
function safeNarrative(narrative: string | null | undefined): string | null {
  if (!narrative) return null;
  if (narrative.startsWith('[')) return null;
  return narrative;
}

/* ── Edge-case helpers ── */

/** Map a numeric score to the points needed to reach the next tier. */
function getNextTierGap(score: number): { nextTier: string; pointsNeeded: number; rateImprovement: string } | null {
  if (score < 400) {
    return { nextTier: 'Conditional', pointsNeeded: 400 - score, rateImprovement: '20% APR, up to ₹15K limit' };
  }
  if (score < 600) {
    return { nextTier: 'Approved', pointsNeeded: 600 - score, rateImprovement: '14% APR, up to ₹50K limit' };
  }
  if (score < 800) {
    return { nextTier: 'Pre-Approved', pointsNeeded: 800 - score, rateImprovement: '0% interest + ₹299 fee' };
  }
  return null;
}

/* ── Tier config for visual differentiation ── */
const TIER_CONFIG = {
  "pre-approved": {
    gradient: "from-brand-100/80 via-brand-50/60 to-transparent",
    border: "border-brand-300",
    headerBg: "bg-gradient-to-r from-brand-600 to-brand-500",
    iconBg: "bg-brand-500",
    accentText: "text-brand-700",
    badgeBg: "bg-brand-500",
    narrativeQuote: "narrative-quote-brand",
    narrativeBg: "bg-brand-50/70 border-brand-100",
    label: "Pre-Approved",
    tagline: "You're in the top tier!",
  },
  approved: {
    gradient: "from-blue-50/80 via-blue-50/40 to-transparent",
    border: "border-blue-200",
    headerBg: "bg-gradient-to-r from-accent-600 to-accent-500",
    iconBg: "bg-accent-500",
    accentText: "text-accent-600",
    badgeBg: "bg-accent-500",
    narrativeQuote: "narrative-quote-blue",
    narrativeBg: "bg-blue-50/70 border-blue-100",
    label: "Approved",
    tagline: "Good to go!",
  },
  conditional: {
    gradient: "from-amber-50/80 via-amber-50/40 to-transparent",
    border: "border-amber-200",
    headerBg: "bg-gradient-to-r from-amber-500 to-amber-400",
    iconBg: "bg-amber-500",
    accentText: "text-amber-700",
    badgeBg: "bg-amber-500",
    narrativeQuote: "narrative-quote-amber",
    narrativeBg: "bg-amber-50/70 border-amber-100",
    label: "Conditional",
    tagline: "Limited offer available",
  },
} as const;

type ApprovedTier = keyof typeof TIER_CONFIG;

export function BnplOfferWidget({ amount }: BnplOfferWidgetProps) {
  const { state, fetchEmiOptions, confirmEmi } = usePersonaContext();
  const { score, emiOptions, narrative, isNarrativeLoading } = state;

  const [selectedMonths, setSelectedMonths] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confirmResult, setConfirmResult] = useState<PayUEmiCreateResponse | null>(null);
  const [emiLoading, setEmiLoading] = useState(false);
  const [showSchedulePreview, setShowSchedulePreview] = useState(false);

  // Fetch EMI options when BNPL tab opens
  useEffect(() => {
    if (!score) return;
    if (score.rateTier === 0) return;
    if (emiOptions) {
      if (!selectedMonths && emiOptions.options?.length > 0) {
        setSelectedMonths(emiOptions.options[0].months);
      }
      return;
    }

    setEmiLoading(true);
    fetchEmiOptions(amount).then((result) => {
      setEmiLoading(false);
      if (result && result.options?.length > 0) {
        setSelectedMonths(result.options[0].months);
      }
    });
  }, [score, emiOptions, amount, fetchEmiOptions, selectedMonths]);

  // Reset on persona switch
  useEffect(() => {
    setIsProcessing(false);
    setConfirmResult(null);
    setSelectedMonths(null);
    setShowSchedulePreview(false);
  }, [state.personaId]);

  /* ── Loading skeleton ── */
  if (!score) {
    return (
      <div className="space-y-4 py-2">
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          <div className="p-4 flex items-start gap-3">
            <Skeleton className="w-10 h-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-3.5 w-64" />
              <Skeleton className="h-3 w-36" />
            </div>
          </div>
          <div className="px-4 pb-4 space-y-3">
            <Skeleton className="h-16 rounded-xl" />
            <div className="grid grid-cols-3 gap-2.5">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
            <Skeleton className="h-12 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  const isApproved = ["pre-approved", "approved", "conditional"].includes(score.tier);
  const isRejected = score.tier === "rejected";
  const isFraud = score.tier === "fraud-rejected";

  const activePlan: EmiOption | undefined = emiOptions?.options?.find(
    (o) => o.months === selectedMonths
  );

  const tier = isApproved ? TIER_CONFIG[score.tier as ApprovedTier] : null;

  // Edge case helpers
  const nextTierGap = getNextTierGap(score.score);
  const isLowConfidence = score.dataConfidence < 0.4;

  const submitToPayU = (result: PayUEmiCreateResponse) => {
    if (!result.payu_redirect_url || !result.payu_params) return;
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = result.payu_redirect_url;
    Object.entries(result.payu_params).forEach(([k, v]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = k;
      input.value = v;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
  };

  const handlePay = async () => {
    if (!selectedMonths) return;
    setIsProcessing(true);
    try {
      const result = await confirmEmi(amount, selectedMonths);
      if (!result) { setIsProcessing(false); return; }
      if (result.status === 'pending' && result.payu_redirect_url) {
        // Live mode: redirect browser to PayU sandbox payment page
        submitToPayU(result);
        // Keep isProcessing=true — the page will navigate away
      } else {
        setConfirmResult(result);
        setIsProcessing(false);
      }
    } catch {
      setIsProcessing(false);
    }
  };

  /* ══════════════════════════════════════════════
     SUCCESS STATE — PayU confirmation
     ══════════════════════════════════════════════ */
  if (confirmResult && confirmResult.status === "success") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-brand-50 rounded-xl p-6 border border-brand-200 relative overflow-hidden"
      >
        {/* Confetti-like top gradient bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 border-shimmer" />

        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
          className="mx-auto w-16 h-16 bg-gradient-to-br from-brand-500 to-brand-600 rounded-full flex items-center justify-center mb-4 shadow-lg shadow-brand-500/30"
        >
          <CheckCircle2 className="w-8 h-8 text-white" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <h3 className="text-lg font-bold text-brand-900 mb-1 text-center">Payment Confirmed!</h3>
          <p className="text-brand-700 text-sm text-center mb-1">
            EMI of ₹{confirmResult.monthly_emi.toLocaleString()}/mo set up via PayU
          </p>
          <p className="text-[10px] text-brand-600 text-center mb-2 font-medium">
            Poonawalla Fincorp &middot; LazyPay
          </p>
          <div className="flex justify-center mb-4">
            <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full ${confirmResult.mode === 'live' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {confirmResult.mode === 'live' ? '● LIVE — PayU Sandbox' : '● MOCK — Simulated'}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-lg p-4 border border-brand-100 space-y-2.5 text-sm"
        >
          {[
            { label: "Transaction ID", value: confirmResult.txnid, mono: true },
            { label: "PayU ID", value: confirmResult.mihpayid, mono: true },
            { label: "EMI Plan ID", value: confirmResult.emi_plan_id, mono: true },
            { label: "Tenure", value: `${confirmResult.emi_tenure} months`, mono: false },
            { label: "Total Cost", value: `₹${confirmResult.total_cost.toLocaleString()}`, mono: false },
          ].map((row) => (
            <div key={row.label} className="flex justify-between items-center">
              <span className="text-text-muted">{row.label}</span>
              <span className={`${row.mono ? "font-mono text-xs" : "font-semibold"} text-text-primary`}>
                {row.value}
              </span>
            </div>
          ))}
        </motion.div>

        {/* EMI Schedule */}
        {confirmResult.schedule && confirmResult.schedule.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-4"
          >
            <button
              onClick={() => setShowSchedulePreview(!showSchedulePreview)}
              className="w-full flex items-center justify-between text-xs font-bold text-text-muted uppercase tracking-wider mb-2 hover:text-text-secondary transition-colors"
            >
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> EMI Schedule ({confirmResult.schedule.length} installments)
              </span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showSchedulePreview ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence>
              {showSchedulePreview && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="bg-white rounded-lg border border-brand-100 overflow-hidden">
                    <div className="grid grid-cols-4 gap-1 text-[10px] font-bold uppercase text-text-muted bg-gray-50 px-3 py-2">
                      <span>#</span>
                      <span>Due Date</span>
                      <span className="text-right">Amount</span>
                      <span className="text-right">Interest</span>
                    </div>
                    {confirmResult.schedule.map((inst) => (
                      <div
                        key={inst.installment}
                        className="grid grid-cols-4 gap-1 text-xs px-3 py-1.5 border-t border-gray-50"
                      >
                        <span className="text-text-muted">{inst.installment}</span>
                        <span className="text-text-primary">{inst.due_date}</span>
                        <span className="text-right font-medium text-text-primary">
                          ₹{inst.amount.toLocaleString()}
                        </span>
                        <span className="text-right text-text-muted">₹{inst.interest.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        <button
          onClick={() => setConfirmResult(null)}
          className="mt-4 text-brand-600 text-sm font-semibold hover:underline w-full text-center"
        >
          Back to EMI options
        </button>
      </motion.div>
    );
  }

  /* ══════════════════════════════════════════════
     MAIN RENDER
     ══════════════════════════════════════════════ */
  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={state.personaId}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25 }}
        >
          {/* ── APPROVED / CONDITIONAL ── */}
          {isApproved && tier && (
            <div className={`rounded-xl overflow-hidden mb-4 border ${tier.border}`}>
              {/* Pre-approved shimmer top bar */}
              {score.tier === "pre-approved" && (
                <div className="h-1 border-shimmer" />
              )}

              {/* Header banner — tier-colored */}
              <div className={`p-4 bg-gradient-to-r ${tier.gradient} flex items-start gap-3 border-b ${tier.border}`}>
                <div className={`mt-0.5 rounded-full p-2 ${tier.iconBg} shadow-sm shrink-0`}>
                  {score.tier === "pre-approved" ? (
                    <ShieldCheck className="w-4 h-4 text-white" />
                  ) : score.tier === "approved" ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                  ) : (
                    <Clock className="w-4 h-4 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-text-primary text-[15px] tracking-tight">
                      {score.tier === "pre-approved"
                        ? "Pre-Approved for GrabCredit!"
                        : score.tier === "approved"
                          ? "Approved for GrabCredit"
                          : "GrabCredit Available"}
                    </h3>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full text-white ${tier.badgeBg}`}>
                      {tier.label}
                    </span>
                    {/* Low-confidence badge — shown when data history is sparse */}
                    {isLowConfidence && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                        <Info className="w-2.5 h-2.5" /> Limited history
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-0.5 leading-tight">
                    Credit limit: ₹{score.creditLimit.toLocaleString()}
                    {score.rateTier === 1 && " · 0% interest + flat ₹299 fee"}
                    {score.rateTier === 2 && " · 14% APR"}
                    {score.rateTier === 3 && " · 20% APR"}
                    {isLowConfidence && " · conservative limit based on available data"}
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5 font-medium">
                    Poonawalla Fincorp &middot; LazyPay
                  </p>
                </div>
              </div>

              {/* ── INLINE NARRATIVE — "You qualify because..." ── */}
              <div className={`px-4 pt-4 ${score.tier === "pre-approved" ? "pb-1" : "pb-1"}`}>
                <div className={`p-3.5 rounded-xl border ${tier.narrativeBg}`}>
                  <div className="flex items-start gap-2.5">
                    <div className="shrink-0 mt-0.5">
                      <Sparkles className={`w-4 h-4 ${tier.accentText}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1">
                        Why you qualify
                        <span className="text-[8px] font-medium normal-case tracking-normal bg-gray-100 text-text-muted px-1.5 py-px rounded-full">
                          powered by Claude AI
                        </span>
                      </p>
                      {isNarrativeLoading ? (
                        <SkeletonText lines={2} />
                      ) : safeNarrative(narrative) ? (
                        <p className={`text-[13px] leading-relaxed text-text-secondary narrative-quote ${tier.narrativeQuote}`}>
                          {firstSentences(safeNarrative(narrative)!, 3)}
                        </p>
                      ) : (
                        <p className="text-[13px] text-text-muted italic">Analysis will appear here once your profile is reviewed.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Pay Now vs EMI Comparison */}
              {emiOptions && emiOptions.options?.length > 0 && activePlan && (
                <div className="px-4 pt-3">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div className="bg-white rounded-xl p-3 border border-border text-center">
                      <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider mb-1">
                        Pay Now
                      </p>
                      <p className="text-lg font-extrabold text-text-primary">₹{amount.toLocaleString()}</p>
                      <p className="text-[10px] text-text-muted">Full amount</p>
                    </div>
                    <div className={`rounded-xl p-3 border-2 text-center relative ${
                      score.tier === "pre-approved"
                        ? "bg-brand-50 border-brand-400"
                        : score.tier === "approved"
                          ? "bg-blue-50 border-accent-500"
                          : "bg-amber-50 border-amber-400"
                    }`}>
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                        <span className={`text-[8px] font-bold text-white px-2 py-0.5 rounded-full uppercase ${tier.badgeBg}`}>
                          {score.rateTier === 1 ? "0% EMI" : "EMI"}
                        </span>
                      </div>
                      <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${tier.accentText}`}>
                        EMI
                      </p>
                      <p className={`text-lg font-extrabold ${tier.accentText}`}>
                        ₹{activePlan.monthly_emi.toLocaleString()}
                        <span className="text-xs font-semibold">/mo</span>
                      </p>
                      <p className={`text-[10px] ${tier.accentText} opacity-80`}>
                        {activePlan.months} months
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* EMI Options */}
              <div className="p-4">
                {emiLoading ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-40" />
                    <div className="grid grid-cols-3 gap-2.5">
                      <Skeleton className="h-20 rounded-xl" />
                      <Skeleton className="h-20 rounded-xl" />
                      <Skeleton className="h-20 rounded-xl" />
                    </div>
                  </div>
                ) : emiOptions && emiOptions.options?.length > 0 ? (
                  <>
                    <p className="text-sm font-semibold text-text-secondary mb-3">
                      Select your EMI tenure
                    </p>
                    <div
                      className={`grid gap-2.5 mb-4 ${
                        emiOptions.options?.length === 4
                          ? "grid-cols-2 sm:grid-cols-4"
                          : emiOptions.options?.length <= 2
                            ? "grid-cols-2"
                            : "grid-cols-3"
                      }`}
                    >
                      {emiOptions.options.map((plan, idx) => (
                        <button
                          key={plan.months}
                          onClick={() => setSelectedMonths(plan.months)}
                          className={`relative flex flex-col items-center py-3 px-1 rounded-xl border-2 transition-all overflow-hidden ${
                            selectedMonths === plan.months
                              ? `bg-white shadow-md scale-[1.02] z-10 ${
                                  score.tier === "pre-approved"
                                    ? "border-brand-500"
                                    : score.tier === "approved"
                                      ? "border-accent-500"
                                      : "border-amber-400"
                                }`
                              : "bg-white/60 border-gray-100 hover:border-gray-300 text-text-secondary hover:bg-white"
                          }`}
                        >
                          {selectedMonths === plan.months && (
                            <div className={`absolute top-0 inset-x-0 h-1 ${
                              score.tier === "pre-approved"
                                ? "bg-brand-500"
                                : score.tier === "approved"
                                  ? "bg-accent-500"
                                  : "bg-amber-500"
                            }`} />
                          )}
                          {idx === 0 && score.tier === "pre-approved" && (
                            <span className="absolute -top-0.5 -right-0.5 text-[7px] font-bold bg-brand-500 text-white px-1.5 py-px rounded-bl-lg rounded-tr-lg">
                              BEST
                            </span>
                          )}
                          <p
                            className={`text-[17px] font-extrabold tracking-tight ${
                              selectedMonths === plan.months
                                ? tier.accentText
                                : "text-text-primary"
                            }`}
                          >
                            ₹{plan.monthly_emi.toLocaleString()}
                          </p>
                          <p className="text-[10px] uppercase font-bold text-text-muted mt-0.5 tracking-wider">
                            {plan.months} months
                          </p>
                          {plan.effective_annual_rate === 0 ? (
                            <span className="text-[9px] text-brand-600 font-bold mt-1">0% INTEREST</span>
                          ) : (
                            <span className="text-[9px] text-text-muted font-medium mt-1">
                              {plan.effective_annual_rate}% APR
                            </span>
                          )}
                          {plan.total_interest > 0 && (
                            <span className="text-[8px] text-text-muted mt-0.5">
                              +₹{plan.total_interest.toLocaleString()} int.
                            </span>
                          )}
                          {plan.processing_fee > 0 && (
                            <span className="text-[8px] text-text-muted">+₹{plan.processing_fee} fee</span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Cost breakdown */}
                    {activePlan && (
                      <motion.div
                        key={selectedMonths}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm"
                      >
                        <div className="flex justify-between items-center mb-3">
                          <p className="text-xs text-text-muted uppercase tracking-widest font-bold flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5" /> Total Cost
                          </p>
                          <p className="text-sm font-bold text-text-primary border-b border-dashed border-divider">
                            ₹{activePlan.total_payable.toLocaleString()}
                          </p>
                        </div>
                        <div className="space-y-1.5 text-xs text-text-secondary">
                          <div className="flex justify-between">
                            <span>Principal Amount</span>
                            <span className="font-medium text-text-primary">₹{amount.toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Interest ({activePlan.effective_annual_rate}% APR)</span>
                            <span className="font-medium text-text-primary">
                              {activePlan.total_interest === 0
                                ? "₹0"
                                : `+₹${activePlan.total_interest.toLocaleString()}`}
                            </span>
                          </div>
                          {activePlan.processing_fee > 0 && (
                            <div className="flex justify-between">
                              <span>Processing Fee</span>
                              <span className="font-medium text-text-primary">
                                +₹{activePlan.processing_fee.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={handlePay}
                          disabled={isProcessing}
                          className={`w-full mt-5 py-3.5 text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg ${
                            score.tier === "pre-approved"
                              ? "bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 shadow-brand-500/20 hover:shadow-brand-500/30"
                              : score.tier === "approved"
                                ? "bg-accent-500 hover:bg-accent-600 disabled:bg-accent-500/50 shadow-accent-500/20 hover:shadow-accent-500/30"
                                : "bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 shadow-amber-500/20 hover:shadow-amber-500/30"
                          }`}
                        >
                          {isProcessing ? (
                            <span className="flex items-center gap-2">
                              Processing via PayU
                              <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, ease: "linear", duration: 1 }}
                                className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                              />
                            </span>
                          ) : (
                            <span className="flex items-center gap-2">
                              Pay ₹{activePlan.monthly_emi.toLocaleString()} / month
                              <ArrowRight className="w-4 h-4" />
                            </span>
                          )}
                        </button>
                        <p className="text-[10px] text-center text-text-muted mt-2 font-medium flex items-center justify-center gap-1">
                          <ShieldCheck className="w-3 h-3" />
                          Secured by PayU LazyPay &middot; Poonawalla Fincorp
                        </p>
                      </motion.div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-text-muted py-2">No EMI options available for this amount.</p>
                )}
              </div>
            </div>
          )}

          {/* ── REJECTED ── */}
          {isRejected && (
            <div className="rounded-xl overflow-hidden mb-4 border border-border">
              {/* Header */}
              <div className="bg-gray-50 p-5 text-center border-b border-border">
                <div className="mx-auto w-14 h-14 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center mb-3 text-text-muted shadow-sm">
                  <AlertCircle className="w-7 h-7" />
                </div>
                <h3 className="font-bold text-text-primary text-[15px]">GrabCredit Unavailable</h3>
                <p className="text-xs text-text-muted mt-1 leading-relaxed max-w-xs mx-auto">
                  Based on your recent activity, BNPL is not available right now. Here&apos;s what to work on.
                </p>
              </div>

              {/* Inline narrative for rejected — shows WHY */}
              <div className="px-4 pt-4">
                <div className="p-3.5 rounded-xl border bg-gray-50/50 border-gray-100">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1">
                        Credit analysis
                        <span className="text-[8px] font-medium normal-case tracking-normal bg-gray-100 text-text-muted px-1.5 py-px rounded-full">
                          Claude AI
                        </span>
                      </p>
                      {isNarrativeLoading ? (
                        <SkeletonText lines={2} />
                      ) : safeNarrative(narrative) ? (
                        <p className="text-[13px] leading-relaxed text-text-secondary narrative-quote narrative-quote-gray">
                          {firstSentences(safeNarrative(narrative)!, 3)}
                        </p>
                      ) : (
                        <p className="text-[13px] text-text-muted italic">We'll share more details once your profile is ready.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Near-miss score banner — when rejected but within striking distance of the next tier */}
              {nextTierGap && score.score >= 300 && (
                <div className="px-4 pt-3">
                  <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-amber-100 border border-amber-200 flex flex-col items-center justify-center">
                      <span className="text-sm font-extrabold text-amber-700 leading-none">{nextTierGap.pointsNeeded}</span>
                      <span className="text-[7px] font-bold text-amber-500 uppercase tracking-wide leading-none mt-0.5">pts</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-amber-800">
                        {nextTierGap.pointsNeeded} points from {nextTierGap.nextTier} tier
                      </p>
                      <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                        Reach {nextTierGap.nextTier} to unlock {nextTierGap.rateImprovement}.
                        Consistent activity over 1–2 more months typically closes this gap.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Improvement Path */}
              {score.factors && (
                <div className="px-4 pt-3 pb-4">
                  <p className="text-xs font-bold text-text-muted uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <TrendingUp className="w-3.5 h-3.5" /> Improvement Path
                  </p>
                  <div className="space-y-3">
                    {Object.entries(score.factors)
                      .sort(([, a], [, b]) => a.score - b.score)
                      .slice(0, 3)
                      .map(([key, factor]) => {
                        const labels: Record<string, string> = {
                          purchaseConsistency: "Purchase Consistency",
                          dealEngagement: "Deal Engagement",
                          financialTrajectory: "Financial Trajectory",
                          riskSignals: "Risk Signals",
                          accountMaturity: "Account Maturity",
                        };
                        const tips: Record<string, string> = {
                          purchaseConsistency: "Shop more regularly — even small purchases each month build a stronger track record.",
                          dealEngagement: "Use GrabOn coupons and explore different categories like food, fashion, and travel.",
                          financialTrajectory: "Growing your monthly spend steadily over the next few months will significantly improve your score.",
                          riskSignals: "Pay via UPI or card instead of cash on delivery, and reduce product returns where possible.",
                          accountMaturity: "Continue shopping regularly — more transactions over more months builds platform trust.",
                        };
                        const pct = Math.round(factor.score);
                        const barColor =
                          pct < 30 ? "bg-danger-500" : pct < 60 ? "bg-warning-500" : "bg-brand-500";
                        return (
                          <div key={key}>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-semibold text-text-primary">
                                {labels[key] || key}
                              </span>
                              <span className={`text-xs font-bold ${pct < 30 ? "text-danger-600" : pct < 60 ? "text-amber-600" : "text-brand-600"}`}>
                                {pct}/100
                              </span>
                            </div>
                            <div className="w-full h-1.5 bg-gray-100 rounded-full mb-1.5 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: "easeOut" }}
                                className={`h-full rounded-full ${barColor}`}
                              />
                            </div>
                            {tips[key] && (
                              <p className="text-[11px] text-text-secondary flex items-start gap-1.5">
                                <span className="text-warning-500 mt-0.5 shrink-0">&#8226;</span>
                                {tips[key]}
                              </p>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="px-4 pb-5 text-center">
                <button className="px-6 py-2.5 bg-text-primary hover:bg-gray-800 transition-colors text-white rounded-xl text-sm font-semibold shadow-md">
                  Pay Full Amount (₹{amount.toLocaleString()})
                </button>
              </div>
            </div>
          )}

          {/* ── FRAUD ── */}
          {isFraud && (
            <div className="rounded-xl overflow-hidden mb-4 border border-red-200">
              {/* Red top bar */}
              <div className="h-1 bg-gradient-to-r from-danger-500 to-danger-600" />

              <div className="bg-danger-50 p-5 text-center border-b border-red-100">
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  className="mx-auto w-14 h-14 bg-white border-2 border-red-200 rounded-full flex items-center justify-center mb-3 text-danger-500 shadow-sm"
                >
                  <ShieldAlert className="w-7 h-7" />
                </motion.div>
                <h3 className="font-bold text-danger-900 text-[15px]">Account Review Required</h3>
                <p className="text-xs text-danger-700 mt-1 leading-relaxed max-w-xs mx-auto">
                  To protect our community, this payment method is currently restricted.
                </p>
              </div>

              {/*
                Fraud flags and countdown are intentionally NOT shown in the
                customer-facing checkout widget. Revealing specific triggers
                (account age gates, pattern rules, category flags) creates a
                feedback loop that lets bad actors reverse-engineer the
                detection logic. The scoring dashboard (internal view) still
                displays all flags for evaluator / analyst review.
              */}

              {/* Narrative for fraud */}
              <div className="px-4 pt-1 pb-4">
                <div className="p-3.5 rounded-xl border bg-white border-red-100">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-danger-500 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-text-muted mb-1.5 flex items-center gap-1">
                        Risk assessment
                        <span className="text-[8px] font-medium normal-case tracking-normal bg-gray-100 text-text-muted px-1.5 py-px rounded-full">
                          Claude AI
                        </span>
                      </p>
                      {isNarrativeLoading ? (
                        <SkeletonText lines={2} />
                      ) : safeNarrative(narrative) ? (
                        <p className="text-[13px] leading-relaxed text-text-secondary narrative-quote narrative-quote-red">
                          {firstSentences(safeNarrative(narrative)!, 3)}
                        </p>
                      ) : (
                        <p className="text-[13px] text-text-muted italic">Our team has flagged this account for a manual review.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 pb-5 text-center">
                <button className="px-6 py-2.5 bg-text-primary hover:bg-gray-800 transition-colors text-white rounded-xl text-sm font-semibold shadow-md">
                  Select Alternative Payment
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
