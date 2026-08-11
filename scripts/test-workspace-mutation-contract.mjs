import { readFile } from "node:fs/promises";

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const [actions, circulation, controls, migration] = await Promise.all([
  readFile(new URL("../src/app/operator/[libraryCode]/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/components/operator/circulation-workbench.tsx", import.meta.url), "utf8"),
  readFile(new URL("../src/components/operator/mutation-controls.tsx", import.meta.url), "utf8"),
  readFile(new URL("../supabase/migrations/20260811110000_global_commercial_localization_and_idempotency.sql", import.meta.url), "utf8"),
]);

assert(actions.includes("p_request_id: requestId"), "workspace RPC does not receive the stable browser identifier");
assert(controls.includes("crypto.randomUUID") && controls.includes('name="requestId"'), "mutation forms do not send a stable request identifier");
assert(controls.includes("useSyncExternalStore") && controls.includes("() => true") && controls.includes("() => false"), "mutation controls never enable after hydration");
assert(circulation.includes("MutationSubmitButton") && circulation.includes("Issuing copy…") && circulation.includes("Renewing loan…") && circulation.includes("Returning copy…"), "circulation submissions lack visible pending feedback");
assert(circulation.includes("MutationRequestId") && controls.includes("useFormStatus"), "circulation duplicate submission protection is absent");
assert(migration.includes("workspace_mutation_receipts") && migration.includes("pg_advisory_xact_lock"), "database mutation replay protection is absent");
console.log("Workspace mutation contract passed: pending controls and durable replay protection are wired.");
