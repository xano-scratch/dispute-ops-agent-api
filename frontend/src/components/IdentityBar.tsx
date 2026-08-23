import { Bot, User, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCents, labelize } from "@/lib/format";
import type { Operator } from "@/lib/api";

export type IdentityKey = "triage" | "supervisor" | "agent";

const ORDER: { key: IdentityKey; icon: typeof User }[] = [
  { key: "triage", icon: User },
  { key: "supervisor", icon: ShieldCheck },
  { key: "agent", icon: Bot },
];

/**
 * The identity switcher. Every guarded call below carries the selected
 * identity's token, so the viewer watches one rule layer treat a human triage
 * operator, a human supervisor, and the AI agent identity consistently.
 */
export function IdentityBar({
  operators,
  current,
  onChange,
}: {
  operators: Record<IdentityKey, Operator>;
  current: IdentityKey;
  onChange: (key: IdentityKey) => void;
}) {
  const active = operators[current];
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {ORDER.map(({ key, icon: Icon }) => {
          const op = operators[key];
          const selected = key === current;
          return (
            <Button
              key={key}
              variant={selected ? "default" : "outline"}
              onClick={() => onChange(key)}
              className={cn("h-auto flex-col items-start gap-0.5 py-2")}
            >
              <span className="flex items-center gap-1.5 text-sm font-semibold">
                <Icon className="size-3.5" />
                {op.name}
              </span>
              <span
                className={cn(
                  "text-xs",
                  selected
                    ? "text-primary-foreground/80"
                    : "text-muted-foreground",
                )}
              >
                {op.kind === "agent" ? "AI agent" : "Human"} ·{" "}
                {labelize(op.role)}
              </span>
            </Button>
          );
        })}
      </div>
      <p className="text-muted-foreground text-sm">
        Acting as <span className="text-foreground font-medium">{active.name}</span>
        . Self-resolve limit{" "}
        <span className="text-foreground font-medium">
          {(active.resolve_limit_cents ?? 0) > 0
            ? formatCents(active.resolve_limit_cents)
            : "none"}
        </span>
        . The same endpoints enforce the same rule for this identity, human or
        agent.
      </p>
    </div>
  );
}
