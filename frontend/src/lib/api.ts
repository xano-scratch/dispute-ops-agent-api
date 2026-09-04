// The one contract: paths and request/response TYPES come from the xanots query
// defs, never hand-typed. Change a def and everything here follows.
//
//   • `import type` for shapes — InferInput/InferResponse erase to nothing.
//   • Import the lean def VALUE for getPath()/verb — but NOT the triage def: its
//     stack builds the agent graph (s.ai.agent.run), so its path/verb live in the
//     ROUTES table below and only its TYPE is imported (type-only, erased).
import type { InferInput, InferResponse } from "@xanots/sdk";

import { seedQuery } from "../../../xano/api/seed.js";
import { loginQuery } from "../../../xano/api/login.js";
import { openQuery } from "../../../xano/api/open.js";
import { resolveQuery } from "../../../xano/api/resolve.js";
import { casesListQuery } from "../../../xano/api/cases_list.js";
import { casesGetQuery } from "../../../xano/api/cases_get.js";
import type { triageQuery } from "../../../xano/api/triage.js";

/** The deployed backend URL — injected as window.XANO_HOST by `deploy --static`. */
export const XANO_HOST: string =
  (typeof window !== "undefined" && (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

// Stack-heavy escape hatch: plain metadata, no def import, no agent graph in the
// bundle. Kept in sync with `npx xanots routes xano/index.ts`.
export const ROUTES = {
  triage: { path: "/api:dispute/triage", verb: "POST" },
} as const;

// ── Types derived from the defs ──────────────────────────────────────────────
export type SeedResponse = InferResponse<typeof seedQuery>;
export type IdentityKey = "triage" | "supervisor" | "agent";
// The seed response's identity fields come from a `db.get` (a row is `T | null`),
// so strip the nullability the values never actually carry once seeded — still
// derived from the def, so a field rename is still a compile error.
export type Identity = { [K in keyof SeedResponse["triage"]]-?: NonNullable<SeedResponse["triage"][K]> };
export type Dispute = InferResponse<typeof casesListQuery>[number];
export type CaseDetail = InferResponse<typeof casesGetQuery>;
export type CaseAction = CaseDetail["actions"][number];
export type AgentRun = CaseDetail["agent_runs"][number];
export type Rule = CaseDetail["rule"];
export type TriageResponse = InferResponse<typeof triageQuery>;
export type ResolveResponse = InferResponse<typeof resolveQuery>;
export type OpenBody = InferInput<typeof openQuery>;
export type ResolveBody = InferInput<typeof resolveQuery>;

export type Transaction = SeedResponse["transactions"][number];

/** The normalized bootstrap: the three identities keyed, plus the seeded data. */
export type SeededEnv = {
  identities: Record<IdentityKey, Identity>;
  transactions: Transaction[];
  disputes: Dispute[];
};

export type ReasonCode = OpenBody["reason_code"];
export type Resolution = ResolveBody["resolution"];

// UI picker options. The element TYPES above are derived from the defs, so a
// value here that drifts from the backend enum is a compile error where it's used.
export const REASON_CODES: ReasonCode[] = ["fraud", "duplicate", "not_received", "incorrect_amount"];
export const STATUSES = ["open", "triaged", "resolved", "rejected", "escalated"] as const;
export const RESOLUTIONS: Resolution[] = ["refund", "partial", "deny"];

// ── One fetch helper ─────────────────────────────────────────────────────────
async function call<T>(
  path: string,
  method: string,
  token?: string,
  body?: unknown,
): Promise<T> {
  const res = await fetch(XANO_HOST + path, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const text = await res.text();
      const parsed = JSON.parse(text) as { message?: string };
      message = parsed.message || text || message;
    } catch {
      /* keep statusText */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  seed: async (body: { reset?: boolean } = {}): Promise<SeededEnv> => {
    const s = await call<SeedResponse>(seedQuery.getPath(), seedQuery.verb, undefined, body);
    return {
      identities: {
        triage: s.triage as Identity,
        supervisor: s.supervisor as Identity,
        agent: s.agent as Identity,
      },
      transactions: s.transactions as Transaction[],
      disputes: s.disputes as Dispute[],
    };
  },
  listCases: (token: string, status?: string) =>
    call<Dispute[]>(
      casesListQuery.getPath() + (status ? `?status=${encodeURIComponent(status)}` : ""),
      casesListQuery.verb,
      token,
    ),
  getCase: (token: string, disputeId: number) =>
    call<CaseDetail>(
      casesGetQuery.getPath({ params: { dispute_id: String(disputeId) } }),
      casesGetQuery.verb,
      token,
    ),
  open: (token: string, body: OpenBody) =>
    call<{ dispute: Dispute }>(openQuery.getPath(), openQuery.verb, token, body),
  triage: (token: string, disputeId: number) =>
    call<TriageResponse>(ROUTES.triage.path, ROUTES.triage.verb, token, {
      dispute_id: disputeId,
    }),
  resolve: (token: string, body: ResolveBody) =>
    call<ResolveResponse>(resolveQuery.getPath(), resolveQuery.verb, token, body),
};
