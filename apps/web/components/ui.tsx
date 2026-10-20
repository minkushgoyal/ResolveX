"use client";

import { cn } from "@resolvex/ui";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import { motion } from "framer-motion";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

// ─── Card ──────────────────────────────────────────────────────────────────
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rx-card", className)} {...props} />;
}

// ─── Button ────────────────────────────────────────────────────────────────
export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
}) {
  const base =
    "inline-flex items-center justify-center gap-1.5 font-semibold rounded-lg rx-transition focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

  const variants = {
    primary:
      "bg-primary text-primary-foreground hover:opacity-90 active:opacity-80",
    secondary:
      "bg-secondary/10 text-secondary hover:bg-secondary/18 border border-secondary/20",
    ghost: "bg-transparent text-foreground hover:bg-muted",
    outline:
      "border border-border bg-transparent text-foreground hover:bg-muted",
    danger: "bg-danger text-white hover:opacity-90 active:opacity-80"
  };

  const sizes = {
    sm: "h-8 px-3 text-xs",
    md: "h-9 px-3.5 text-sm",
    lg: "h-10 px-5 text-sm"
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    />
  );
}

// ─── Badge ─────────────────────────────────────────────────────────────────
export function Badge({
  children,
  tone = "slate",
  className
}: {
  children: ReactNode;
  tone?: "slate" | "green" | "amber" | "red" | "blue" | "teal" | "coral";
  className?: string;
}) {
  const tones = {
    slate:
      "bg-slate-100 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300",
    green:
      "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    amber:
      "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    red: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300",
    blue: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
    teal: "bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
    coral:
      "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300"
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold leading-none",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

// ─── StatusDot ─────────────────────────────────────────────────────────────
export function StatusDot({
  tone = "slate",
  label
}: {
  tone?: "green" | "amber" | "red" | "slate";
  label?: string;
}) {
  const dotColors = {
    green: "bg-emerald-500",
    amber: "bg-amber-400",
    red: "bg-red-500",
    slate: "bg-slate-400"
  };

  const labelColors = {
    green: "text-emerald-700 dark:text-emerald-400",
    amber: "text-amber-700 dark:text-amber-400",
    red: "text-red-700 dark:text-red-400",
    slate: "text-muted-foreground"
  };

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full flex-shrink-0", dotColors[tone])} />
      {label && (
        <span className={cn("text-xs font-medium", labelColors[tone])}>
          {label}
        </span>
      )}
    </span>
  );
}

// ─── AlertBanner ───────────────────────────────────────────────────────────
// For action-required inline banners — not toasts
export function AlertBanner({
  tone = "info",
  title,
  description,
  action,
  onDismiss,
  className
}: {
  tone?: "info" | "warning" | "error" | "success";
  title: string;
  description?: string;
  action?: ReactNode;
  onDismiss?: () => void;
  className?: string;
}) {
  const configs = {
    info: {
      container: "border-blue-200/60 bg-blue-50/60 dark:border-blue-900/30 dark:bg-blue-950/25",
      icon: Info,
      iconClass: "text-blue-600 dark:text-blue-400",
      titleClass: "text-blue-900 dark:text-blue-200"
    },
    warning: {
      container: "border-amber-200/70 bg-amber-50/60 dark:border-amber-900/30 dark:bg-amber-950/25",
      icon: AlertTriangle,
      iconClass: "text-amber-600 dark:text-amber-400",
      titleClass: "text-amber-900 dark:text-amber-200"
    },
    error: {
      container: "border-red-200/60 bg-red-50/50 dark:border-red-900/30 dark:bg-red-950/20",
      icon: AlertCircle,
      iconClass: "text-red-600 dark:text-red-400",
      titleClass: "text-red-900 dark:text-red-200"
    },
    success: {
      container: "border-emerald-200/60 bg-emerald-50/50 dark:border-emerald-900/30 dark:bg-emerald-950/20",
      icon: CheckCircle2,
      iconClass: "text-emerald-600 dark:text-emerald-400",
      titleClass: "text-emerald-900 dark:text-emerald-200"
    }
  };

  const cfg = configs[tone];
  const Icon = cfg.icon;

  return (
    <div className={cn("rounded-xl border p-4", cfg.container, className)}>
      <div className="flex items-start gap-3">
        <Icon size={16} className={cn("mt-0.5 shrink-0", cfg.iconClass)} />
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-semibold", cfg.titleClass)}>{title}</p>
          {description && (
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">{description}</p>
          )}
          {action && <div className="mt-2.5 flex flex-wrap gap-2">{action}</div>}
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground rx-transition"
            aria-label="Dismiss"
          >
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ─── AnimatedSection ───────────────────────────────────────────────────────
export function AnimatedSection({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-skeleton rounded", className)} />;
}

// ─── SectionHeader ─────────────────────────────────────────────────────────
export function SectionHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        {eyebrow && (
          <p className="rx-eyebrow mb-1">{eyebrow}</p>
        )}
        <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{title}</h2>
        {description && (
          <p className="mt-1 text-sm text-muted-foreground max-w-xl">{description}</p>
        )}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
    </div>
  );
}

// ─── EmptyState ────────────────────────────────────────────────────────────
export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {Icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-muted">
          <Icon size={24} className="text-muted-foreground/60" />
        </div>
      )}
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
