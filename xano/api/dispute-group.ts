import { apiGroup } from "@xanots/core";

/**
 * The one API group both a human ops agent and the AI agent call. The
 * `canonical` slug is pinned so public paths stay stable and `getPath()`
 * resolves in the browser bundle.
 */
export const disputeApi = apiGroup({ name: "dispute", canonical: "dispute" });
