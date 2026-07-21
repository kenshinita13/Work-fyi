import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/database";

const statusStyles: Record<TaskStatus, { label: string; className: string }> = {
  todo: {
    label: "To do",
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  in_progress: {
    label: "In progress",
    className: "border-status-active/25 bg-status-active/10 text-status-active",
  },
  review: {
    label: "Review",
    className: "border-status-hold/25 bg-status-hold/10 text-status-hold",
  },
  done: {
    label: "Done",
    className:
      "border-status-completed/25 bg-status-completed/10 text-status-completed",
  },
  cancelled: {
    label: "Cancelled",
    className: "border-destructive/25 bg-destructive/10 text-destructive",
  },
};

export function TaskStatusBadge({
  status,
  className,
}: {
  status: TaskStatus;
  className?: string;
}) {
  const config = statusStyles[status];
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
