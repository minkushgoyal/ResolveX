import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import type { ComplaintStatus } from "@resolvex/types";
import { cn } from "@resolvex/ui";

const steps: Array<{ status: ComplaintStatus; label: string }> = [
  { status: "open", label: "Complaint Raised" },
  { status: "under_review", label: "Management Reviewed" },
  { status: "assigned", label: "Staff Assigned" },
  { status: "in_progress", label: "Work In Progress" },
  { status: "resident_confirmation", label: "Resolution Pending" },
  { status: "resolved", label: "Resolved" }
];

export function ComplaintTimeline({ status }: { status: ComplaintStatus }) {
  const activeIndex = Math.max(steps.findIndex((step) => step.status === status), 0);

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const done = index < activeIndex;
        const active = index === activeIndex;
        const Icon = done ? CheckCircle2 : active ? CircleDot : Circle;
        return (
          <div key={step.status} className="flex items-center gap-3">
            <Icon className={cn(done && "text-success", active && "text-primary", !done && !active && "text-muted-foreground")} size={19} />
            <span className={cn("text-sm font-semibold", !done && !active && "text-muted-foreground")}>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}
