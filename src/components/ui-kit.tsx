import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border border-border-card bg-bg-card ${padded ? "p-5" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  hint,
  action,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-[15px] font-semibold text-text-title">{title}</h2>
        {hint ? <p className="text-[12px] text-text-sec">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  delta,
  icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  delta?: string;
  icon?: ReactNode;
  tone?: "primary" | "ia" | "hot" | "success";
}) {
  const toneMap: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    ia: "bg-ia-bg text-ia",
    hot: "bg-hot-bg text-hot",
    success: "bg-success-bg text-success",
  };
  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${toneMap[tone]}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-text-sec">{label}</div>
        <div className="text-[22px] font-semibold text-text-title leading-tight">{value}</div>
        {delta ? <div className="text-[11px] text-success mt-0.5">{delta}</div> : null}
      </div>
    </Card>
  );
}

export function TempBadge({ t }: { t: "hot" | "warm" | "cold" }) {
  const map = {
    hot: { bg: "bg-hot-bg", tx: "text-hot", label: "Quente" },
    warm: { bg: "bg-warm-bg", tx: "text-warm", label: "Morno" },
    cold: { bg: "bg-cold-bg", tx: "text-cold", label: "Frio" },
  }[t];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${map.bg} ${map.tx}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {map.label}
    </span>
  );
}

export function OwnerBadge({ owner }: { owner: string }) {
  const isAI = owner.startsWith("Ana");
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        isAI ? "bg-ia-bg text-ia" : "bg-primary/10 text-primary"
      }`}
    >
      {isAI ? "🤖" : "👤"} {owner}
    </span>
  );
}
