# WA-AKG Device Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an administrator disconnect only a seller's WhatsApp device, retain all CRM history and account data, and safely pair a replacement device by QR Code.

**Architecture:** Add a dedicated `unlink_device` lifecycle action that applies the existing durable local cutoff before issuing the gateway logout and only clears the phone suffix after a confirmed remote outcome. Expose that state through the existing WA-AKG repository and replace operationally ambiguous session controls with a two-step device-link UI whose QR availability follows confirmed provider state.

**Tech Stack:** React + TypeScript, Vitest, Supabase Edge Functions (Deno), PostgreSQL migrations/RPCs, WA-AKG provider adapter.

**Spec:** `docs/superpowers/specs/2026-10-08-wa-akg-device-link-design.md`

## Global Constraints

- Preserve the WhatsApp account, contacts, conversations, messages, permissions, limits and existing session namespace.
- Keep gateway URL, API key, webhook secret and QR payload out of code, logs, tests and browser state.
- Persist the local cutoff before a remote logout; do not retry an ambiguous provider mutation.
- Never enable inbound, human send or Ana from device disconnect, connect, status refresh or QR generation.
- Preserve organization, owner and administrative permission boundaries.
- Do not deploy, publish, send messages, activate automation or alter the hosted environment as part of local implementation.

## Review Focus

- Timeout after gateway logout: the CRM must remain closed and require review, not show a disconnected success. Covered in Task 1.
- Cross-organization/account action: a caller must not disconnect another seller's device. Covered in Task 1.
- Confirmed logout: only device metadata is cleared; shared CRM history remains unchanged. Covered in Task 1.
- QR request before provider readiness: the UI must keep QR unavailable. Covered in Task 3.
- Device reconnection: connected status alone must not reopen inbound, send or Ana controls. Covered in Tasks 1 and 3.

---

### Task 1: Durable device-unlink lifecycle contract

**Files:**
- Create: `supabase/migrations/<timestamp>_wa_akg_device_unlink.sql`
- Modify: `supabase/functions/_shared/accountLifecycle.ts`
- Modify: `supabase/functions/wa-akg/index.ts:349-438`
- Test: `supabase/tests/waAkgDeviceLink.test.ts`

**Interfaces:**
- Consumes: `runAccountLifecycle`, `WaAkgProvider.logout()`, `whatsapp_accounts`, `messaging_provider_controls` and the lifecycle RPCs.
- Produces: action `unlink_device` with a public completed result `{ connected: false, connectionStatus: 'configured', phoneSuffix: null, deviceUnlinked: true }`; uncertain external logout resolves to `needs_review` with all local gates closed.

- [ ] **Step 1: Write failing lifecycle tests**

Add tests proving that `unlink_device` records the local cutoff before calling `logout`, clears only `connected_phone_suffix` after a confirmed logout, preserves account/history identifiers, rejects a non-manager/cross-tenant call, and maps an exception after the remote call begins to `needs_review` without another logout attempt.

- [ ] **Step 2: Run the new Edge test to verify it fails**

Run: `npm test -- supabase/tests/waAkgDeviceLink.test.ts`

Expected: FAIL because `unlink_device` is unsupported and the lifecycle completion cannot explicitly clear a phone suffix.

- [ ] **Step 3: Add the minimal database and Edge contract**

Extend the lifecycle action allow-list and SQL completion contract to accept `unlink_device` and an explicit `clear_phone_suffix` result flag. In `wa-akg`, authorize the action through the existing account scope, call `provider.logout()` through `runAccountLifecycle`, and return `configured`/disconnected only after the provider call resolves. Do not delete the integration, Vault secret, webhook identity, account or any CRM history.

- [ ] **Step 4: Run the focused Edge test to verify it passes**

Run: `npm test -- supabase/tests/waAkgDeviceLink.test.ts`

Expected: PASS, including uncertain-mutation and cross-tenant cases.

- [ ] **Step 5: Commit the contract change**

```bash
git add supabase/migrations/<timestamp>_wa_akg_device_unlink.sql supabase/functions/_shared/accountLifecycle.ts supabase/functions/wa-akg/index.ts supabase/tests/waAkgDeviceLink.test.ts
git commit -m "feat: add durable WA-AKG device unlink"
```

### Task 2: Typed client action and lifecycle error handling

**Files:**
- Modify: `src/lib/crm/whatsappAccountsRepository.ts:201-285`
- Test: `src/lib/crm/whatsappAccountsRepository.test.ts`

**Interfaces:**
- Consumes: `wa-akg` action `unlink_device` from Task 1.
- Produces: `unlinkWaAkgDevice(accountId: string): Promise<WaAkgChannelStatus>` and an action union that distinguishes device unlink from session stop/restart.

- [ ] **Step 1: Write failing repository tests**

Add tests asserting that `unlinkWaAkgDevice` invokes `wa-akg` with exactly `{ action: 'unlink_device', account_id }`, retains lifecycle-error handling, and never invokes QR, connect, activation or provider-control endpoints as a side effect.

- [ ] **Step 2: Run the repository test to verify it fails**

Run: `npm test -- src/lib/crm/whatsappAccountsRepository.test.ts`

Expected: FAIL because the typed client does not yet expose `unlinkWaAkgDevice`.

- [ ] **Step 3: Implement the minimal typed client action**

Add `unlink_device` to the action contract and implement `unlinkWaAkgDevice` through the existing `invokeWaAkg` path so session-context and lifecycle completion validation remain unchanged.

- [ ] **Step 4: Run the repository test to verify it passes**

Run: `npm test -- src/lib/crm/whatsappAccountsRepository.test.ts`

Expected: PASS with one invocation and no hidden reconnect/QR side effect.

- [ ] **Step 5: Commit the client contract**

```bash
git add src/lib/crm/whatsappAccountsRepository.ts src/lib/crm/whatsappAccountsRepository.test.ts
git commit -m "feat: expose WA-AKG device unlink client action"
```

### Task 3: Explicit device-link controls in the WA-AKG panel

**Files:**
- Modify: `src/components/feature/WaAkgPanel.tsx:1-295`
- Create: `src/components/feature/WaAkgPanel.deviceLink.test.tsx`

**Interfaces:**
- Consumes: `unlinkWaAkgDevice`, `runWaAkgAction('connect', accountId)`, `requestWaAkgQr`, public runtime state and lifecycle status.
- Produces: `Desconectar dispositivo`, `Conectar dispositivo` and a QR button whose availability follows the confirmed device-link state.

- [ ] **Step 1: Write failing UI tests**

Add component tests for: connected seller shows `Desconectar dispositivo`; confirmed disconnect switches to `Aguardando conexão` and shows `Conectar dispositivo`; QR remains disabled until runtime is confirmed in `SCAN_QR`/`QR`; a review/unavailable lifecycle blocks mutating controls; no reconnect/stop control is shown as a replacement for device unlink; and reconnecting never changes the provider policy checkboxes.

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npm test -- src/components/feature/WaAkgPanel.deviceLink.test.tsx`

Expected: FAIL because the panel still presents generic session controls and has no dedicated device-unlink action.

- [ ] **Step 3: Implement the explicit device-link UI**

Replace the ambiguous stop/restart presentation with a confirmation-backed `Desconectar dispositivo` action for confirmed connected seller accounts. Render `Conectar dispositivo` only for the preserved account after confirmed disconnect; request/refresh live runtime state and enable `Gerar QR Code` only when the gateway confirms the pairing state. Keep diagnosis-only behavior for `needs_review` or unavailable gateway and preserve current disabled controls while an action is in progress.

- [ ] **Step 4: Run the component test to verify it passes**

Run: `npm test -- src/components/feature/WaAkgPanel.deviceLink.test.tsx`

Expected: PASS for connected, awaiting-pairing, review and unavailable states.

- [ ] **Step 5: Run regression verification**

Run: `npm test -- src/components/feature/WaAkgPanel.deviceLink.test.tsx src/lib/crm/whatsappAccountsRepository.test.ts supabase/tests/waAkgDeviceLink.test.ts && npm run lint && npm run typecheck && npm run build && git diff --check`

Expected: all selected tests, lint, type-check, build and whitespace validation pass. Report any existing unrelated failure separately.

- [ ] **Step 6: Commit the UI change**

```bash
git add src/components/feature/WaAkgPanel.tsx src/components/feature/WaAkgPanel.deviceLink.test.tsx
git commit -m "feat: clarify WA-AKG device linking controls"
```

### Task 4: Local gateway and hosted-release readiness evidence

**Files:**
- Modify: `docs/CONTINUIDADE_WAYFLEX.md`
- Modify: `.agent/audit-state.json`
- Modify: `.agent/test-baseline.json`
- Modify: `.agent/execution-history.md`

**Interfaces:**
- Consumes: verification results from Tasks 1-3 and the existing WA-AKG local gateway preflight.
- Produces: an evidence-backed local checkpoint that separates code validation from gateway configuration, remote deployment, QR pairing and message delivery.

- [ ] **Step 1: Record the baseline and local verification result**

Capture the actual commit, working-tree scope, commands and results. State explicitly that no Supabase migration/function/site was deployed and no device was disconnected through the hosted CRM during local validation.

- [ ] **Step 2: Verify the isolated gateway without messages**

Run: `python3 instalar.py check`

Expected: local gateway and API guard checks pass; QR, message delivery and CRM integration remain separately labeled as not run.

- [ ] **Step 3: Commit the checkpoint**

```bash
git add docs/CONTINUIDADE_WAYFLEX.md .agent/audit-state.json .agent/test-baseline.json .agent/execution-history.md
git commit -m "docs: record WA-AKG device link validation"
```

## Self-review

- Spec coverage: Tasks 1-3 implement disconnect, preserved history, reconnect, QR gating, closed controls and uncertain-result handling; Task 4 records the separate deployment boundary.
- Step scan: each implementation task starts with a specific failing test and ends with an explicit validation/commit.
- Type consistency: `unlink_device` is the server action, `unlinkWaAkgDevice` is the client action, and `deviceUnlinked` is public completion metadata.
- Review focus coverage: all five listed failure modes are assigned to Tasks 1 or 3.
- Proportion: the plan remains bounded to the existing WA-AKG account lifecycle and panel; it does not redesign provider policy, CRM history or the gateway infrastructure.
