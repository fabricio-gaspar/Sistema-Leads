# Retire Z-API and Evolution Operational Paths Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retire Z-API and Evolution GO from every new WayFlex operational path while preserving historical data, auditability, existing migration history, and a healthy WA-AKG path.

**Architecture:** WA-AKG is the sole provider accepted by live account resolution, inbound/outbound controls, handoff targets, diagnostics, and UI. Legacy provider data stays read-only and fail-closed. Existing remote legacy Edge Function names are not deleted in this rollout; database routing is removed first and compatible endpoints return retirement responses without data or network access.

**Tech Stack:** Supabase Postgres/RLS/RPC, Supabase Edge Functions (Deno), React/Vite/TypeScript, Vitest/PGlite.

**Design source:** `docs/superpowers/specs/2026-10-14-ana-wa-akg-operational-flow-design.md`

## Global Constraints

- This is a forward, reversible operational retirement—not data deletion. Keep legacy messages, accounts, integrations, secrets, receipts, migrations, and audit records for retention/audit.
- Do not broaden this work to retire Meta Cloud. `meta_cloud` remains separately gated unless explicitly approved later.
- Do not batch-rebind leads. A legacy-bound lead receives a WA-AKG binding only when a legitimate send/handoff resolution finds an eligible WA-AKG account; otherwise it fails closed without mutation.
- Do not remove remote legacy Edge Functions in this release. Source/history mismatch and retention must be separately inventoried and approved after fail-closed observation.
- Run the compatible database migration before deploying code that relies on WA-only resolver semantics. Do not generate QR codes, reconnect a session, send test messages, or expose provider configuration.

## Review Focus

- A legacy-bound lead with no eligible WA-AKG account must fail closed without changing its current binding; Task 2 includes the negative resolver contract.
- A healthy WA-AKG individual/seller account must remain selectable even without a corporate default; Task 2 includes the authorized-seller positive resolver contract.
- A caller invoking a historic action name must receive retirement before any external or secret read; Task 1/Task 3 include zero-fetch/Vault assertions.
- A stale runtime JSON value may be corrected without deleting unrelated configuration; Task 2 adds JSON preservation coverage.
- A historical remote Evolution endpoint may still exist after the release but must not be reachable from any routing/control path; Task 4 inventories it while leaving it for separate retention-approved decommission.

## Verification command convention

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
| Data-preserving retirement | `supabase/migrations/20261014123000_retire_zapi_evolution_operational_paths.sql` (new), PGlite/migration tests |
| Account/control handler | `supabase/functions/whatsapp-accounts/index.ts`, `src/lib/crm/whatsappAccountsRepository.ts`, `supabase/tests/runtimeHandlers.test.ts`, `src/lib/crm/whatsappAccountsRepository.test.ts` |
| Diagnostics cleanup | `supabase/functions/operational-diagnostics/index.ts`, `src/lib/crm/operationalDiagnosticsRepository.ts`, diagnostics tests |
| Shared runtime types | `supabase/functions/_shared/runtimeSafety.ts`, `supabase/functions/_shared/zapiInbound.ts` (remove after consumers are gone), `supabase/functions/_shared/messaging/MessagingProvider.ts`, `supabase/tests/runtimeSafety.test.ts` |
| Compatibility endpoints | `supabase/functions/webhook-whatsapp/index.ts`, `supabase/functions/enviar-teste-whatsapp/index.ts`, `supabase/functions/configurar-integracao/index.ts`, `supabase/functions/testar-integracao/index.ts` |

---

### Task 1: Characterize existing callers and retire behavior before changing code

**Files:**
- Modify: `supabase/tests/runtimeHandlers.test.ts`
- Modify: `supabase/tests/waAkgOperational.test.ts`
- Modify: `supabase/tests/waAkgProvider.test.ts`
- Modify: `supabase/tests/waAkgInbound.test.ts`
- Modify: `src/lib/crm/whatsappAccountsRepository.test.ts`
- Create: `supabase/tests/legacyProviderRetirement.test.ts`

**Interfaces:**
- Consumes: the existing `whatsapp-accounts` action request, `operational-diagnostics` action request, and WA-AKG list/status repository contracts.
- Produces: stable no-side-effect errors `legacy_whatsapp_provider_retired` and `channel_not_supported`; unchanged WA-AKG read/list/refresh behavior.

- [ ] **Step 1: Write failing behavior tests.**
  - Every retired `whatsapp-accounts` action (`configure`, connector-token, QR/status, provider-enable, account-enable) must return a stable retirement response and make zero fetch, Vault, account, or integration mutation.
  - A retired diagnostics/configuration action must return `channel_not_supported`/`legacy_whatsapp_provider_retired`, not reveal a legacy provider state, call a gateway, or create a job.
  - WA-AKG list/status/refresh behavior remains available; a stale legacy configuration cannot override a healthy connected WA-AKG account.
  - Add static/source assertions with a narrow whitelist for historic migrations/docs: no active source imports of `zapiBaseUrl` or `zapiInbound` after cleanup.
  - Run: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/runtimeHandlers.test.ts supabase/tests/waAkgOperational.test.ts supabase/tests/waAkgProvider.test.ts supabase/tests/waAkgInbound.test.ts src/lib/crm/whatsappAccountsRepository.test.ts supabase/tests/legacyProviderRetirement.test.ts`.
  - Expected: FAIL while the old action bodies/imports remain reachable.

- [ ] **Step 2: Run only the characterization suite.**
  - Run the files above and capture expected failures that demonstrate reachable legacy residue. Do not make remote changes during this task.

- [ ] **Step 3: Commit the tests only if they form a coherent red characterization commit.**
  - Use `test(whatsapp): characterize legacy provider retirement` if repository policy permits a failing-test commit; otherwise keep these tests paired with Task 3 implementation.

### Task 2: Add a data-preserving WA-AKG-only database boundary

**Files:**
- Create: `supabase/migrations/20261014123000_retire_zapi_evolution_operational_paths.sql`
- Modify: `supabase/tests/legacyProviderRetirement.test.ts`
- Modify: `supabase/tests/waAkgOperational.test.ts`
- Create: `supabase/tests/legacyProviderRetirement.integration.mjs`
- Modify: any existing PGlite test helper required to execute the migration, without changing its production behavior

**Interfaces:**
- Consumes: `resolve_lead_whatsapp_account(uuid, uuid)`, `central_list_transfer_targets(...)`, `assign_human_handoff(...)`, `central_get_conversation_channel_provider(...)`, and `resolve_whatsapp_lead_for_account(uuid, uuid, text)`.
- Produces: the same RPC names with WA-AKG-only selection, fail-closed legacy behavior, and unchanged historical-row readability.

- [ ] **Step 1: Write failing database contract tests.**
  - Z-API/Evolution provider controls become disabled with inbound/send/automation gates false, `kill_switch=true`, and safe `provider_retired` reason; a WA-AKG control remains unchanged.
  - Legacy accounts become not enabled/not default while their rows and history remain. Legacy integrations become disabled/paused/disconnected with a non-secret retirement status.
  - `organization_module_data.configuracao_runtime.data.provedorWhatsapp` is converted only when its current value is `zapi`, `evolution`, or `evolution_go`; all unrelated JSON is retained.
  - A legacy-bound lead reroutes only when an eligible connected/enabled/authorized WA-AKG account exists; it records one `wa_akg_migration_reroute` binding. With no eligible account it fails closed and leaves the lead/binding unchanged.
  - Handoff/transfer candidate functions exclude legacy accounts. Account-to-lead resolution rejects a non-WA-AKG account. Organization isolation remains intact.
  - Run: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/legacyProviderRetirement.test.ts supabase/tests/waAkgOperational.test.ts` and `"$WAYFLEX_NODE" supabase/tests/legacyProviderRetirement.integration.mjs`.
  - Expected: FAIL before the forward migration applies its replacement functions.

- [ ] **Step 2: Implement a forward migration.**
  - Recreate full current definitions of `resolve_lead_whatsapp_account`, `central_list_transfer_targets`, `assign_human_handoff`, `central_get_conversation_channel_provider`, and `resolve_whatsapp_lead_for_account` with explicit WA-AKG-only predicates. Do not use brittle `pg_get_functiondef` text substitution.
  - Select an eligible WA-AKG account by the authorized seller/owner path and then WA-AKG default path; verify account, integration, controls, active connection, organization, and non-archived state before returning it.
  - Update a lead's account/binding only after a valid WA-AKG selection. Never fall back to Z-API/Evolution and never touch rows when selection fails.
  - Disable legacy controls/accounts/integrations and correct only stale runtime-provider metadata. Keep all secrets/records and do not narrow provider enum/check constraints in this migration.
  - Revoke/grant function access exactly as the superseded server-side functions require, preserving RLS and tenant assertions.

- [ ] **Step 3: Run migration/PGlite contracts.**
  - Confirm migration ordering is additive, reruns safely where needed, preserves WA-AKG, and never creates a cross-tenant target.

- [ ] **Step 4: Commit the database boundary.**
  - Commit as `fix(whatsapp): retire legacy provider routing safely`.

### Task 3: Remove executable legacy source while retaining compatibility responses

**Files:**
- Modify: `supabase/functions/whatsapp-accounts/index.ts`
- Modify: `src/lib/crm/whatsappAccountsRepository.ts`
- Modify: `supabase/functions/operational-diagnostics/index.ts`
- Modify: `src/lib/crm/operationalDiagnosticsRepository.ts`
- Modify: `supabase/functions/_shared/runtimeSafety.ts`
- Delete: `supabase/functions/_shared/zapiInbound.ts` only after zero active imports are confirmed
- Modify: `supabase/functions/_shared/messaging/MessagingProvider.ts` only after all production consumers compile without `zapi`
- Modify: `supabase/tests/runtimeHandlers.test.ts`
- Modify: `supabase/tests/runtimeSafety.test.ts`
- Modify: `src/lib/crm/whatsappAccountsRepository.test.ts`

**Interfaces:**
- Consumes: Task 2's WA-AKG-only resolver/migration boundary and existing `WhatsappChannelsWorkspace` list/refresh use.
- Produces: a WA-AKG-only `whatsapp-accounts` operational surface, WA-AKG-only diagnostics, 410 compatibility endpoints, and no active `zapi` shared runtime type.

- [ ] **Step 1: Reduce `whatsapp-accounts` to the live contract.**
  - Retain WA-AKG list/read/refresh data required by `WhatsappChannelsWorkspace`, including permission and provider-control fields.
  - Remove unreachable Z-API helpers and action bodies. Retired action names must fail immediately with a stable code before reading Vault, database secrets, a gateway, or a remote provider.
  - Remove only obsolete frontend write wrappers (`configureSellerWhatsappAccount`, connector-token request, legacy enable). Preserve generic facade/list behavior until all live workspace consumers use the WA-AKG contract.

- [ ] **Step 2: Make diagnostics WA-AKG-only.**
  - Remove `zapiBaseUrl`, Z-API status construction, callback writing, and `configure_whatsapp_webhook` accepted-action paths from `operational-diagnostics`.
  - Retain independent status/events/kill-switch/real-mode/scheduler contracts. Return WA-AKG status or a factual unavailable/retired code; never synthesize a provider health signal.
  - Coordinate this edit with the Ana diagnostics plan so its new queue/routing snapshot is added to the same WA-AKG-only handler rather than creating parallel status paths.

- [ ] **Step 3: Narrow shared implementation types last.**
  - Once no active consumer remains, remove `zapiBaseUrl` and `zapiInbound`; remove the `zapi` variant from `MessagingProvider` only after TypeScript and Edge type-check identify no production dependency.
  - Keep Meta types/paths intact unless a separate approved work item retires them.

- [ ] **Step 4: Keep external compatibility explicit.**
  - Preserve `webhook-whatsapp` and `enviar-teste-whatsapp` as explicit 410 retirement endpoints. Keep `configurar-integracao` rejecting WhatsApp configuration and `testar-integracao` excluding WhatsApp provider tests.
  - Do not change `supabase/config.toml` merely to hide an endpoint; handler-authenticated 410 behavior is safer than a configuration-only disappearance.

- [ ] **Step 5: Run targeted handler/type tests and commit.**
  - Run: `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run supabase/tests/legacyProviderRetirement.test.ts supabase/tests/runtimeHandlers.test.ts supabase/tests/runtimeSafety.test.ts supabase/tests/waAkgOperational.test.ts supabase/tests/waAkgProvider.test.ts supabase/tests/waAkgInbound.test.ts src/lib/crm/whatsappAccountsRepository.test.ts src/lib/contextIsolationR5.test.ts`; then run the app and Edge type-check commands above.
  - Expected: PASS; no legacy action reaches fetch/Vault/mutation and WA-AKG tests remain green.
  - Commit as `refactor(whatsapp): remove active legacy provider code`.

### Task 4: Safely reconcile deployments and observe fail-closed behavior

**Files:**
- No application source changes unless a preflight exposes a contract mismatch

- [ ] **Step 1: Read-only production preflight.**
  - Inventory migration ledger, active function versions, legacy controls/accounts/integrations, legacy-bound lead count, WA-AKG eligible account availability by organization, current endpoint inventory, and current Site source/version.
  - Stop if an organization that needs outbound activity has no healthy WA-AKG account; the migration must not silently rebind or enable one.

- [ ] **Step 2: Validate locally first.**
  - Run focused tests, `"$WAYFLEX_NODE" node_modules/vitest/vitest.mjs run`, the command-convention lint/type-check/build commands, `git diff --check`, and Site artifact generation using the bundled runtime.
  - Inspect staged paths explicitly; never stage `.env`, credentials, logs, backups, temp files, `node_modules`, or pnpm artifacts.

- [ ] **Step 3: Release in schema-then-code order.**
  - Apply this retirement migration after the durable queue and contact-protection migrations from the Ana hardening plan.
  - Deploy `whatsapp-accounts` and `operational-diagnostics`, then deploy the existing compatibility stubs (`webhook-whatsapp`, `enviar-teste-whatsapp`, `configurar-integracao`, `testar-integracao`) only to ensure their remote bundles match the reviewed source.
  - Do not delete remote `evolution-go`/`webhook-evolution-go` functions in this release; record them for a retention-window decommission decision.

- [ ] **Step 4: Verify without delivery.**
  - Use read-only/function-contract checks to prove list/status expose WA-AKG only, retired actions return 4xx without side effects, no eligible WA-AKG account fails closed, a healthy WA-AKG path still resolves, and historical records remain queryable to authorized audit roles.
  - Do not create a real provider request, message, QR code, or callback replay.

- [ ] **Step 5: Publish only after proof.**
  - Push the existing `main` branch without force. Publish the existing Site only if the frontend cleanup is part of the validated commit and the configured source history is reconcilable.
  - Report separately: commit/push, database migration, Edge functions, Site version, and public URL. Do not claim one because another succeeded.

## Final acceptance matrix

| Requirement | Evidence required |
| --- | --- |
| WA-AKG is the only new operational WhatsApp route | resolver/handler tests and post-release inventory |
| Legacy provider cannot send, receive, configure, or alter data | retired-action tests with zero fetch/Vault/mutation |
| Legacy history stays available | migration/PGlite preservation assertions |
| Legacy-bound lead never silently routes through retired provider | resolver positive/negative tests |
| Healthy WA-AKG remains unaffected | list/status/resolver regression tests |
| No cross-tenant visibility | PGlite and context-isolation tests |
| Remote retirement is reversible | no remote function deletion, explicit 410 stubs, audit snapshot |
