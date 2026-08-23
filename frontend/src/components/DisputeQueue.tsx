import { useState } from "react";
import { Plus } from "lucide-react";

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
import { StatusBadge } from "@/components/badges";
import { cn } from "@/lib/utils";
import { formatCents, labelize } from "@/lib/format";
import type { CasesListResponse, CasesOpenBody, SeedResponse } from "@/lib/api";

type DisputeRow = CasesListResponse["disputes"][number];
type Transaction = SeedResponse["transactions"][number];

const REASON_CODES = ["fraud", "duplicate", "not_received", "incorrect_amount"];
const STATUSES = ["open", "triaged", "resolved", "rejected", "escalated"];

export function DisputeQueue({
  disputes,
  transactions,
  selectedId,
  onSelect,
  statusFilter,
  onStatusFilter,
  onOpen,
  opening,
}: {
  disputes: DisputeRow[];
  transactions: Transaction[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
  onOpen: (body: CasesOpenBody) => void;
  opening: boolean;
}) {
  const [txnId, setTxnId] = useState<string>("");
  const [reason, setReason] = useState<string>("fraud");

  const selectedTxn = transactions.find((t) => String(t.id) === txnId);

  function submitOpen() {
    if (!selectedTxn) return;
    onOpen({
      transaction_id: Number(selectedTxn.id),
      reason_code: reason as CasesOpenBody["reason_code"],
      amount_cents: Number(selectedTxn.amount_cents),
    });
  }

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Dispute queue</CardTitle>
          <Select
            value={statusFilter || "all"}
            onValueChange={(v) => onStatusFilter(v === "all" ? "" : v)}
          >
            <SelectTrigger className="w-36" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {labelize(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          {disputes.length === 0 && (
            <p className="text-muted-foreground py-6 text-center text-sm">
              No disputes match this filter.
            </p>
          )}
          {disputes.map((d) => {
            const id = Number(d.id);
            const selected = id === selectedId;
            return (
              <button
                key={id}
                onClick={() => onSelect(id)}
                className={cn(
                  "flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/10"
                    : "border-border hover:bg-accent",
                )}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-medium">
                    #{id} · {labelize(String(d.reason_code))}
                  </span>
                  <span className="text-muted-foreground text-xs">
                    {formatCents(Number(d.amount_cents))}
                  </span>
                </div>
                <StatusBadge status={String(d.status)} />
              </button>
            );
          })}
        </div>

        <div className="border-border flex flex-col gap-2 border-t pt-4">
          <p className="text-sm font-medium">Open a dispute</p>
          <Select value={txnId} onValueChange={setTxnId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a transaction" />
            </SelectTrigger>
            <SelectContent>
              {transactions.map((t) => (
                <SelectItem key={String(t.id)} value={String(t.id)}>
                  {String(t.merchant)} · {formatCents(Number(t.amount_cents))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REASON_CODES.map((r) => (
                <SelectItem key={r} value={r}>
                  {labelize(r)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            onClick={submitOpen}
            disabled={!selectedTxn || opening}
            className="gap-1.5"
          >
            <Plus className="size-4" />
            {opening ? "Opening..." : "Open dispute"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
