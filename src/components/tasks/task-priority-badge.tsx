import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { TaskPriority } from "@/types/database";

const priorityStyles: Record<
  TaskPriority,
  { label: string; className: string }
> = {
  low: { label: "Low", className: "text-muted-foreground" },
  medium: { label: "Medium", className: "text-status-completed" },
  high: { label: "High", className: "text-status-hold" },
  urgent: { label: "Urgent", className: "text-destructive" },
};

export function TaskPriorityBadge({
  priority,
  className,
}: {
  priority: TaskPriority;
  className?: string;
}) {
  const config = priorityStyles[priority];
  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
