# WA-AKG Permission-Aware Activation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically enable a seller's connected WA-AKG account only when its active owner already has the required channel permissions, without changing provider-wide policy or Ana.

**Architecture:** Extend the existing read-only connection reconciliation in `wa-akg-worker`. For a provider-confirmed session, the worker will first prove the owner is active and has both own-channel permissions, then reuse the existing durable lifecycle activation contract with that owner as actor. The provider-wide controls remain an upper bound and are never mutated by this worker.

**Tech Stack:** Supabase Edge Functions, TypeScript, PostgreSQL lifecycle RPCs, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-09-wa-akg-permission-aware-activation-design.md`

## Global Constraints

- Preserve tenant isolation, the deterministic session id and existing custom worker authentication.
- A failed permission, membership or lifecycle check must leave account and integration disabled/paused.
- Do not generate QR, connect/disconnect a device, send a message, change `messaging_provider_controls` or enable Ana.
- The global WA-AKG policy remains the organization-wide ceiling for inbound, human replies and Ana.
- Use TDD: each new behavior must first fail for the missing behavior, then pass.

## Review Focus

- An active owner missing `channels.view_own` must remain blocked even if the gateway says CONNECTED.
- An active owner missing `channels.connect_own` must remain blocked even if the gateway says CONNECTED.
- An inactive or cross-organization owner must remain blocked and must not be treated as an activation actor.
- A lifecycle conflict or provider-read failure must not turn a previously blocked account on.
- Global inbound/send/automation/kill-switch controls must be unchanged; Ana must stay off after automatic activation.

---

### Task 1: Permission-aware activation in the WA-AKG reconciliation worker

**Files:**
- Modify: `supabase/functions/wa-akg-worker/index.ts:1-330`
- Modify: `supabase/tests/waAkgWorkerConnectionSync.test.ts:1-95`

**Interfaces:**
- Consumes: `hasOrganizationPermission(admin, organizationId, ownerUserId, permission)` from `_shared/auth.ts`.
- Consumes: `runAccountLifecycle(admin, { organizationId, accountId, provider, actorId }, 'activate', work)` from `_shared/accountLifecycle.ts`.
- Produces: a reconciliation that records provider-confirmed connection data and enables the account only through the existing lifecycle contract when owner permissions are sufficient.

- [ ] **Step 1: Write failing tests for the eligible owner and denied owners**

Extend the worker fixture with `owner_user_id` and mocks for `hasOrganizationPermission` and `runAccountLifecycle`. Add separate tests that assert:

```ts
it('activates a confirmed session for an active owner with both own-channel permissions', async () => {
  // provider CONNECTED + view_own + connect_own
  // expect lifecycle action 'activate' with the owner as actor
  // expect no direct provider-control mutation
});

it('keeps a confirmed session blocked when the owner lacks an own-channel permission', async () => {
  // provider CONNECTED + either permission false
  // expect no activation lifecycle call
  // expect the persisted account/integration remain disabled/paused
});
```

Add a third test for an inactive/missing owner and a fourth test that asserts the provider-control table is never updated.

- [ ] **Step 2: Run the focused test and verify RED**

Run:
```bash
NODE=/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE node_modules/vitest/vitest.mjs run supabase/tests/waAkgWorkerConnectionSync.test.ts
```

Expected: FAIL because confirmed sessions are still persisted as disabled and no lifecycle activation is requested.

- [ ] **Step 3: Implement the minimum permission-aware activation**

In `reconcileConnectedSessions`:

1. Select `owner_user_id` with each candidate.
2. Reject missing/invalid owner ids before any enabling write.
3. Require both `channels.view_own` and `channels.connect_own` through `hasOrganizationPermission`.
4. For an eligible, provider-confirmed session, invoke `runAccountLifecycle` with action `activate`, the owner as `actorId`, and a non-mutating work callback returning the already-confirmed connection and normalized suffix.
5. Do not write `messaging_provider_controls`; use the lifecycle result to decide whether to count the account as automatically activated.
6. Retain the existing catch behavior: uncertain reads, authorization failures and lifecycle conflicts do not downgrade a session or open its account.

Do not alter `processConnection`: a webhook alone is not enough to automatically enable an account; the existing direct provider confirmation remains required.

- [ ] **Step 4: Run focused regression tests and verify GREEN**

Run:
```bash
NODE=/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE node_modules/vitest/vitest.mjs run supabase/tests/waAkgWorkerConnectionSync.test.ts supabase/tests/messagingRecoveryR6.test.ts supabase/tests/waAkgProvider.test.ts
$NODE node_modules/typescript/bin/tsc --project tsconfig.edge.json
$NODE node_modules/eslint/bin/eslint.js supabase/functions/wa-akg-worker/index.ts supabase/tests/waAkgWorkerConnectionSync.test.ts --max-warnings 0
```

Expected: all focused tests, Edge type-check and targeted lint pass.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/wa-akg-worker/index.ts supabase/tests/waAkgWorkerConnectionSync.test.ts
git commit -m "feat: activate connected wa-akg accounts by permission"
```

### Task 2: Validate and publish the isolated worker update

**Files:**
- Modify: `.agent/audit-state.json`
- Modify: `.agent/system-baseline.md`
- Modify: `.agent/requirements-registry.json`
- Modify: `.agent/known-issues.md`
- Modify: `.agent/test-baseline.json`
- Modify: `.agent/execution-history.md`
- Modify: `docs/CONTINUIDADE_WAYFLEX.md`

**Interfaces:**
- Consumes: the tested Edge source from Task 1.
- Produces: a versioned Edge deployment and factual evidence that distinguishes activation state, policy state and message delivery.

- [ ] **Step 1: Run the full suite before deployment**

Run:
```bash
NODE=/Users/fabriciogaspar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE node_modules/vitest/vitest.mjs run
git diff --check
```

Expected: all tests pass; any pre-existing failure is recorded without suppression.

- [ ] **Step 2: Deploy only `wa-akg-worker` from the active remote bundle base**

Read the active function bundle first, replace only `wa-akg-worker/index.ts` with the tested source, preserve `verify_jwt: false` and its custom worker authentication, then deploy the function. Do not deploy the frontend, migrations or unrelated Edge Functions.

- [ ] **Step 3: Verify an eligible synthetic or owner-authorized connected account through read-only evidence**

Confirm separately:

```sql
-- check account connection/enabled, integration connected/enabled/paused,
-- and that provider controls and Ana policy did not change.
```

Use an existing connected session only with owner authorization. Do not send a WhatsApp message as part of this verification.

- [ ] **Step 4: Update factual continuity records**

Record source version, exact test evidence, deployment status and runtime observation. State explicitly that message delivery remains unverified unless a separately authorized controlled inbound test occurs.

- [ ] **Step 5: Commit and synchronize**

```bash
git add .agent/audit-state.json .agent/system-baseline.md .agent/requirements-registry.json .agent/known-issues.md .agent/test-baseline.json .agent/execution-history.md docs/CONTINUIDADE_WAYFLEX.md
git commit -m "docs: record permission-aware wa-akg activation"
git push origin main
```

## Plan Self-Review

- Spec coverage: Tasks 1 and 2 cover authorization, lifecycle activation, unchanged global controls/Ana, tests, deployment and factual continuity records.
- Type consistency: the plan uses existing `hasOrganizationPermission`, `runAccountLifecycle`, lifecycle action `activate` and existing worker test infrastructure.
- Scope: no schema migration or frontend change is required; the plan deliberately reuses the existing RBAC and lifecycle contracts.
- Review focus coverage: Task 1 adds tests for denied permissions, inactive owner, unchanged controls and no unsafe promotion; Task 2 confirms runtime state independently.
