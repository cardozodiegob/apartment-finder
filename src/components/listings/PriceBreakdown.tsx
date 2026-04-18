"use client";

interface PriceBreakdownProps {
  monthlyRent: number;
  currency: string;
  deposit?: number;
  billsEstimate?: number;
  utilitiesIncluded?: boolean;
}

function Row({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <span className={muted ? "text-xs text-[var(--text-muted)]" : "text-sm text-[var(--text-secondary)]"}>
        {label}
      </span>
      <span className={muted ? "text-xs text-[var(--text-muted)]" : "text-sm text-[var(--text-primary)]"}>
        {value}
      </span>
    </div>
  );
}

export default function PriceBreakdown({
  monthlyRent,
  currency,
  deposit,
  billsEstimate,
  utilitiesIncluded,
}: PriceBreakdownProps) {
  // Nothing extra to show — skip
  if (deposit === undefined && billsEstimate === undefined) return null;

  const total =
    monthlyRent + (utilitiesIncluded ? 0 : billsEstimate ?? 0);

  return (
    <div className="glass-card">
      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2">Price breakdown</h3>
      <Row
        label="Monthly rent"
        value={`${currency} ${monthlyRent.toLocaleString()}`}
      />
      {billsEstimate !== undefined && billsEstimate > 0 && (
        <Row
          label={utilitiesIncluded ? "Utilities (included)" : "Utilities (est.)"}
          value={
            utilitiesIncluded
              ? "— "
              : `+ ${currency} ${billsEstimate.toLocaleString()}`
          }
        />
      )}
      <div className="h-px bg-[var(--border)] my-2" />
      <div className="flex items-baseline justify-between py-1">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Total / month</span>
        <span className="text-base font-bold text-[var(--text-primary)]">
          {currency} {total.toLocaleString()}
        </span>
      </div>
      {deposit !== undefined && deposit > 0 && (
        <Row
          label="Deposit (one-time)"
          value={`${currency} ${deposit.toLocaleString()}`}
          muted
        />
      )}
    </div>
  );
}
