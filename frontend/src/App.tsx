import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldCheck, User, Bot, Loader2, AlertCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { api } from "@/lib/api";
import type {
  SeededEnv,
  IdentityKey,
  Identity,
  Dispute,
  CaseDetail,
  Resolution,
  ReasonCode,
} from "@/lib/api";
import { money, label } from "@/lib/format";
import { DisputeQueue } from "@/components/DisputeQueue";
import { DisputeDetail, type Notice } from "@/components/DisputeDetail";

const IDENTITY_KEYS: IdentityKey[] = ["triage", "supervisor", "agent"];

function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

export default function App() {
  const [seed, setSeed] = useState<SeededEnv | null>(null);
  const [currentKey, setCurrentKey] = useState<IdentityKey>("agent");
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const current: Identity | null = seed ? seed.identities[currentKey] : null;
  const token = current?.token ?? "";

  const operatorsById = useMemo(() => {
    const map: Record<number, Identity> = {};
    if (seed) for (const k of IDENTITY_KEYS) map[seed.identities[k].id] = seed.identities[k];
    return map;
  }, [seed]);

  // Bootstrap: seed the environment, read deep-link params, pick the first case.
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const s = await api.seed();
        if (!live) return;
        setSeed(s);
        const asParam = readParam("as");
        if (asParam && IDENTITY_KEYS.includes(asParam as IdentityKey)) {
          setCurrentKey(asParam as IdentityKey);
        }
        const wanted = Number(readParam("dispute"));
        const first = s.disputes[0]?.id ?? null;
        setSelectedId(Number.isFinite(wanted) && wanted > 0 ? wanted : first);
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (live) setReady(true);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  const loadList = useCallback(async () => {
    if (!token) return;
    try {
      const rows = await api.listCases(token, statusFilter === "all" ? undefined : statusFilter);
      setDisputes(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [token, statusFilter]);

  const loadDetail = useCallback(async () => {
    if (!token || selectedId == null) {
      setDetail(null);
      return;
    }
    try {
      const d = await api.getCase(token, selectedId);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [token, selectedId]);

  useEffect(() => {
    void loadList();
  }, [loadList]);
  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // Switching identity clears the last outcome banner — it belonged to the prior caller.
  function switchTo(key: IdentityKey) {
    setCurrentKey(key);
    setNotice(null);
  }

  async function onTriage() {
    if (!token || selectedId == null) return;
    setBusy(true);
    setNotice({ tone: "info", text: "Running agent triage…" });
    try {
      const r = await api.triage(token, selectedId);
      setNotice(
        r.allowed
          ? { tone: "info", text: `Agent proposes ${label(r.proposed_resolution)}, within the policy ceiling.` }
          : {
              tone: "blocked",
              text: String(r.blocked_reason) || "Agent proposal is over the policy ceiling.",
            },
      );
      await Promise.all([loadDetail(), loadList()]);
    } catch (e) {
      setNotice({ tone: "blocked", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function onResolve(resolution: Resolution) {
    if (!token || selectedId == null) return;
    setBusy(true);
    try {
      const r = await api.resolve(token, { dispute_id: selectedId, resolution });
      setNotice(
        r.applied
          ? { tone: "ok", text: `Applied ${label(resolution)}. The dispute is resolved.` }
          : { tone: "blocked", text: String(r.reason) || "Blocked by the rule guard." },
      );
      await Promise.all([loadDetail(), loadList()]);
    } catch (e) {
      setNotice({ tone: "blocked", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  async function onOpen(transactionId: number, reason: ReasonCode) {
    if (!token) return;
    setBusy(true);
    try {
      const r = await api.open(token, { transaction_id: transactionId, reason_code: reason });
      setNotice({ tone: "info", text: `Opened dispute #${r.dispute.id}.` });
      await loadList();
      setSelectedId(r.dispute.id);
    } catch (e) {
      setNotice({ tone: "blocked", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-background text-foreground min-h-screen">
      <header className="border-b">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="text-primary size-5" />
                <h1 className="text-xl font-semibold tracking-tight">Dispute Ops Agent API</h1>
              </div>
              <p className="text-muted-foreground max-w-2xl text-sm">
                A human ops agent and an AI agent call the same permissioned, audited endpoints, so one
                rule layer decides every chargeback the same way for people and agents.
              </p>
              <div className="mt-1 flex flex-wrap gap-2">
                <Badge variant="secondary">Play 4 · Agent Intelligence Layer</Badge>
                <Badge variant="secondary">Banking · disputes</Badge>
                <Badge variant="outline">API-layer RBAC</Badge>
              </div>
            </div>

            {/* Identity switcher */}
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs font-medium">Acting as</span>
              <div className="bg-muted flex gap-1 rounded-lg p-1">
                {IDENTITY_KEYS.map((k) => {
                  const id = seed?.identities[k];
                  const active = k === currentKey;
                  return (
                    <button
                      key={k}
                      onClick={() => switchTo(k)}
                      disabled={!id}
                      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        active ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {k === "agent" ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
                      {id ? id.name : label(k)}
                    </button>
                  );
                })}
              </div>
              {current && (
                <span className="text-muted-foreground text-right text-xs">
                  {label(current.role)} · {current.kind} · ceiling {money(current.resolve_limit_cents)}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-6">
        {error && (
          <div className="border-destructive/40 bg-destructive/10 mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm">
            <AlertCircle className="text-destructive size-4" />
            {error}
          </div>
        )}

        {!ready ? (
          <div className="text-muted-foreground flex items-center gap-2 py-20 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Seeding the environment…
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <DisputeQueue
                disputes={disputes}
                transactions={seed?.transactions ?? []}
                statusFilter={statusFilter}
                onStatusChange={setStatusFilter}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setNotice(null);
                }}
                onOpen={onOpen}
                busy={busy}
              />
            </aside>

            <section>
              {detail && current ? (
                <DisputeDetail
                  detail={detail}
                  operatorsById={operatorsById}
                  current={current}
                  onTriage={onTriage}
                  onResolve={onResolve}
                  notice={notice}
                  busy={busy}
                />
              ) : (
                <div className="text-muted-foreground flex items-center justify-center rounded-lg border border-dashed py-24 text-sm">
                  Select a dispute to see its case, rule, and audit trail.
                </div>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
