import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ProjectStatus } from "@/types/database";

const statusStyles: Record<
  ProjectStatus,
  { label: string; className: string }
> = {
  active: {
    label: "Active",
    className: "border-status-active/25 bg-status-active/10 text-status-active",
  },
  on_hold: {
    label: "On hold",
    className: "border-status-hold/25 bg-status-hold/10 text-status-hold",
  },
  completed: {
    label: "Completed",
    className:
      "border-status-completed/25 bg-status-completed/10 text-status-completed",
  },
  archived: {
    label: "Archived",
    className:
      "border-status-archived/25 bg-status-archived/10 text-status-archived",
  },
};

export function ProjectStatusBadge({
  status,
  className,
}: {
  status: ProjectStatus;
  className?: string;
}) {
  const config = statusStyles[status];

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
