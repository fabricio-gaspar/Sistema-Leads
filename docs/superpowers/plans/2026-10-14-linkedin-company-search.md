# LinkedIn Company Search Connector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:test-driven-development` for each behavior and `superpowers:verification-before-completion` before claiming completion. Implement task-by-task in the native checkout; do not execute paid Apify runs or send messages.

**Goal:** Implement a real, separate `linkedin` source for company discovery through the approved Apify LinkedIn Company Search Scraper, while preserving Google Maps (`apify`) and Google Places (`google_places`) unchanged.

**Architecture:** Reuse the existing server-side Apify client and vault-backed integration contract, adding a LinkedIn-specific adapter that maps CRM filters to the Actor input and normalizes/deduplicates company results. Keep execution in manual-review mode: no campaign enrollment, WhatsApp sending, Ana activation, or automatic lead promotion. Expose LinkedIn as an independently testable, disabled-until-validated provider in Configurações → APIs and as an opt-in source in Busca de Leads.

**Tech Stack:** React + TypeScript + Vite, Supabase Edge Functions (Deno-compatible TypeScript), existing `apify-client`, Vitest, ESLint, TypeScript.

**Spec:** `docs/superpowers/specs/2026-10-14-linkedin-company-search-design.md`

## Global Constraints

- Do not alter Supabase migrations, RLS, Edge Function deployment, production data, WhatsApp sessions, QR codes, Ana controls, or customer messages.
- Do not run the paid Apify Actor. Tests use deterministic fixtures and mocked client boundaries only.
- Never put tokens, cookies, actor/task credentials, or full vault payloads in browser state, Git, test snapshots, or logs.
- Preserve the existing Google Maps and Google Places source contracts and labels.
- Keep scheduling disabled for LinkedIn in this first phase; only an explicit, reviewed search may run.
- Leave the pre-existing `supabase/.temp/cli-latest` modification unstaged and untouched.

## Task 1 — Add pure LinkedIn adapter and fixture-driven tests

**Files:**
- Add `supabase/functions/_shared/linkedinCompanySearch.ts`.
- Add a deterministic test module under the existing test layout (or a Deno test beside the shared module if the repository runtime supports it).

**Steps:**

- [ ] Define typed LinkedIn filters and vault credential shape (`api_token`, `actor_id`, optional `task_id`, optional `input_json`) without exposing secrets.
- [ ] Build Actor input for `searchQuery`, `locations`, `industryIds`, `companySize`, `maxItems`, `startPage`, `takePages`, and `mode`, rejecting empty terms and invalid limits.
- [ ] Normalize the Actor payload into the CRM company shape: company name, LinkedIn URL, website, nullable phone, location, sector, size/employee range, and source URL.
- [ ] Deduplicate by normalized LinkedIn URL, then domain, then company + location; never synthesize a phone or email.
- [ ] Map timeout, rate-limit, malformed-output, and missing-credential cases to stable non-secret error codes.
- [ ] Write failing tests first for input mapping, nullable fields, deduplication, and error classification; then implement until green.

**Validation:** run the focused test command, `npm run type-check:edge`, and the relevant lint command available in the checkout.

## Task 2 — Extend the server contract without changing existing sources

**Files:**
- `supabase/functions/prospectar-leads/index.ts`
- `supabase/functions/configurar-integracao/index.ts`
- `supabase/functions/testar-integracao/index.ts`
- `supabase/functions/_shared/apifyClient.ts` only if a small typed boundary is needed

**Steps:**

- [ ] Add `linkedin` to source/provider unions and labels while retaining `apify` as Google Maps and `google_places` as Google.
- [ ] Route LinkedIn through the new adapter and the existing server-side Apify client; do not duplicate token handling or hard-code a Google actor for LinkedIn.
- [ ] Store/read LinkedIn credentials only through the existing vault flow; expose only safe actor/task/status metadata to the UI.
- [ ] Make `testar-integracao` validate LinkedIn independently and persist a source status only after the credential/Actor contract passes.
- [ ] Keep scheduler validation explicitly restricted to the already-supported Google Maps path.
- [ ] Ensure repeated execution is idempotent and a failed/timeout run is recorded without a blind retry.

**Validation:** add contract tests for source separation, invalid credentials, timeout/limit errors, and idempotent result handling; run `npm run test -- <focused files>` and `npm run type-check:edge`.

## Task 3 — Add the LinkedIn provider to configuration and source registries

**Files:**
- `src/pages/dashboard/configuracoes/components/ApisProvidersTab.tsx`
- `src/pages/dashboard/configuracoes/components/IntegrationConfigureModal.tsx`
- `src/hooks/useIntegracoesStore.ts`
- `src/mocks/businessData.ts`
- `src/mocks/fontesData.ts`
- `src/hooks/useFontesStore.ts`
- `src/lib/crm/operationalStatusPresentation.ts`
- `src/lib/crm/prospectingSourcePresentation.ts`

**Steps:**

- [ ] Add a separate LinkedIn card with a truthful “Não validado”/disabled state until an administrator configures and tests it.
- [ ] Reuse generic vault field handling, adding LinkedIn actor/task/input fields without rendering tokens after save.
- [ ] Apply actor/task validation to both `apify` and `linkedin`, preserving the Google Maps special case.
- [ ] Register LinkedIn as a prospecting API source and add the correct icon, labels, status tone, and empty/error copy.
- [ ] Do not revive legacy Instagram/Meta or Evolution/Z-API entries as operational providers.

**Validation:** component/store tests for label separation, hidden secret values, disabled-until-valid state, and unchanged Google Maps/Google behavior; run focused Vitest and lint.

## Task 4 — Expose reviewable LinkedIn search filters in Busca de Leads

**Files:**
- `src/pages/dashboard/busca-leads/page.tsx`
- Add a small colocated options component only if it keeps the page readable.

**Steps:**

- [ ] Include LinkedIn in the source selector only when the source is configured/available; otherwise show it as unavailable with a direct configuration link.
- [ ] Add LinkedIn-only fields for location, industry identifiers, company size, result limit, and scraper mode while reusing the existing term/location controls where possible.
- [ ] Validate required search terms and safe limits before invoking the Edge Function.
- [ ] Present results as reviewable companies with source URL and missing-data states; require explicit import/promotion before any lead workflow.
- [ ] Keep run history, resume, empty, loading, timeout, and failure states source-aware; do not route LinkedIn runs through Google Maps labels.

**Validation:** UI tests for filter validation, source-specific labels, review-only behavior, and no-send/no-Ana side effects; run focused Vitest, lint, and type-check.

## Task 5 — End-to-end verification and release hygiene

**Files:**
- Update only relevant tests and `docs/CONTINUIDADE_WAYFLEX.md`/checkpoint notes with evidence after implementation.

**Steps:**

- [ ] Run the focused test suite and then the full existing test suite.
- [ ] Run `npm run type-check`, `npm run type-check:edge`, `npm run lint`, and `npm run build`.
- [ ] Verify route access, permission checks, source isolation, and that Google Maps/Google remain operational by existing tests or safe read-only checks.
- [ ] Verify no secrets, mocks presented as real data, paid Actor invocation, messages, migrations, or Edge deployments were introduced.
- [ ] Review `git diff --check`, status, and staged paths; commit only intended files in one logical commit (or clearly separated logical commits if validation requires it).

**Definition of done:** LinkedIn is independently configurable and testable, safe-by-default and review-only; Google Maps and Google behavior is unchanged; deterministic tests, type-check, lint, and build pass; no production or paid external side effect occurred.

---

## Review Focus

1. Confirm the selected Actor ID (`taHaRcqil3scbchuI`) is treated as configuration, not a hard-coded credential or paid test dependency.
2. Confirm no phone/email is invented when the Actor omits it.
3. Confirm deduplication and idempotency happen before any optional CRM import.
4. Confirm a LinkedIn failure cannot mark Google Maps/Google unavailable.
5. Confirm the scheduler and Ana remain disabled for this first review-only phase.
