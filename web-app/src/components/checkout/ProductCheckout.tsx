"use client";

import React, { useState } from "react";
import {
  ShieldCheck,
  CreditCard,
  Smartphone,
  WalletCards,
  Star,
  Headphones,
  Check,
  Zap,
} from "lucide-react";
import { BnplOfferWidget } from "./BnplOfferWidget";
import { usePersonaContext } from "@/components/PersonaContext";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { label: "Cart", done: true },
  { label: "Shipping", done: true },
  { label: "Payment", done: false, active: true },
];

function CheckoutStepper() {
  return (
    <div className="flex items-center justify-center gap-0 mb-8 sm:mb-10">
      {STEPS.map((step, i) => (
        <React.Fragment key={step.label}>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div
              className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center text-[10px] sm:text-[11px] font-bold transition-all shadow-sm ${
                step.done
                  ? "bg-brand-500 text-white shadow-brand-500/30"
                  : step.active
                    ? "bg-white text-brand-700 ring-2 ring-brand-500 ring-offset-2 ring-offset-page"
                    : "bg-gray-100 text-text-muted"
              }`}
            >
              {step.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span
              className={`text-[10px] sm:text-xs font-bold tracking-wide ${
                step.active ? "text-brand-700" : step.done ? "text-brand-600" : "text-text-muted"
              }`}
            >
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div
              className={`w-8 sm:w-14 h-[3px] mx-2 sm:mx-3 rounded-full transition-colors ${
                step.done ? "bg-brand-500/30" : "bg-gray-200"
              }`}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

/* ── Tier indicator pill for BNPL card ── */
function TierPill({ score }: { score: { score: number; tier: string; rateTier: number } | null }) {
  if (!score) return null;

  const config: Record<string, { bg: string; text: string; label: string }> = {
    "pre-approved": { bg: "bg-brand-50 border-brand-200", text: "text-brand-700", label: "Score: " + score.score },
    approved: { bg: "bg-blue-50 border-blue-200", text: "text-accent-600", label: "Score: " + score.score },
    conditional: { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", label: "Score: " + score.score },
    rejected: { bg: "bg-gray-50 border-gray-200", text: "text-text-muted", label: "Not eligible" },
    "fraud-rejected": { bg: "bg-danger-50 border-red-200", text: "text-danger-600", label: "Restricted" },
  };

  const c = config[score.tier] || config["rejected"];

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border ${c.bg} ${c.text}`}
    >
      {score.tier === "pre-approved" && <Zap className="w-2.5 h-2.5" />}
      {c.label}
    </motion.span>
  );
}

export function ProductCheckout() {
  const [activeTab, setActiveTab] = useState<"grabcredit" | "upi" | "card">("grabcredit");
  const { state } = usePersonaContext();
  const PRODUCT_AMOUNT = 18499;

  // Dynamic BNPL subtitle based on tier
  const getBnplSubtitle = () => {
    if (!state.score) return "Pay later in easy EMIs";
    switch (state.score.rateTier) {
      case 1:
        return "Starting at 0% interest + flat ₹299 fee";
      case 2:
        return "EMI available at 14% APR";
      case 3:
        return "EMI available at 20% APR";
      default:
        return "Check your eligibility";
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 sm:py-10">
      {/* Checkout Stepper */}
      <CheckoutStepper />

      <div className="text-center mb-6 sm:mb-8">
        <h2 className="text-xl sm:text-2xl font-extrabold text-text-primary tracking-tight">
          Select payment method
        </h2>
        <p className="text-text-muted mt-1 text-xs sm:text-sm">100% Secure Checkout via GrabOn</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-10">
        {/* Left Column - Payment Methods */}
        <div className="lg:col-span-7 flex flex-col gap-3 sm:gap-4 order-2 lg:order-1">
          {/* GrabCredit BNPL Option */}
          <div
            className={`card overflow-hidden transition-all duration-300 ${
              activeTab === "grabcredit"
                ? "border-l-4 border-l-brand-500 shadow-md"
                : "hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
            }`}
          >
            <div
              className="p-4 sm:p-5 flex items-center justify-between cursor-pointer"
              onClick={() => setActiveTab("grabcredit")}
            >
              <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                <div
                  className={`p-2 sm:p-2.5 rounded-xl transition-colors shrink-0 ${
                    activeTab === "grabcredit"
                      ? "bg-brand-50 text-brand-600"
                      : "bg-gray-50 text-text-muted"
                  }`}
                >
                  <WalletCards className="w-5 h-5 sm:w-6 sm:h-6" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-text-primary text-base sm:text-lg">GrabCredit BNPL</h3>
                    <span className="badge-green pulse-soft">Recommended</span>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap mt-0.5">
                    <p className="text-xs sm:text-sm text-text-secondary">{getBnplSubtitle()}</p>
                    <TierPill score={state.score} />
                  </div>
                  <p className="text-[10px] text-text-muted font-medium mt-0.5">
                    via Poonawalla Fincorp &middot; LazyPay
                  </p>
                </div>
              </div>
              <div
                className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-colors shrink-0 ml-2 ${
                  activeTab === "grabcredit" ? "border-brand-500 bg-brand-50" : "border-gray-300"
                }`}
              >
                {activeTab === "grabcredit" && (
                  <motion.div layoutId="radio" className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-brand-500 rounded-full" />
                )}
              </div>
            </div>

            <AnimatePresence>
              {activeTab === "grabcredit" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 sm:px-5 pb-4 sm:pb-5 overflow-hidden"
                >
                  <BnplOfferWidget amount={PRODUCT_AMOUNT} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* UPI Option */}
          <div
            className={`card p-4 sm:p-5 flex items-center justify-between transition-all duration-300 ${
              activeTab === "upi"
                ? "border-l-4 border-l-text-primary shadow-md"
                : "hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
            }`}
            onClick={() => setActiveTab("upi")}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div
                className={`p-2 sm:p-2.5 rounded-xl transition-colors ${
                  activeTab === "upi" ? "bg-gray-100 text-text-primary" : "bg-gray-50 text-text-muted"
                }`}
              >
                <Smartphone className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary text-base sm:text-lg">UPI</h3>
                <p className="text-xs sm:text-sm text-text-secondary">Google Pay, PhonePe, Paytm</p>
              </div>
            </div>
            <div
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                activeTab === "upi" ? "border-text-primary bg-gray-50" : "border-gray-300"
              }`}
            >
              {activeTab === "upi" && (
                <motion.div layoutId="radio" className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-text-primary rounded-full" />
              )}
            </div>
          </div>

          {/* Credit/Debit Card Option */}
          <div
            className={`card p-4 sm:p-5 flex items-center justify-between transition-all duration-300 ${
              activeTab === "card"
                ? "border-l-4 border-l-text-primary shadow-md"
                : "hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
            }`}
            onClick={() => setActiveTab("card")}
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div
                className={`p-2 sm:p-2.5 rounded-xl transition-colors ${
                  activeTab === "card" ? "bg-gray-100 text-text-primary" : "bg-gray-50 text-text-muted"
                }`}
              >
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h3 className="font-bold text-text-primary text-base sm:text-lg">Credit / Debit Card</h3>
                <p className="text-xs sm:text-sm text-text-secondary">Visa, Mastercard, RuPay, Amex</p>
              </div>
            </div>
            <div
              className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                activeTab === "card" ? "border-text-primary bg-gray-50" : "border-gray-300"
              }`}
            >
              {activeTab === "card" && (
                <motion.div layoutId="radio" className="w-2.5 h-2.5 sm:w-3 sm:h-3 bg-text-primary rounded-full" />
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Order Summary */}
        <div className="lg:col-span-5 relative order-1 lg:order-2">
          <div className="lg:sticky lg:top-24 card-elevated p-5 sm:p-6 lg:p-8">
            <h3 className="font-bold text-text-primary mb-5 sm:mb-6 text-base sm:text-lg tracking-tight">
              Order Summary
            </h3>

            {/* Product Info */}
            <div className="flex gap-3 sm:gap-4 mb-5 sm:mb-6 pb-5 sm:pb-6 border-b border-border items-center">
              <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gradient-to-br from-gray-50 to-gray-100 rounded-2xl flex flex-col items-center justify-center border border-border shrink-0 shadow-inner relative overflow-hidden">
                <Headphones className="w-7 h-7 sm:w-9 sm:h-9 text-gray-700 relative z-10 drop-shadow-sm" />
              </div>
              <div className="min-w-0">
                <h4 className="font-semibold text-text-primary text-xs sm:text-sm leading-snug">
                  Sony WH-1000XM5 Wireless Noise Cancelling Headphones
                </h4>
                <div className="flex items-center gap-1 mt-1">
                  {[1, 2, 3, 4].map((i) => (
                    <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
                  ))}
                  <Star className="w-3 h-3 fill-amber-400/50 text-amber-400" />
                  <span className="text-xs text-text-muted ml-1">4.5</span>
                </div>
                <p className="text-xs text-text-muted mt-1 font-medium">Qty: 1</p>
              </div>
            </div>

            {/* Price Breakdown */}
            <div className="space-y-3 sm:space-y-3.5 mb-5 sm:mb-6 text-sm">
              <div className="flex justify-between text-text-secondary">
                <span>Original Price</span>
                <span className="line-through decoration-text-muted">₹24,999</span>
              </div>
              <div className="flex justify-between font-semibold text-brand-700 bg-brand-50 p-2.5 -mx-2 rounded-lg">
                <span>GrabOn Discount (26%)</span>
                <span>-₹6,500</span>
              </div>
              <div className="flex justify-between text-text-secondary">
                <span>Delivery</span>
                <span className="text-brand-600 font-medium tracking-wide">FREE</span>
              </div>
            </div>

            {/* Total */}
            <div className="bg-gradient-to-r from-text-primary to-gray-800 rounded-xl p-4 sm:p-5 flex items-center justify-between text-white shadow-xl shadow-black/10 mt-2">
              <span className="font-medium text-white/90 text-sm">Total to Pay</span>
              <span className="text-xl sm:text-2xl font-extrabold tracking-tight">
                ₹{PRODUCT_AMOUNT.toLocaleString()}
              </span>
            </div>

            {/* Trust Badges */}
            <div className="mt-5 sm:mt-6 flex flex-col gap-1.5 text-center">
              <p className="text-xs font-medium text-text-muted flex items-center justify-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-brand-500" /> Safe & Secure Payments
              </p>
              <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mt-1">
                Powered by PayU &middot; Poonawalla Fincorp
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
