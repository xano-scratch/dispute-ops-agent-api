import { Bot, User } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { labelize } from "@/lib/format";

/** Dispute status → a colored badge. */
export function StatusBadge({ status }: { status: string }) {
  const tone: Record<string, string> = {
    open: "bg-secondary text-secondary-foreground",
    triaged: "bg-primary/15 text-primary border border-primary/30",
    resolved: "bg-success text-success-foreground",
    rejected: "bg-destructive text-white",
    escalated: "bg-warning text-warning-foreground",
  };
  return (
    <Badge className={cn("font-medium", tone[status] ?? "bg-secondary")}>
      {labelize(status)}
    </Badge>
  );
}

/** Audit action → a colored badge. Apply is green, block is red. */
export function ActionBadge({ action }: { action: string }) {
  const tone: Record<string, string> = {
    open: "bg-secondary text-secondary-foreground",
    triage: "bg-secondary text-secondary-foreground",
    propose: "bg-primary/15 text-primary border border-primary/30",
    apply: "bg-success text-success-foreground",
    block: "bg-destructive text-white",
  };
  return (
    <Badge className={cn("font-medium", tone[action] ?? "bg-secondary")}>
      {labelize(action)}
    </Badge>
  );
}

/** Who acted: a human or the AI agent, with an icon so the trail reads fast. */
export function ActorBadge({ kind }: { kind: string }) {
  const isAgent = kind === "agent";
  return (
    <Badge
      variant={isAgent ? "default" : "outline"}
      className={cn(
        "gap-1 font-medium",
        isAgent && "bg-primary text-primary-foreground",
      )}
    >
      {isAgent ? <Bot className="size-3" /> : <User className="size-3" />}
      {isAgent ? "Agent" : "Human"}
    </Badge>
  );
}
