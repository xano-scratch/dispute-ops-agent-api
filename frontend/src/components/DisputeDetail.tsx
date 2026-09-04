import { useState } from "react";
import {
  Bot,
  User,
  Sparkles,
  Gavel,
  CircleCheck,
  ShieldAlert,
  ShieldCheck,
  ScrollText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";

import type { CaseDetail, Identity, Resolution, CaseAction } from "@/lib/api";
import { RESOLUTIONS } from "@/lib/api";
import { money, when, label } from "@/lib/format";
import { statusClass } from "./DisputeQueue";

export type Notice = { tone: "ok" | "blocked" | "info"; text: string } | null;

type Props = {
  detail: CaseDetail;
  operatorsById: Record<number, Identity>;
  current: Identity;
  onTriage: () => void;
  onResolve: (resolution: Resolution) => void;
  notice: Notice;
  busy: boolean;
};

function actorName(a: CaseAction, byId: Record<number, Identity>): string {
  return byId[a.actor_id]?.name ?? (a.actor_kind === "agent" ? "AI agent" : "Operator");
}

const actionTone: Record<string, string> = {
  open: "bg-muted text-muted-foreground",
  propose: "bg-chart-4/20 text-foreground",
  apply: "bg-primary/15 text-primary",
  block: "bg-destructive/15 text-destructive",
  triage: "bg-muted text-muted-foreground",
};

export function DisputeDetail({
  detail,
  operatorsById,
  current,
  onTriage,
  onResolve,
  notice,
  busy,
}: Props) {
  const { dispute, transaction, rule, actions, agent_runs } = detail;
  const lastRun = agent_runs.length ? agent_runs[agent_runs.length - 1] : null;
  const [resolution, setResolution] = useState<Resolution>("refund");
  if (!dispute) return null;
  const closed = dispute.status === "resolved" || dispute.status === "rejected";

  return (
    <div className="flex flex-col gap-5">
      {/* Case header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold tracking-tight">Dispute #{dispute.id}</h2>
            <Badge variant="outline" className={statusClass(dispute.status)}>
              {label(dispute.status)}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {label(dispute.reason_code)} · {money(dispute.amount_cents)}
            {dispute.resolution ? ` · resolved as ${label(dispute.resolution)}` : ""}
          </p>
        </div>
      </div>

      {/* Transaction + governing rule, side by side */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="bg-card flex flex-col gap-1 rounded-lg border p-3">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Transaction
          </span>
          {transaction ? (
            <>
              <span className="text-sm font-medium">{transaction.merchant}</span>
              <span className="text-muted-foreground text-xs">
                {money(transaction.amount_cents)} · ****{transaction.card_last4} ·{" "}
                {transaction.account_ref}
              </span>
              <span className="text-muted-foreground text-xs">{when(transaction.occurred_at)}</span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">Not found</span>
          )}
        </div>

        <div className="bg-card flex flex-col gap-1 rounded-lg border p-3">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
            Governing rule
          </span>
          {rule ? (
            <>
              <span className="text-sm font-medium">{label(rule.reason_code)}</span>
              <span className="text-muted-foreground text-xs">
                Allows {label(rule.allowed_resolution)} · needs {label(rule.requires_role)}
              </span>
              <span className="text-muted-foreground text-xs">
                Auto-resolves up to {money(rule.max_auto_resolve_cents)}
              </span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">No rule</span>
          )}
        </div>
      </div>

      {/* AI triage */}
      <div className="border-primary/30 bg-primary/5 flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Bot className="text-primary size-4" />
            <span className="text-sm font-semibold">AI triage</span>
          </div>
          <Button size="sm" variant="secondary" disabled={busy} onClick={onTriage}>
            <Sparkles className="size-4" />
            Run agent triage
          </Button>
        </div>
        {lastRun ? (
          <div className="flex flex-col gap-1.5">
            <p className="text-sm">{lastRun.classification}</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="outline">
                Proposes {label(lastRun.proposed_resolution) || "—"}
              </Badge>
              {lastRun.allowed ? (
                <span className="text-primary inline-flex items-center gap-1">
                  <ShieldCheck className="size-3.5" /> Within policy ceiling
                </span>
              ) : (
                <span className="text-destructive inline-flex items-center gap-1">
                  <ShieldAlert className="size-3.5" /> {lastRun.blocked_reason || "Over ceiling"}
                </span>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            The agent has not weighed in yet. Run triage to get a policy-bounded proposal.
          </p>
        )}
      </div>

      {/* Rule-guarded apply */}
      <div className="flex flex-col gap-2 rounded-lg border p-3">
        <div className="flex items-center gap-2">
          <Gavel className="text-muted-foreground size-4" />
          <span className="text-sm font-semibold">Apply resolution</span>
        </div>
        <p className="text-muted-foreground text-xs">
          Acting as <span className="text-foreground font-medium">{current.name}</span> ({current.kind},{" "}
          {label(current.role)}) with a resolve ceiling of {money(current.resolve_limit_cents)}. The
          same guard runs for a human and the AI agent.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={resolution} onValueChange={(v) => setResolution(v as Resolution)}>
            <SelectTrigger className="h-9 w-[150px] text-xs" disabled={closed}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RESOLUTIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {label(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" disabled={busy || closed} onClick={() => onResolve(resolution)}>
            <Gavel className="size-4" />
            Apply
          </Button>
        </div>
        {notice && (
          <div
            className={`mt-1 flex items-start gap-2 rounded-md border p-2.5 text-sm ${
              notice.tone === "ok"
                ? "border-primary/30 bg-primary/10 text-foreground"
                : notice.tone === "blocked"
                  ? "border-destructive/30 bg-destructive/10 text-foreground"
                  : "bg-muted text-muted-foreground"
            }`}
          >
            {notice.tone === "ok" ? (
              <CircleCheck className="text-primary mt-0.5 size-4 shrink-0" />
            ) : notice.tone === "blocked" ? (
              <ShieldAlert className="text-destructive mt-0.5 size-4 shrink-0" />
            ) : null}
            <span>{notice.text}</span>
          </div>
        )}
      </div>

      <Separator />

      {/* Interleaved audit trail */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ScrollText className="text-muted-foreground size-4" />
          <h3 className="text-sm font-semibold tracking-tight">Audit trail</h3>
          <span className="text-muted-foreground text-xs">
            {actions.length} action{actions.length === 1 ? "" : "s"}, human and agent interleaved
          </span>
        </div>
        <ol className="flex flex-col gap-2">
          {actions.map((a) => (
            <li key={a.id} className="bg-card flex items-start gap-3 rounded-lg border p-3">
              <div
                className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${
                  a.actor_kind === "agent" ? "bg-primary/15 text-primary" : "bg-muted text-foreground"
                }`}
              >
                {a.actor_kind === "agent" ? (
                  <Bot className="size-4" />
                ) : (
                  <User className="size-4" />
                )}
              </div>
              <div className="flex flex-1 flex-col gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{actorName(a, operatorsById)}</span>
                  <Badge
                    variant="outline"
                    className={`text-[11px] ${a.actor_kind === "agent" ? "border-primary/40 text-primary" : ""}`}
                  >
                    {a.actor_kind}
                  </Badge>
                  <Badge
                    variant="outline"
                    className={`border-transparent text-[11px] ${actionTone[a.action] ?? ""}`}
                  >
                    {label(a.action)}
                  </Badge>
                  <span className="text-muted-foreground ml-auto text-xs">{when(a.created_at)}</span>
                </div>
                {a.detail && <p className="text-muted-foreground text-sm">{a.detail}</p>}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
