// The one contract: paths and request/response TYPES come from the xanots query
// defs, never hand-typed. Lean defs are value-imported for getPath()/verb; the
// stack-heavy triage def (it builds an agent graph) is kept out of the bundle —
// its path/verb live in ROUTES (verified with `npx xanots paths xano/index.ts`)
// and its types come in type-only, which erases at build time.

import { seedQuery } from "../../../xano/api/seed.js";
import { loginQuery } from "../../../xano/api/login.js";
import { casesOpenQuery } from "../../../xano/api/cases-open.js";
import { casesResolveQuery } from "../../../xano/api/cases-resolve.js";
import { casesGetQuery } from "../../../xano/api/cases-get.js";
import { casesListQuery } from "../../../xano/api/cases-list.js";

import type { SeedResponse } from "../../../xano/api/seed.js";
import type { LoginBody, LoginResponse } from "../../../xano/api/login.js";
import type {
  CasesOpenBody,
  CasesOpenResponse,
} from "../../../xano/api/cases-open.js";
import type {
  CasesResolveBody,
  CasesResolveResponse,
} from "../../../xano/api/cases-resolve.js";
import type { CasesGetResponse } from "../../../xano/api/cases-get.js";
import type {
  CasesListResponse,
} from "../../../xano/api/cases-list.js";
import type { TriageBody, TriageResponse } from "../../../xano/api/triage.js";

export type {
  SeedResponse,
  LoginBody,
  LoginResponse,
  CasesOpenBody,
  CasesOpenResponse,
  CasesResolveBody,
  CasesResolveResponse,
  CasesGetResponse,
  CasesListResponse,
  TriageBody,
  TriageResponse,
};

/** An operator plus its browse token, as the seed/login endpoints return it. */
export type Operator = SeedResponse["triage"];

/** The stack-heavy triage endpoint (split-route-metadata rule). */
export const ROUTES = {
  triage: { path: "/api:dispute/triage", verb: "POST" },
} as const;

/**
 * The deployed backend's base URL. Injected as `window.XANO_HOST` by
 * `xanots deploy --static`, or read from `VITE_XANO_HOST` in dev.
 */
export const XANO_HOST: string =
  (typeof window !== "undefined" &&
    (window as { XANO_HOST?: string }).XANO_HOST) ||
  import.meta.env.VITE_XANO_HOST ||
  "";

let authToken: string | null = null;

/** Set the token every guarded call carries (the current identity). */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

async function call<T>(
  path: string,
  verb: string,
  opts: { body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  if (opts.auth !== false && authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  }
  const res = await fetch(XANO_HOST + path, {
    method: verb,
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let message = res.statusText;
    try {
      const text = await res.text();
      if (text) {
        try {
          const parsed = JSON.parse(text) as { message?: string };
          message = parsed.message || text;
        } catch {
          message = text;
        }
      }
    } catch {
      /* keep statusText */
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

/**
 * Bootstrap the workspace and get the three operators + fresh tokens. Idempotent
 * by default (populates only when empty); pass reset=true to wipe and re-seed.
 */
export function seed(reset = false): Promise<SeedResponse> {
  return call<SeedResponse>(seedQuery.getPath(), seedQuery.verb, {
    body: { reset },
    auth: false,
  });
}

/** Exchange email + password for a token (the demo mints tokens at seed too). */
export function login(body: LoginBody): Promise<LoginResponse> {
  return call<LoginResponse>(loginQuery.getPath(), loginQuery.verb, {
    body,
    auth: false,
  });
}

/** List disputes, optionally filtered by status. */
export function listCases(status?: string): Promise<CasesListResponse> {
  const path =
    casesListQuery.getPath() +
    (status ? `?status=${encodeURIComponent(status)}` : "");
  return call<CasesListResponse>(path, casesListQuery.verb);
}

/** Fetch one dispute with its transaction, rule, audit trail, and agent runs. */
export function getCase(disputeId: number): Promise<CasesGetResponse> {
  return call<CasesGetResponse>(
    casesGetQuery.getPath({ params: { dispute_id: disputeId } }),
    casesGetQuery.verb,
  );
}

/** Open a dispute against a transaction. */
export function openCase(body: CasesOpenBody): Promise<CasesOpenResponse> {
  return call<CasesOpenResponse>(casesOpenQuery.getPath(), casesOpenQuery.verb, {
    body,
  });
}

/** Run the AI agent to classify and propose a resolution (proposes only). */
export function triage(body: TriageBody): Promise<TriageResponse> {
  return call<TriageResponse>(ROUTES.triage.path, ROUTES.triage.verb, { body });
}

/** Apply a resolution through the rule guard (may be blocked and audited). */
export function resolveCase(
  body: CasesResolveBody,
): Promise<CasesResolveResponse> {
  return call<CasesResolveResponse>(
    casesResolveQuery.getPath(),
    casesResolveQuery.verb,
    { body },
  );
}
