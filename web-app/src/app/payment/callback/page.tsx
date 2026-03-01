"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, XCircle, Clock } from "lucide-react";

function CallbackContent() {
  const params = useSearchParams();

  const status = params.get("status") ?? "pending";
  const txnid = params.get("txnid") ?? "";
  const mihpayid = params.get("mihpayid") ?? "";
  const amount = params.get("amount") ?? "";
  const productinfo = params.get("productinfo") ?? "";
  const errorMessage = params.get("error_Message") ?? params.get("error_message") ?? "";

  const isSuccess = status === "success";
  const isFailure = status === "failure";

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full">
        {/* Icon */}
        <div className="flex justify-center mb-4">
          {isSuccess ? (
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9 text-green-600" />
            </div>
          ) : isFailure ? (
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <XCircle className="w-9 h-9 text-red-600" />
            </div>
          ) : (
            <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center">
              <Clock className="w-9 h-9 text-amber-600" />
            </div>
          )}
        </div>

        {/* Heading */}
        <h1 className="text-xl font-bold text-center text-gray-900 mb-1">
          {isSuccess ? "Payment Successful" : isFailure ? "Payment Failed" : "Payment Pending"}
        </h1>
        <p className="text-sm text-gray-500 text-center mb-6">
          {isSuccess
            ? "Your EMI plan has been created via PayU LazyPay."
            : isFailure
            ? errorMessage || "Something went wrong. Please try again."
            : "Your payment is being processed."}
        </p>

        {/* Transaction details */}
        {(txnid || mihpayid || amount) && (
          <div className="bg-gray-50 rounded-xl p-4 space-y-2.5 text-sm mb-6">
            {txnid && (
              <div className="flex justify-between">
                <span className="text-gray-500">Transaction ID</span>
                <span className="font-mono text-xs text-gray-800">{txnid}</span>
              </div>
            )}
            {mihpayid && (
              <div className="flex justify-between">
                <span className="text-gray-500">PayU ID</span>
                <span className="font-mono text-xs text-gray-800">{mihpayid}</span>
              </div>
            )}
            {amount && (
              <div className="flex justify-between">
                <span className="text-gray-500">Amount</span>
                <span className="font-semibold text-gray-800">₹{Number(amount).toLocaleString("en-IN")}</span>
              </div>
            )}
            {productinfo && (
              <div className="flex justify-between">
                <span className="text-gray-500">Product</span>
                <span className="text-gray-800">{productinfo}</span>
              </div>
            )}
          </div>
        )}

        {/* PayU sandbox badge */}
        <div className="flex justify-center mb-5">
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
            ● LIVE — PayU Sandbox
          </span>
        </div>

        <a
          href="/"
          className="block w-full bg-brand-600 text-white text-sm font-semibold text-center py-3 rounded-xl hover:bg-brand-700 transition-colors"
        >
          Back to GrabCredit
        </a>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  );
}
