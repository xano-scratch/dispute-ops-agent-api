import { useCallback, useEffect, useState } from "react";
import { Scale, RefreshCw, AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { IdentityBar, type IdentityKey } from "@/components/IdentityBar";
import { DisputeQueue } from "@/components/DisputeQueue";
import { DisputeDetail } from "@/components/DisputeDetail";
import * as api from "@/lib/api";
import type {
  CasesGetResponse,
  CasesListResponse,
  CasesOpenBody,
  CasesResolveResponse,
  Operator,
  SeedResponse,
} from "@/lib/api";

type Operators = Record<IdentityKey, Operator>;
type DisputeRow = CasesListResponse["disputes"][number];
type Transaction = SeedResponse["transactions"][number];

export default function App() {
  const [operators, setOperators] = useState<Operators | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [identity, setIdentity] = useState<IdentityKey>("triage");
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CasesGetResponse | null>(null);
  const [lastResolve, setLastResolve] = useState<CasesResolveResponse | null>(
    null,
  );
  const [booting, setBooting] = useState(true);
  const [triaging, setTriaging] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openDetail = useCallback(async (id: number) => {
    setSelectedId(id);
    setLastResolve(null);
    try {
      setDetail(await api.getCase(id));
    } catch (e) {
      setError(errMessage(e));
    }
  }, []);

  const refreshList = useCallback(
    async (status: string, autoSelect: boolean) => {
      const res = await api.listCases(status || undefined);
      const rows = res.disputes ?? [];
      setDisputes(rows);
      if (autoSelect && rows.length > 0) {
        const wanted = new URLSearchParams(window.location.search).get(
          "dispute",
        );
        const match = wanted && rows.some((r) => String(r.id) === wanted);
        await openDetail(match ? Number(wanted) : Number(rows[0].id));
      }
    },
    [openDetail],
  );

  const boot = useCallback(async (reset: boolean) => {
    setBooting(true);
    setError(null);
    try {
      const s = await api.seed(reset);
      const ops: Operators = {
        triage: s.triage,
        supervisor: s.supervisor,
        agent: s.agent,
      };
      setOperators(ops);
      setTransactions(s.transactions ?? []);
      const asParam = new URLSearchParams(window.location.search).get("as");
      const idKey: IdentityKey =
        asParam === "supervisor" || asParam === "agent" ? asParam : "triage";
      setIdentity(idKey);
      api.setAuthToken(ops[idKey].token);
      setStatusFilter("");
      setLastResolve(null);
      await refreshList("", true);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setBooting(false);
    }
  }, [refreshList]);

  useEffect(() => {
    void boot(false);
  }, [boot]);

  function changeIdentity(key: IdentityKey) {
    if (!operators) return;
    setIdentity(key);
    api.setAuthToken(operators[key].token);
    setLastResolve(null);
  }

  async function onStatusFilter(status: string) {
    setStatusFilter(status);
    try {
      await refreshList(status, false);
    } catch (e) {
      setError(errMessage(e));
    }
  }

  async function onTriage() {
    if (selectedId == null) return;
    setTriaging(true);
    setError(null);
    try {
      await api.triage({ dispute_id: selectedId });
      await api.getCase(selectedId).then(setDetail);
      await refreshList(statusFilter, false);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setTriaging(false);
    }
  }

  async function onResolve(resolution: string) {
    if (selectedId == null || !detail || !detail.dispute) return;
    setResolving(true);
    setError(null);
    try {
      const res = await api.resolveCase({
        dispute_id: selectedId,
        resolution: resolution as api.CasesResolveBody["resolution"],
        amount_cents: Number(detail.dispute.amount_cents),
      });
      setLastResolve(res);
      await api.getCase(selectedId).then(setDetail);
      await refreshList(statusFilter, false);
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setResolving(false);
    }
  }

  async function onOpen(body: CasesOpenBody) {
    setOpening(true);
    setError(null);
    try {
      const res = await api.openCase(body);
      await refreshList(statusFilter, false);
      await openDetail(Number(res.dispute.id));
    } catch (e) {
      setError(errMessage(e));
    } finally {
      setOpening(false);
    }
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 p-4 sm:p-8">
        <header className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/15 text-primary flex size-10 items-center justify-center rounded-lg">
                <Scale className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">
                  Dispute Ops Agent API
                </h1>
                <p className="text-muted-foreground text-sm">
                  One governed rule layer for a human ops agent and an AI agent.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void boot(true)}
              disabled={booting}
              className="gap-1.5"
            >
              <RefreshCw className="size-3.5" />
              Reset data
            </Button>
          </div>
          {operators && (
            <IdentityBar
              operators={operators}
              current={identity}
              onChange={changeIdentity}
            />
          )}
        </header>

        {error && (
          <div className="border-destructive/40 bg-destructive/10 text-destructive flex items-center gap-2 rounded-md border p-3 text-sm">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        {booting ? (
          <p className="text-muted-foreground py-16 text-center">
            Seeding the workspace and signing in...
          </p>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
            <DisputeQueue
              disputes={disputes}
              transactions={transactions}
              selectedId={selectedId}
              onSelect={openDetail}
              statusFilter={statusFilter}
              onStatusFilter={onStatusFilter}
              onOpen={onOpen}
              opening={opening}
            />
            {detail ? (
              <DisputeDetail
                key={selectedId}
                detail={detail}
                onTriage={onTriage}
                onResolve={onResolve}
                triaging={triaging}
                resolving={resolving}
                lastResolve={lastResolve}
              />
            ) : (
              <p className="text-muted-foreground py-16 text-center">
                Select a dispute to see its case, run the AI triage, and apply a
                resolution through the rule guard.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function errMessage(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
