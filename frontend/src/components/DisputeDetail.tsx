import { useState } from "react";
import { Bot, Gavel, Sparkles, ShieldCheck, Ban, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge, ActionBadge, ActorBadge } from "@/components/badges";
import { cn } from "@/lib/utils";
import { formatCents, formatTime, labelize } from "@/lib/format";
import type { CasesGetResponse, CasesResolveResponse } from "@/lib/api";

const RESOLUTIONS = ["refund", "deny", "partial"];

export function DisputeDetail({
  detail,
  onTriage,
  onResolve,
  triaging,
  resolving,
  lastResolve,
}: {
  detail: CasesGetResponse;
  onTriage: () => void;
  onResolve: (resolution: string) => void;
  triaging: boolean;
  resolving: boolean;
  lastResolve: CasesResolveResponse | null;
}) {
  const dispute = detail.dispute;
  const rule = detail.rule;
  const allowedResolution = rule ? String(rule.allowed_resolution) : "refund";
  const [resolution, setResolution] = useState<string>(allowedResolution);

  // The endpoint's precondition guarantees a dispute; narrow the response type.
  if (!dispute) return null;

  const txn = detail.transaction;
  const actions = [...(detail.actions ?? [])].reverse();
  const runs = detail.agent_runs ?? [];
  const amount = Number(dispute.amount_cents);

  return (
    <div className="flex flex-col gap-4">
      {/* Case, transaction, and the governing rule side by side. */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2">
          <CardTitle>
            Dispute #{Number(dispute.id)} · {labelize(String(dispute.reason_code))}
          </CardTitle>
          <StatusBadge status={String(dispute.status)} />
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field label="Transaction">
            <div className="text-sm">{String(txn?.merchant ?? "")}</div>
            <div className="text-muted-foreground text-xs">
              {formatCents(Number(txn?.amount_cents))} · card ····
              {String(txn?.card_last4 ?? "")}
            </div>
            <div className="text-muted-foreground text-xs">
              {String(txn?.account_ref ?? "")} · {formatTime(Number(txn?.occurred_at))}
            </div>
          </Field>
          <Field label="Dispute amount">
            <div className="text-lg font-semibold">{formatCents(amount)}</div>
          </Field>
          <Field label="Governing rule">
            {rule ? (
              <div className="text-xs leading-relaxed">
                <div>
                  Allowed:{" "}
                  <span className="text-foreground font-medium">
                    {labelize(String(rule.allowed_resolution))}
                  </span>
                </div>
                <div>
                  Ceiling:{" "}
                  <span className="text-foreground font-medium">
                    {formatCents(Number(rule.max_auto_resolve_cents))}
                  </span>
                </div>
                <div>
                  Min role:{" "}
                  <span className="text-foreground font-medium">
                    {labelize(String(rule.requires_role))}
                  </span>
                </div>
              </div>
            ) : (
              <span className="text-muted-foreground text-xs">No rule</span>
            )}
          </Field>
        </CardContent>
      </Card>

      {/* The two governed actions: propose (agent) and apply (rule-guarded). */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="size-4 text-primary" /> AI triage
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-muted-foreground text-sm">
              The agent classifies the case and proposes a resolution inside the
              rule. It proposes only. It never applies.
            </p>
            <Button onClick={onTriage} disabled={triaging} className="gap-1.5">
              <Bot className="size-4" />
              {triaging ? "Running agent..." : "Run agent triage"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Gavel className="size-4 text-primary" /> Apply resolution
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Select value={resolution} onValueChange={setResolution}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTIONS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {labelize(r)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => onResolve(resolution)}
              disabled={resolving}
              variant="secondary"
              className="gap-1.5"
            >
              <ShieldCheck className="size-4" />
              {resolving ? "Checking rule..." : `Apply for ${formatCents(amount)}`}
            </Button>
            {lastResolve && (
              <div
                className={cn(
                  "flex items-start gap-2 rounded-md border p-3 text-sm",
                  lastResolve.outcome === "applied"
                    ? "border-success/40 bg-success/10"
                    : "border-destructive/40 bg-destructive/10",
                )}
              >
                {lastResolve.outcome === "applied" ? (
                  <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
                ) : (
                  <Ban className="text-destructive mt-0.5 size-4 shrink-0" />
                )}
                <div>
                  <div className="font-medium">
                    {lastResolve.outcome === "applied"
                      ? "Resolution applied"
                      : "Blocked by the rule"}
                  </div>
                  <div className="text-muted-foreground">
                    {String(lastResolve.message)}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* What the agent proposed, most recent first. */}
      {runs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Agent proposals</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {runs.map((run) => (
              <div
                key={Number(run.id)}
                className="border-border flex flex-col gap-1 rounded-md border p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    Proposed {labelize(String(run.proposed_resolution))} ·{" "}
                    {formatCents(Number(run.proposed_amount_cents))}
                  </span>
                  {run.allowed ? (
                    <span className="text-success text-xs font-medium">
                      Within policy
                    </span>
                  ) : (
                    <span className="text-destructive text-xs font-medium">
                      Needs supervisor
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-sm">
                  {String(run.classification)}
                </p>
                {run.blocked_reason && (
                  <p className="text-destructive/90 text-xs">
                    {String(run.blocked_reason)}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* The shared audit trail: human and agent actions interleaved. */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Audit trail (newest first)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {actions.map((a) => (
            <div
              key={Number(a.id)}
              className="border-border flex items-start justify-between gap-3 rounded-md border p-3"
            >
              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <ActionBadge action={String(a.action)} />
                  <ActorBadge kind={String(a.actor_kind)} />
                </div>
                <p className="text-muted-foreground text-sm">{String(a.detail)}</p>
              </div>
              <span className="text-muted-foreground shrink-0 text-xs">
                {formatTime(Number(a.created_at))}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
        {label}
      </span>
      {children}
    </div>
  );
}
