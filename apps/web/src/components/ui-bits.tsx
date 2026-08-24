import type * as React from "react";

import { cn } from "@vps-ts-user-manager/ui/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b pb-4">
      <div>
        <h1 className="font-mono text-sm font-medium uppercase tracking-[0.14em]">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: React.ReactNode;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="border bg-card p-4">
      <p className="label-mono">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-2xl font-medium tabular-nums",
          tone === "ok" && "text-emerald-400",
          tone === "bad" && "text-red-400",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

export function StatusDot({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm">
      <span
        className={cn(
          "inline-block size-1.5 rounded-full",
          ok ? "bg-emerald-400 shadow-[0_0_6px] shadow-emerald-400/60" : "bg-red-400",
        )}
      />
      {children}
    </span>
  );
}
