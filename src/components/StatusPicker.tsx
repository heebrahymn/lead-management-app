import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LeadStatus, STATUSES, STATUS_CLASSES, STATUS_DOT, STATUS_LABEL } from "@/lib/leads";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";

interface Props {
  status: LeadStatus;
  onChange: (s: LeadStatus) => void;
  size?: "sm" | "md";
}

export function StatusPicker({ status, onChange, size = "sm" }: Props) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-medium transition hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
          STATUS_CLASSES[status],
          size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm"
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", STATUS_DOT[status])} />
        {STATUS_LABEL[status]}
        <ChevronDown className="h-3 w-3 opacity-60" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" onClick={(e) => e.stopPropagation()}>
        {STATUSES.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => onChange(s.value)}
            className="gap-2"
          >
            <span className={cn("h-2 w-2 rounded-full", STATUS_DOT[s.value])} />
            {s.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
