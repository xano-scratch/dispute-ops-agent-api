import { useState } from "react";
import { FilePlus2, Plus } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

import type { Dispute, Transaction, ReasonCode } from "@/lib/api";
import { REASON_CODES, STATUSES } from "@/lib/api";
import { money, label } from "@/lib/format";

export function statusClass(status: string): string {
  switch (status) {
    case "resolved":
      return "border-transparent bg-primary/15 text-primary";
    case "triaged":
      return "border-transparent bg-chart-4/20 text-foreground";
    case "rejected":
    case "escalated":
      return "border-transparent bg-destructive/15 text-destructive";
    default:
      return "border-transparent bg-muted text-muted-foreground";
  }
}

type Props = {
  disputes: Dispute[];
  transactions: Transaction[];
  statusFilter: string;
  onStatusChange: (status: string) => void;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onOpen: (transactionId: number, reason: ReasonCode) => void;
  busy: boolean;
};

export function DisputeQueue({
  disputes,
  transactions,
  statusFilter,
  onStatusChange,
  selectedId,
  onSelect,
  onOpen,
  busy,
}: Props) {
  const [txnId, setTxnId] = useState<string>("");
  const [reason, setReason] = useState<ReasonCode>("fraud");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Dispute queue</h2>
        <Select value={statusFilter} onValueChange={onStatusChange}>
          <SelectTrigger className="h-8 w-[150px] text-xs" aria-label="Filter by status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {label(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-2">
        {disputes.length === 0 && (
          <p className="text-muted-foreground rounded-md border border-dashed p-4 text-sm">
            No disputes match this filter.
          </p>
        )}
        {disputes.map((d) => {
          const active = d.id === selectedId;
          return (
            <button
              key={d.id}
              onClick={() => onSelect(d.id)}
              className={`hover:border-primary/60 flex flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors ${
                active ? "border-primary bg-accent" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">Dispute #{d.id}</span>
                <Badge variant="outline" className={`text-[11px] ${statusClass(d.status)}`}>
                  {label(d.status)}
                </Badge>
              </div>
              <div className="text-muted-foreground flex items-center justify-between gap-2 text-xs">
                <span>{label(d.reason_code)}</span>
                <span className="text-foreground font-medium">{money(d.amount_cents)}</span>
              </div>
            </button>
          );
        })}
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <FilePlus2 className="text-muted-foreground size-4" />
          <h3 className="text-sm font-semibold tracking-tight">Open a dispute</h3>
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs" htmlFor="txn">
            Transaction
          </Label>
          <Select value={txnId} onValueChange={setTxnId}>
            <SelectTrigger id="txn" className="text-xs">
              <SelectValue placeholder="Pick a transaction" />
            </SelectTrigger>
            <SelectContent>
              {transactions.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {t.merchant} · {money(t.amount_cents)} · ****{t.card_last4}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <Label className="text-xs" htmlFor="reason">
            Reason code
          </Label>
          <Select value={reason} onValueChange={(v) => setReason(v as ReasonCode)}>
            <SelectTrigger id="reason" className="text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASON_CODES.map((r) => (
                <SelectItem key={r} value={r}>
                  {label(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          disabled={!txnId || busy}
          onClick={() => txnId && onOpen(Number(txnId), reason)}
        >
          <Plus className="size-4" />
          Open dispute
        </Button>
      </div>
    </div>
  );
}
