import { LeadStatus, STATUS_CLASSES, STATUS_DOT, STATUS_LABEL } from "@/lib/leads";
import { cn } from "@/lib/utils";

interface Props {
  status: LeadStatus;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, className, size = "sm" }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium",
        STATUS_CLASSES[status],
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
        className
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
