import { PersonaSwitcher } from "@/components/personas/PersonaSwitcher";
import { ProductCheckout } from "@/components/checkout/ProductCheckout";
import { ScoringDashboard } from "@/components/dashboard/ScoringDashboard";

export default function Home() {
  return (
    <main className="min-h-screen pb-20 relative" style={{ backgroundColor: "var(--color-page)" }}>
      {/* Premium Header */}
      <header className="bg-surface border-b border-border/80 shadow-sm relative z-20">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center font-extrabold text-2xl text-white shadow-lg shadow-brand-500/20">
                G
              </div>
              <div>
                <h1 className="text-2xl font-extrabold tracking-tight text-text-primary flex items-center gap-2">
                  GrabCredit
                  <span className="badge-green-soft border border-brand-100/50">
                    BNPL Checkout
                  </span>
                </h1>
                <p className="text-text-secondary text-xs font-medium mt-0.5">
                  Instant credit &middot; Zero paperwork
                </p>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-text-muted uppercase tracking-widest mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse" />
                Live Environment
              </div>
              <div className="flex items-center gap-3 text-xs font-semibold text-text-secondary bg-gray-50 px-3 py-1.5 rounded-lg border border-border">
                <span>Poonawalla Fincorp</span>
                <span className="text-divider">&times;</span>
                <span>PayU</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sticky persona bar */}
      <PersonaSwitcher />

      {/* Checkout Section */}
      <ProductCheckout />

      {/* Divider */}
      <div className="max-w-6xl mx-auto px-4 my-4">
        <div className="h-px w-full bg-divider" />
      </div>

      {/* Dashboard Section */}
      <ScoringDashboard />
    </main>
  );
}
