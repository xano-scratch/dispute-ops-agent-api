import { apiGroup } from "@xanots/sdk";

/**
 * The one API group. The canonical slug is PINNED so public paths are stable
 * (`/api:dispute/...`) and `getPath()` resolves in the browser bundle without a
 * lock file.
 */
export const disputeApi = apiGroup({ name: "dispute", canonical: "dispute" });
