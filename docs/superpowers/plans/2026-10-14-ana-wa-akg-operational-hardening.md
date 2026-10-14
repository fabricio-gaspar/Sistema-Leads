# Ana WA-AKG Operational Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Ana's automatic operational path safe, durable, and observable with WA-AKG as the only operational WhatsApp provider. A contact must be explicitly approved before any automation; all inbound messages remain visible to human service.

**Architecture:** WA-AKG worker persists an inbound event and evaluates contact policy transactionally. Only a policy-approved lead in IA mode enters the existing durable `ana_jobs` queue. `ana-run` revalidates authorization before every effect, and diagnostics expose safe aggregate health. Invalid prospecting schedules stop once before any external search or spend.

**Tech Stack:** React/Vite/TypeScript, Supabase Postgres/RLS/RPC, Supabase Edge Functions (Deno), WA-AKG, Vitest/PGlite.

**Design source:** `docs/superpowers/specs/2026-10-14-ana-wa-akg-operational-flow-design.md`

## Global Constraints

- Preserve historical migrations, messages, receipts, integrations, audit rows, and legacy provider records. New migrations supersede old contracts; they never rewrite migration history.
- Do not generate QR codes, reconnect/disconnect a device, replay historic webhooks, promote contacts in bulk, infer a prospecting city/UF/term, or send a real WhatsApp message.
- Every database change is tenant-scoped and server-only where it decides automation. Browser code must never decide eligibility or receive secrets, payloads, full phone numbers, prompts, or credentials.
- Apply the durable-queue migration before deploying an Edge Function that calls its RPCs. Database preflight, migration, function deployment, Site publication, and public-route verification are separate gates.
- Leave protected, unclassified, and directory-missing inbound messages in the Central for human service. A failed gate is a safe stop, not a reason to discard a message.
- FreeLLMAPI remains the effective primary route. A paid provider is usable only as an explicitly administrator-approved fallback for an eligible transient failure; a generic integration label cannot override that policy.

## Review Focus

- Replayed WA-AKG callbacks for one message must persist at most once and create at most one job; Task 1 adds the dispatch/no-job and Task 3 adds the queue-key/FIFO tests.
- Contact approval revoked between model decision and outbound effect must stop safely; Task 2 adds the effect-fence race test.
- A directory-missing sender must remain visible to a human but never be silently promoted; Task 1 adds the directory-missing inbound contract.
- Concurrent scheduler heartbeats with invalid filters must yield one terminal block and zero external search; Task 4 adds the conditional-update concurrency test.
- A nominally healthy model endpoint must not be labeled available unless the actual structured Ana request succeeds without leaking secrets; Task 5 adds the real-contract probe and Task 6 adds stale/redaction status tests.

## Verification command convention

Use the bundled runtime when `node` is not on `PATH`:

```bash
WAYFLEX_NODE=/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run <test-files>
"$WAYFLEX_NODE" node_modules/eslint/bin/eslint.js src --ext ts,tsx --report-unused-disable-directives --max-warnings 0
"$WAYFLEX_NODE" node_modules/typescript/bin/tsc --noEmit --project tsconfig.app.json
"$WAYFLEX_NODE" node_modules/typescript/bin/tsc --project tsconfig.edge.json
"$WAYFLEX_NODE" node_modules/vite/bin/vite.js build
"$WAYFLEX_NODE" scripts/build-sites-artifact.mjs
```

## Files and responsibilities

| Area | Files |
| --- | --- |
| Contact-policy persistence | `supabase/migrations/20261014120000_ana_wa_akg_inbound_protection.sql`, `supabase/tests/agendaContactProtection.test.ts`, `supabase/tests/messagingRecoveryR6.test.ts` |
| Automatic authority | `supabase/functions/_shared/runtimeSafety.ts`, `supabase/functions/_shared/anaEffectFence.ts`, `supabase/functions/_shared/inboundWork.ts`, `supabase/functions/ana-run/index.ts`, `supabase/functions/lead-workflow/index.ts`, tests below |
| Durable execution | existing `supabase/migrations/20261013213000_ana_durable_execution_queue.sql`, `supabase/functions/_shared/anaQueue.ts`, `supabase/functions/wa-akg-worker/index.ts`, `supabase/functions/automation-worker/index.ts`, `supabase/tests/anaQueue.test.ts` |
| Schedule gate | `supabase/functions/_shared/prospectingFilters.ts` (new), `supabase/functions/ana-operations/settings.ts`, `supabase/functions/ana-operations/index.ts`, `supabase/functions/automation-worker/index.ts`, `supabase/functions/prospectar-leads/index.ts` |
| AI policy and probe | `supabase/functions/_shared/freellm.ts`, `supabase/functions/_shared/aiRoutingPolicy.ts` (new), `supabase/functions/ana-run/index.ts`, `supabase/functions/testar-integracao/index.ts`, `supabase/functions/configurar-integracao/index.ts` |
| Safe diagnostics | `supabase/functions/_shared/anaOperationalSnapshot.ts` (new), `supabase/functions/operational-diagnostics/index.ts`, `src/lib/crm/operationalDiagnosticsRepository.ts`, `src/lib/crm/operationalStatusPresentation.ts`, `src/pages/dashboard/configuracoes/components/OperationalStatusTab.tsx` |

---

### Task 1: Characterize and close the inbound contact-approval gap

**Files:**
- Create: `supabase/migrations/20261014120000_ana_wa_akg_inbound_protection.sql`
- Modify: `supabase/tests/agendaContactProtection.test.ts`
- Modify: `supabase/tests/messagingRecoveryR6.test.ts`
- Modify: `supabase/tests/waAkgInbound.test.ts`

**Interfaces:**
- Consumes: `private.resolve_wa_akg_contact_policy(uuid, uuid, text)`, `public.persist_whatsapp_inbound(text, uuid, uuid)`, and `public.begin_whatsapp_inbound_dispatch(text, uuid, uuid)`.
- Produces: the same two public RPC signatures, now returning `{ dispatch: boolean, lead_id?: uuid, mode?: 'ia' }` only after an explicit approval gate; `_shared/inboundWork.processInboundWork(admin, 'wa_akg', event)` enqueues only `dispatch:true` + `mode:'ia'`.

- [ ] **Step 1: Write failing contract tests.**
  - Assert a forward migration replaces `persist_whatsapp_inbound` and `begin_whatsapp_inbound_dispatch`; it must not approve a lead merely because it received an inbound message.
  - Add an inbound-worker orchestration fixture for each of `agenda_protected`, `unclassified`, directory-missing, and a non-approved existing lead. Each must persist once, finish the work item, make no `enqueue_ana_job` RPC, and make no model/fetch call.
  - Keep an approved `lead_authorized` lead in IA mode as the positive control.
  - Run: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/agendaContactProtection.test.ts supabase/tests/messagingRecoveryR6.test.ts supabase/tests/waAkgInbound.test.ts`.
  - Expected: FAIL because the old SQL marks inbound leads approved or allows dispatch without explicit approval.

- [ ] **Step 2: Add the forward migration without editing historic SQL.**
  - Recreate `public.persist_whatsapp_inbound(text, uuid, uuid)` with the existing lease, sender-identity, account-route, idempotent message, attachment, and outbox-cancellation behavior.
  - Resolve `private.resolve_wa_akg_contact_policy` after normalizing the already-verified WA-AKG sender. Preserve `contact_approval_status`, `contact_approved_at`, and approval reason on inbound; do not write `approved` as a side effect of reception.
  - For policy states other than `lead_authorized`, force the existing lead into human/paused state using the policy's existing protections, retain the inbound row/message, and record a stable safe reason. Do not create a lead if identity remains unresolved.
  - Recreate `public.begin_whatsapp_inbound_dispatch(text, uuid, uuid)` to require **all** of: policy `lead_authorized`, `contact_approval_status = 'approved'`, non-null approval timestamp, `modo_atendimento = 'ia'`, not paused, not opt-out, WA-AKG account/integration/controls healthy. It must return `dispatch:false` for every other state.
  - Preserve revokes/grants to `service_role` only and retain the advisory-lock/lease semantics. Use `CREATE OR REPLACE`; never edit `20261005223517_audit_r6_r7_messaging_recovery.sql`.

- [ ] **Step 3: Make the Edge orchestrator obey the new DB result.**
  - In `_shared/inboundWork.ts`, enqueue only an explicit `dispatch:true` response whose mode is `ia`; do not create human-mode Ana jobs.
  - Treat policy denials as successfully persisted/processed inbound work, not as worker errors or retries. Continue to return no sensitive policy details to the webhook caller.

- [ ] **Step 4: Re-run focused tests.**
  - Run: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/anaQueue.test.ts supabase/tests/agendaContactProtection.test.ts supabase/tests/messagingRecoveryR6.test.ts supabase/tests/waAkgInbound.test.ts`.
  - Expected: PASS; the positive control creates one job and every protected control creates none.

- [ ] **Step 5: Commit the focused change.**
  - Commit only the migration, handler, and focused tests as `fix(ana): gate inbound automation by contact approval`.

### Task 2: Make all Ana authorization and effects fail closed

**Files:**
- Modify: `supabase/functions/_shared/runtimeSafety.ts`
- Modify: `supabase/functions/_shared/anaEffectFence.ts`
- Modify: `supabase/functions/ana-run/index.ts`
- Modify: `supabase/functions/lead-workflow/index.ts`
- Modify: `supabase/tests/runtimeSafety.test.ts`
- Modify: `supabase/tests/anaAuthorityR8.test.ts`
- Modify: `supabase/tests/runtimeHandlers.test.ts`

**Interfaces:**
- Consumes: Task 1's dispatch contract and `AnaJobInput` from `_shared/anaQueue.ts`.
- Produces: `automationBlockReason(...)` default-deny behavior, `assertAnaEffectAllowed(admin, organizationId, expected)` that compares approval state, and `lead-workflow:start_ai` that accepts only an already-approved lead and creates an `AnaJobInput` instead of a direct fetch to `ana-run`.

- [ ] **Step 1: Write failing authorization and race tests.**
  - A pending/unclassified contact must be blocked even if a caller omits the optional `requiresApprovedContact` argument.
  - A direct `ana-run` request for `message.received` against a pending contact must produce no model call, no lead transition, no outbox, no task, and no handoff.
  - Simulate approval changing after model analysis but before the effect fence. The result must create no outbound or business effect.
  - A manual `start_ai` on a non-approved contact must return a clear authorization-required error and must not silently update approval state.
  - Run: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/runtimeSafety.test.ts supabase/tests/anaAuthorityR8.test.ts supabase/tests/runtimeHandlers.test.ts`.
  - Expected: FAIL on the current missing-default / direct-inbound bypass assertions.

- [ ] **Step 2: Implement default-deny authority.**
  - Make `automationBlockReason` treat a missing `requiresApprovedContact` option as requiring approval whenever a lead is present; keep explicit non-Ana internal uses only if they supply a documented opt-out and cannot send/automate.
  - In `ana-run`, use the same approved-contact requirement for every automatic event, including `message.received`, initial reads, and final effect validation.
  - Extend `anaEffectFence`'s comparison data with `contact_approval_status` and the approved-at value needed by the policy. Add an approval condition to the lead mutation/effect transition so a change between read and write fails closed.
  - Preserve the existing handoff policy: a handoff pauses Ana; it never promotes a protected contact or reactivates IA by implication.

- [ ] **Step 3: Make manual workflow explicit and durable.**
  - Remove the implicit `approve_whatsapp_contact` shortcut from `lead-workflow:start_ai`.
  - Require the existing explicit contact-decision action to promote a contact. `start_ai` accepts only an already-approved lead, switches to IA through the existing permission path, and enqueues a durable job rather than invoking `ana-run` directly.
  - Keep the decision audit reason, organization boundary, actor authorization, and human-first promotion behavior intact.

- [ ] **Step 4: Re-run targeted authorization tests.**
  - Run: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/runtimeSafety.test.ts supabase/tests/anaAuthorityR8.test.ts supabase/tests/runtimeHandlers.test.ts src/lib/crm/contactDecisionPrompt.test.ts src/pages/dashboard/atendimento/page.waAkg.test.ts`.
  - Expected: PASS; every rejected path has zero outbound effects.

- [ ] **Step 5: Commit the authority hardening.**
  - Commit as `fix(ana): fail closed on contact authorization`.

### Task 3: Validate and activate the existing durable queue safely

**Files:**
- Modify: `supabase/tests/anaQueue.test.ts`
- Modify: `supabase/tests/waAkgWorkerConnectionSync.test.ts`
- Modify: `supabase/functions/_shared/anaQueue.ts` only if a test exposes an actual contract defect
- Modify: `supabase/functions/automation-worker/index.ts` only if a test exposes a drain/recovery defect

**Interfaces:**
- Consumes: `AnaJobInput`, `enqueueAnaJob(admin, input)`, and the existing five server-only queue RPCs in `20261013213000_ana_durable_execution_queue.sql`.
- Produces: no new public API; preserves `processNextAnaJob(admin, requestedJobId?)` semantics and documented job states.

- [ ] **Step 1: Add characterization tests around the already-versioned queue.**
  - Cover duplicate inbound event keys, FIFO blocking for one lead, separate-lead concurrency, lost lease, transient retry limit, terminal `needs_review`/dead-letter, and unknown provider outcome with no blind resend.
  - Assert only server-side RPCs can claim/finish/fail jobs and `ana_effects` prevents duplicate handoff/proposal/outbox effects.
  - Run: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/anaQueue.test.ts supabase/tests/waAkgWorkerConnectionSync.test.ts`.
  - Expected: existing tests pass; added contracts initially fail only if a queue behavior is defective.

- [ ] **Step 2: Correct only verified queue defects.**
  - Preserve the established interface in `20261013213000_ana_durable_execution_queue.sql`: `enqueue_ana_job`, `claim_ana_job`, `validate_ana_job_lease`, `finish_ana_job`, and `fail_ana_job`.
  - Keep `webhook-wa-akg` as ingestion/wakeup only; `wa-akg-worker` persists and queues; `automation-worker` drains recoverable jobs. Do not add browser-driven queue execution.

- [ ] **Step 3: Validate the migration before release.**
  - In a read-only target preflight, inspect the migration ledger, existence/signatures of queue tables/RPCs, grants, indexes, and active function inventory. If absent, schedule exactly this already-versioned migration before any dependent function deployment.

- [ ] **Step 4: Commit only if source/tests changed.**
  - Use `test(ana): characterize durable queue recovery` or `fix(ana): harden durable queue recovery`, as appropriate.

### Task 4: Stop invalid prospecting schedules before work or spend

**Files:**
- Create: `supabase/functions/_shared/prospectingFilters.ts`
- Modify: `supabase/functions/ana-operations/settings.ts`
- Modify: `supabase/functions/ana-operations/index.ts`
- Modify: `supabase/functions/automation-worker/index.ts`
- Modify: `supabase/functions/prospectar-leads/index.ts`
- Modify: `supabase/tests/anaOperationHandlerR11.test.ts`
- Modify: `supabase/tests/anaOperationLocation.test.ts`
- Create: `supabase/tests/automationWorkerProspectingGuard.test.ts`
- Modify: `src/lib/crm/anaOperationRepository.ts`
- Modify: `src/lib/crm/anaOperationValidation.ts`
- Modify: `src/lib/crm/anaOperationValidation.test.ts`
- Modify: `src/pages/dashboard/personalizacao-ana/AnaAutomaticOperation.tsx`
- Modify: `src/pages/dashboard/components/AnaAutomaticControl.tsx`

**Interfaces:**
- Consumes: a single `prospectingFiltersIssue(value): string | null` rule extracted to `_shared/prospectingFilters.ts`.
- Produces: a safe worker result `blocked_invalid_filters`, one `ana.operation.blocked_invalid_filters` audit event, schedule state `active=false` and `next_run_at=null`, and readiness `blocking.prospectingLocation`.

- [ ] **Step 1: Write failing schedule tests.**
  - Invalid filters (no city, more than one UF, or no valid activity/segment) must create zero run, make zero Apify/fetch request, create no lead, pause the schedule once, and write one sanitized audit event.
  - A valid schedule remains eligible and a concurrent second heartbeat must not duplicate the audit/transition.
  - The UI must expose the concrete blocking code with a correction action, not report general Ana/WhatsApp unavailability.
  - Run: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/anaOperationHandlerR11.test.ts supabase/tests/anaOperationLocation.test.ts supabase/tests/automationWorkerProspectingGuard.test.ts src/lib/crm/anaOperationValidation.test.ts`.
  - Expected: FAIL before the worker preflight exists.

- [ ] **Step 2: Centralize validation and preflight it in the worker.**
  - Extract the existing `prospectingFiltersIssue` contract into `_shared/prospectingFilters.ts`; let `ana-operations`, `automation-worker`, and `prospectar-leads` import the same rule.
  - Before upserting/advancing a run, conditionally pause the affected schedule (`active=false`, `next_run_at=null`, locks cleared) and emit a single `ana.operation.blocked_invalid_filters` audit code. Re-read if the conditional update loses a concurrency race.
  - Keep the SQL trigger in `20261005225107_audit_r11_prospecting_location_guard.sql` as the final authority. Do not infer a city, UF, or term from company address data.

- [ ] **Step 3: Report readiness accurately.**
  - Add `blocking.prospectingLocation` to readiness/diagnostic data. It may make automatic prospecting unavailable while inbound human/WA-AKG health remains independently reported.

- [ ] **Step 4: Run focused tests and commit.**
  - Run worker, PGlite location, repository, and UI validation tests; commit as `fix(prospecting): stop invalid schedules before execution`.

### Task 5: Make the effective AI route testable and auditable without secrets

**Files:**
- Create: `supabase/functions/_shared/aiRoutingPolicy.ts`
- Modify: `supabase/functions/_shared/freellm.ts`
- Modify: `supabase/functions/ana-run/index.ts`
- Modify: `supabase/functions/testar-integracao/index.ts`
- Modify: `supabase/functions/configurar-integracao/index.ts`
- Modify: `supabase/tests/freellmProvider.test.ts`
- Create: `supabase/tests/aiRoutingPolicy.test.ts`
- Create: `supabase/tests/freellmIntegrationHandler.test.ts`
- Modify: `src/hooks/useIntegracoesStore.ts`
- Modify: `src/pages/dashboard/configuracoes/components/IntegrationConfigureModal.tsx`
- Modify: `src/pages/dashboard/configuracoes/components/ApisProvidersTab.tsx`
- Modify: `src/pages/dashboard/configuracoes/components/IntegracoesTab.tsx`

**Interfaces:**
- Consumes: `callFreeLlm(...)` transport and the existing provider-fallback configuration fields.
- Produces: `resolveAiRoutingPolicy(...)` with a FreeLLM primary decision, `probeFreeLlm(...)` returning only `{ effectiveProvider, health, testedAt, errorCode? }`, and safe `agent_runs.result` projection.

- [ ] **Step 1: Write failing routing/probe tests.**
  - A stale `provedor_principal='claude'` label cannot supersede FreeLLM for Ana.
  - Paid fallback is never used when disabled, unapproved, unauthorized, or when the FreeLLM failure is non-transient (for example authentication/schema/model errors).
  - An explicit authorized transient-failure fallback records a sanitized provider/result marker only.
  - The integration test probes the same structured JSON request shape used by Ana, validates its schema, and creates no message/outbox/agent-run side effect.
  - Run: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/freellmProvider.test.ts supabase/tests/aiRoutingPolicy.test.ts supabase/tests/freellmIntegrationHandler.test.ts`.
  - Expected: FAIL before the shared policy/probe is added.

- [ ] **Step 2: Implement one routing policy and a no-side-effect probe.**
  - Centralize `resolveAiRoutingPolicy`: FreeLLM first; OpenAI/Claude only explicit paid contingency. It returns safe policy/error codes and never returns keys, URLs, prompts, or provider body.
  - Add a deterministic structured `probeFreeLlm` using Ana's effective endpoint/model/response format. The probe is invoked only by an administrator-requested integration test, never by passive status polling.
  - Persist only safe execution projection in `agent_runs.result`: effective provider, model identifier only if non-sensitive, fallback-used boolean, timestamp, and normalized error code.
  - Adjust integration configuration UI to call FreeLLM the principal route and label other providers as optional approved fallback. Do not expose secret fields or imply health based on `/v1/models` alone.

- [ ] **Step 3: Re-run focused provider tests and commit.**
  - Run FreeLLM/provider/handler tests and `anaAuthorityR8`; commit as `feat(ana): expose safe effective AI routing`.

### Task 6: Add factual, organization-safe operational diagnostics

**Files:**
- Create: `supabase/functions/_shared/anaOperationalSnapshot.ts`
- Modify: `supabase/functions/operational-diagnostics/index.ts`
- Modify: `src/lib/crm/operationalDiagnosticsRepository.ts`
- Modify: `src/lib/crm/operationalStatusPresentation.ts`
- Modify: `src/lib/crm/operationalStatusPresentation.test.ts`
- Modify: `src/pages/dashboard/configuracoes/components/OperationalStatusTab.tsx`
- Create: `supabase/tests/operationalDiagnosticsAnaRuntime.test.ts`
- Modify: `src/lib/contextIsolationR5.test.ts` only if an interface change needs a regression assertion

**Interfaces:**
- Consumes: queue/job state, safe `agent_runs.result` projection, schedule/audit data, and current admin authorization.
- Produces: an internal `buildAnaOperationalSnapshot(...)` aggregate used only by `operational-diagnostics`, with queue/routing/prospecting/knowledge summaries scoped to one organization.

- [ ] **Step 1: Write failing snapshot and presentation tests.**
  - Organization A cannot receive any queue/run/status record of B.
  - Snapshot data contains queue counts/oldest age by state, safe last routing outcome, schedule/blocking state, and optional knowledge backlog only when present.
  - It contains no phone, message text, attachment URL, prompt, response, key, private endpoint, or raw provider payload.
  - A stale probe reports `stale`, not `online`; invalid prospecting reports a configuration block separately from channel availability.
  - Run: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/operationalDiagnosticsAnaRuntime.test.ts src/lib/crm/operationalStatusPresentation.test.ts src/lib/contextIsolationR5.test.ts`.
  - Expected: FAIL before the Ana snapshot fields/presentation exist.

- [ ] **Step 2: Implement the server-side aggregate.**
  - Query `ana_jobs`, `agent_runs`, schedule/audit state, and existing knowledge health only under `organization_id` with current admin authorization.
  - Return aggregate queue counts (`queued`, `running`, `retry`, `needs_review`, `dead_letter`), oldest age, last Ana result/error code, effective route, schedule next-run/block reason, and WA-AKG status with minimized data.
  - Keep this as a private handler composition, not a browser-privileged RPC or a new metrics table.

- [ ] **Step 3: Update presentation without changing operational behavior.**
  - Extend repository types and status presentation. In the settings panel, show concise factual statuses for “Fila da Ana”, “Rota de IA”, and “Prospecção automática”, including an actionable correction link where permitted.
  - Preserve admin gates and existing routes; do not turn diagnostics into controls or reveal configuration secrets.

- [ ] **Step 4: Run diagnostics/isolation tests and commit.**
  - Run diagnostics, context isolation, TypeScript test files; commit as `feat(operations): report Ana queue and safe route health`.

### Task 7: Integrate, validate, and release without real messaging

**Files:**
- Modify only files exposed by test failures in Tasks 1–6
- Do not add release-only secrets or generated artifacts to Git

- [ ] **Step 1: Execute local validation.**
  - Run the focused suites from Tasks 1–6, then `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run`, the command convention lint/type-check/build commands, `git diff --check`, and the site artifact command.
  - Inspect the final diff to confirm no `.env`, token, key, QR, log, backup, temporary file, `node_modules`, or pnpm artifact is staged.

- [ ] **Step 2: Perform a read-only remote preflight.**
  - Verify schema ledger/triggers/function signatures, queue absence/presence, active WA-AKG account/control state, legacy config metadata, function deployment inventory, and the current published source. Do not mutate contacts, campaigns, messages, or devices.

- [ ] **Step 3: Apply in compatibility order.**
  - Apply existing durable queue migration if it is absent, then the inbound-protection migration and any schema migration produced by the legacy-retirement plan.
  - Deploy compatible functions only after their schema exists: at minimum `ana-run`, `wa-akg-worker`, `automation-worker`, `ana-operations`, `prospectar-leads`, `testar-integracao`, and `operational-diagnostics`; deploy any dependency changed by the separate legacy plan in its ordered release.
  - Re-read deployed function/schema state. A successful deployment command alone is not proof of a live route.

- [ ] **Step 4: Run controlled non-delivery verification.**
  - Use synthetic/mocked or read-only evidence to validate: protected-contact no-dispatch, approved-lead single queue job, lease/retry/effect idempotency, handoff block, invalid schedule no external call, FreeLLM structured probe, and diagnostic redaction.
  - Keep WhatsApp outbound controls disabled for the test; do not use a real recipient or claim delivery.

- [ ] **Step 5: Commit and publish only after all gates pass.**
  - Create logical commits in the task order, push the existing `main` branch without force, then publish the existing Site only if its source history is reconcilable and build validates. Confirm GitHub, Supabase functions, Site version, and published URL separately.

## Final acceptance matrix

| Requirement | Evidence required |
| --- | --- |
| Protected/unclassified inbound is visible but never automated | DB contract + worker test: message persisted, zero jobs/outreach/model calls |
| Approved IA lead gets exactly one processable job | duplicate/replay and FIFO queue tests |
| Direct Ana calls and races fail closed | authority and effect-fence tests |
| Human handoff remains human | handoff + contact-policy regression test |
| Invalid schedule cannot spend or loop | worker/PGlite tests with zero fetch/run and one audit |
| FreeLLM is the real primary route | structured probe/routing tests, no `/v1/models`-only claim |
| Diagnostics are useful and safe | org-isolation/redaction/presentation tests |
| Release is safe | preflight, migration-before-functions evidence, no real-message test, separate GitHub/Site evidence |
