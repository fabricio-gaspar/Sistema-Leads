import {
  createAdminClient,
  requireOrganizationRole,
  requireUser,
} from "../_shared/auth.ts";
import {
  allowedCorsHeaders,
  hasAllowedOrigin,
  json,
  preflight,
  safeError,
} from "../_shared/http.ts";
import {
  anaResponseSucceeded,
  automationBlockReason,
  zapiBaseUrl,
} from "../_shared/runtimeSafety.ts";
import {
  readCatalogImageMedia,
  safePublicImageUrl,
} from "../_shared/catalogMedia.ts";
import {
  suppressionHashes,
  suppressionOrFilter,
} from "../_shared/contactSuppression.ts";
import {
  dailyLeadReportStage,
  dailyLeadReportStages,
  formatDailyLeadReport,
  normalizeDailyReportPhone,
  validDailyReportTime,
  type DailyLeadReportStage,
} from "../_shared/dailyLeadReport.ts";
import { parseZapiEvent } from "../_shared/zapiInbound.ts";
import { EvolutionGoProvider } from "../_shared/messaging/EvolutionGoProvider.ts";
import { WaAkgProvider } from "../_shared/messaging/WaAkgProvider.ts";

function secureEqual(actual: string | null, expected: string): boolean {
  if (!actual || !expected || actual.length !== expected.length) return false;
  let difference = 0;
  for (let i = 0; i < actual.length; i++)
    difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
function isUuid(v: unknown): v is string {
  return (
    typeof v === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      v,
    )
  );
}
function canonicalChannel(v: unknown): string {
  const n = String(v ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  if (n === "whatsapp") return "whatsapp";
  if (n === "email" || n === "resend") return "email";
  return n;
}
function validEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}
function asText(v: unknown, m = 4096): string {
  return typeof v === "string" ? v.trim().slice(0, m) : "";
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (item) => item.toString(16).padStart(2, "0")).join("");
}
function activeControlledSandboxTest(
  payload: Record<string, unknown>,
  now = Date.now(),
): boolean {
  if (payload.controlled_test !== true) return false;
  const expiresAt = Date.parse(asText(payload.controlled_test_expires_at, 64));
  return Number.isFinite(expiresAt) && expiresAt > now;
}
type Admin = ReturnType<typeof createAdminClient>;

async function reconcileEarlyWhatsappReceipts(
  admin: Admin,
  organizationId: string,
  providerMessageId: string,
): Promise<{ matched: number; processed: number }> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1_000).toISOString();
  const { data, error } = await admin
    .from("webhook_events")
    .select("id,payload")
    .eq("organization_id", organizationId)
    .in("provider", ["zapi", "z-api"])
    .eq("status", "failed")
    .in("error", ["outbound_message_not_matched", "receipt_targets_pending"])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error("early_receipt_lookup_failed");

  let matched = 0;
  let processed = 0;
  for (const candidate of Array.isArray(data) ? data : []) {
    const event = asObject(candidate);
    const eventId = asText(event.id, 80);
    const receipt = parseZapiEvent(event.payload);
    if (!eventId || receipt.kind !== "receipt" || !receipt.providerMessageIds.includes(providerMessageId)) continue;
    matched += 1;
    const { data: reconciledData, error: reconciliationError } = await admin.rpc(
      "reconcile_whatsapp_receipt",
      {
        p_organization_id: organizationId,
        p_provider_message_ids: receipt.providerMessageIds,
        p_expected_message_count: receipt.expectedMessageCount,
        p_status: receipt.status,
        p_occurred_at: receipt.occurredAt,
      },
    );
    if (reconciliationError) throw new Error("early_receipt_reconciliation_failed");
    const reconciledRows = (Array.isArray(reconciledData)
      ? reconciledData
      : reconciledData
        ? [reconciledData]
        : []).map(asObject).filter((row) => Object.keys(row).length > 0);
    if (!reconciledRows.length) continue;
    const partial = reconciledRows.length < receipt.expectedMessageCount;
    const changed = reconciledRows.some((row) => row.changed === true);
    const first = reconciledRows[0];
    const { error: updateError } = await admin.from("webhook_events").update({
      status: partial ? "failed" : "processed",
      error: partial ? "receipt_targets_pending" : changed ? null : "receipt_already_reconciled",
      processed_at: new Date().toISOString(),
      lead_id: first.lead_id ?? null,
      outreach_id: first.outreach_id ?? null,
    }).eq("id", eventId).eq("organization_id", organizationId).eq("status", "failed");
    if (updateError) throw new Error("early_receipt_state_persist_failed");
    if (!partial) processed += 1;
  }
  return { matched, processed };
}

type AnaPolicy = {
  configurationVersionId: string;
  dailyMessageLimit: number;
  allowedChannels: string[];
  firstFollowUpHours: number;
  secondFollowUpHours: number;
  timeoutHours: number;
  businessHoursOnly: boolean;
  catalogMediaImagesEnabled: boolean;
};

type BusinessHoursDecision = {
  allowed: boolean;
  reason: string;
  nextRunAt: string | null;
  localDay: string;
};

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function boundedInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function configuredChannels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .map((channel) => canonicalChannel(channel))
        .filter((channel) => channel === "whatsapp" || channel === "email"),
    ),
  ];
}

function parseAnaPolicy(
  configurationVersionId: unknown,
  configuration: unknown,
): AnaPolicy | null {
  const versionId = asText(configurationVersionId, 80);
  if (!isUuid(versionId)) return null;
  const source = asObject(configuration);
  const cadence = asObject(source.cadencePolicy);
  const allowedChannels = configuredChannels(source.allowedChannels);
  if (!allowedChannels.length) return null;
  return {
    configurationVersionId: versionId,
    dailyMessageLimit: boundedInteger(source.dailyMessageLimit, 5, 1, 20),
    allowedChannels,
    firstFollowUpHours: boundedInteger(
      cadence.firstFollowUpHours,
      24,
      1,
      24 * 30,
    ),
    secondFollowUpHours: boundedInteger(
      cadence.secondFollowUpHours,
      72,
      2,
      24 * 60,
    ),
    timeoutHours: boundedInteger(cadence.timeoutHours, 120, 24, 24 * 90),
    businessHoursOnly: asBoolean(cadence.businessHoursOnly, true),
    catalogMediaImagesEnabled: asBoolean(source.catalogMediaImagesEnabled, false),
  };
}

async function readPublishedAnaPolicy(admin: Admin, organizationId: string) {
  const { data: agent, error: agentError } = await admin
    .from("ai_agents")
    .select("active_version_id")
    .eq("organization_id", organizationId)
    .eq("key", "ana")
    .maybeSingle();
  if (agentError) throw new Error("ana_configuration_read_failed");
  const versionId = asText(agent?.active_version_id, 80);
  if (!isUuid(versionId)) return null;
  const { data: version, error: versionError } = await admin
    .from("ai_agent_versions")
    .select("configuration")
    .eq("id", versionId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (versionError) throw new Error("ana_configuration_read_failed");
  return parseAnaPolicy(versionId, version?.configuration);
}

function normalizedDay(value: unknown): string {
  return asText(value, 80)
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z]/g, "");
}

function clockMinutes(value: unknown): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(asText(value, 8));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function validTimeZone(value: unknown): string | null {
  const candidate = asText(value, 80);
  if (!candidate) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: candidate }).format();
    return candidate;
  } catch {
    return null;
  }
}

function resolveTimeZone(
  runtime: Record<string, unknown>,
  company: Record<string, unknown>,
): string {
  const uiSettings = asObject(company.ui_settings);
  return (
    validTimeZone(runtime.timezone) ??
    validTimeZone(uiSettings.timezone) ??
    "America/Sao_Paulo"
  );
}

type LocalDateTime = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: string;
};

function localDateTime(date: Date, timeZone: string): LocalDateTime {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "long",
  }).formatToParts(date);
  const numeric = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: numeric("year"),
    month: numeric("month"),
    day: numeric("day"),
    hour: numeric("hour"),
    minute: numeric("minute"),
    weekday: parts.find((part) => part.type === "weekday")?.value ?? "",
  };
}

function localDayKey(parts: Pick<LocalDateTime, "year" | "month" | "day">): string {
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(
    parts.day,
  ).padStart(2, "0")}`;
}

function addLocalDays(
  date: Pick<LocalDateTime, "year" | "month" | "day">,
  days: number,
) {
  const result = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return {
    year: result.getUTCFullYear(),
    month: result.getUTCMonth() + 1,
    day: result.getUTCDate(),
  };
}

function zonedTime(
  date: Pick<LocalDateTime, "year" | "month" | "day">,
  minuteOfDay: number,
  timeZone: string,
): Date {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const expected = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  let timestamp = expected;
  // Re-evaluate the offset so this also behaves correctly when a configured
  // organization uses a zone with daylight-saving transitions.
  for (let attempt = 0; attempt < 3; attempt++) {
    const actual = localDateTime(new Date(timestamp), timeZone);
    const observed = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
    );
    timestamp += expected - observed;
  }
  return new Date(timestamp);
}

function businessHoursDecision(
  runtime: Record<string, unknown>,
  timeZone: string,
  now = new Date(),
): BusinessHoursDecision {
  const configuredDays = Array.isArray(runtime.diasSemana)
    ? runtime.diasSemana.map(asObject)
    : [];
  const holidays = new Set(
    (Array.isArray(runtime.feriados) ? runtime.feriados : [])
      .map((holiday) => asText(asObject(holiday).data, 10))
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)),
  );
  const nowLocal = localDateTime(now, timeZone);
  const localDay = localDayKey(nowLocal);
  const validWindows = configuredDays
    .map((day) => ({
      day: normalizedDay(day.dia),
      active: day.ativo === true,
      start: clockMinutes(day.inicio),
      end: clockMinutes(day.fim),
    }))
    .filter(
      (day): day is { day: string; active: boolean; start: number; end: number } =>
        Boolean(day.day) && day.start !== null && day.end !== null && day.end > day.start,
    );
  if (!validWindows.some((window) => window.active)) {
    return {
      allowed: false,
      reason: "business_hours_configuration_missing",
      nextRunAt: null,
      localDay,
    };
  }

  for (let offset = 0; offset < 14; offset++) {
    const date = addLocalDays(nowLocal, offset);
    const dateKey = localDayKey(date);
    if (holidays.has(dateKey)) continue;
    const weekday = normalizedDay(
      localDateTime(zonedTime(date, 12 * 60, timeZone), timeZone).weekday,
    );
    const window = validWindows.find(
      (candidate) => candidate.active && candidate.day === weekday,
    );
    if (!window) continue;
    const opensAt = zonedTime(date, window.start, timeZone);
    const closesAt = zonedTime(date, window.end, timeZone);
    if (now < opensAt) {
      return {
        allowed: false,
        reason: "outside_business_hours",
        nextRunAt: opensAt.toISOString(),
        localDay,
      };
    }
    if (now < closesAt) {
      return { allowed: true, reason: "business_hours_open", nextRunAt: null, localDay };
    }
  }
  return {
    allowed: false,
    reason: "business_hours_next_window_not_found",
    nextRunAt: null,
    localDay,
  };
}

function sameInstant(left: unknown, right: unknown): boolean {
  const leftTime = Date.parse(asText(left, 64));
  const rightTime = Date.parse(asText(right, 64));
  return Number.isFinite(leftTime) && leftTime === rightTime;
}

function sameNullableInstant(left: unknown, right: unknown): boolean {
  const leftText = asText(left, 64);
  const rightText = asText(right, 64);
  return !leftText && !rightText ? true : sameInstant(leftText, rightText);
}

function validFutureInstant(value: unknown, after: Date): string | null {
  const text = asText(value, 64);
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) && parsed > after.getTime() ? text : null;
}

function nextLocalDayStart(timeZone: string, now = new Date()): Date {
  const nextDay = addLocalDays(localDateTime(now, timeZone), 1);
  return zonedTime(nextDay, 5, timeZone);
}

async function deferJob(
  admin: Admin,
  organizationId: string,
  jobId: string,
  reason: string,
  runAt: string,
) {
  const { error } = await admin
    .from("outreach_jobs")
    .update({
      status: "queued",
      run_at: runAt,
      locked_at: null,
      locked_by: null,
      error: reason,
    })
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .eq("status", "processing");
  if (error) throw new Error("outreach_job_defer_failed");
}

async function cancelCadenceJob(
  admin: Admin,
  organizationId: string,
  jobId: string,
  reason: string,
) {
  const { error } = await admin
    .from("outreach_jobs")
    .update({
      status: "cancelled",
      processed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      error: reason,
    })
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .eq("status", "processing");
  if (error) throw new Error("cadence_job_cancel_failed");
}

async function completeCadenceJob(
  admin: Admin,
  organizationId: string,
  jobId: string,
) {
  const { error } = await admin
    .from("outreach_jobs")
    .update({
      status: "processed",
      processed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      error: null,
    })
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .eq("status", "processing");
  if (error) throw new Error("cadence_job_complete_failed");
}

async function retryCadenceJob(
  admin: Admin,
  organizationId: string,
  jobId: string,
  attempt: number,
  reason: string,
) {
  const { error } = await admin
    .from("outreach_jobs")
    .update({
      status: "queued",
      run_at: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
      attempt,
      locked_at: null,
      locked_by: null,
      error: reason,
    })
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .eq("status", "processing");
  if (error) throw new Error("cadence_job_retry_failed");
}

async function failCadenceJob(
  admin: Admin,
  organizationId: string,
  jobId: string,
  attempt: number,
  reason: string,
) {
  const { error } = await admin
    .from("outreach_jobs")
    .update({
      status: "failed",
      attempt,
      locked_at: null,
      locked_by: null,
      error: reason,
    })
    .eq("id", jobId)
    .eq("organization_id", organizationId)
    .eq("status", "processing");
  if (error) throw new Error("cadence_job_fail_failed");
}

/**
 * The queue claim is deliberately short-lived, so a human takeover can happen
 * while an automatic job is being prepared.  Re-read the operational state
 * immediately before a provider call (and before creating another cadence
 * job) instead of relying on the earlier queue-read snapshot.
 */
export async function automaticDispatchBlock(
  admin: Admin,
  input: {
    organizationId: string;
    leadId: string;
    channel: string;
    expectedLastContact: unknown;
    expectedNoReplyDeadline?: unknown;
    expectedConfigurationVersionId?: string;
    expectedIntegrationId?: string;
    expectedWhatsappAccountId?: string;
    allowMeetingHandoffAcknowledgement?: boolean;
  },
): Promise<string | null> {
  const expectedIntegrationId = isUuid(input.expectedIntegrationId)
    ? input.expectedIntegrationId
    : null;
  const expectedWhatsappAccountId = isUuid(input.expectedWhatsappAccountId)
    ? input.expectedWhatsappAccountId
    : null;
  if (input.channel === 'whatsapp' && Boolean(expectedIntegrationId) !== Boolean(expectedWhatsappAccountId)) {
    return 'whatsapp_channel_identity_invalid';
  }
  const [leadResult, companyResult, aiResult, runtimeResult, handoffResult, channelResult] =
    await Promise.all([
      admin
        .from("leads")
        .select(
          "owner_id,modo_atendimento,ai_paused,opt_out,contact_approval_status,last_contact,no_reply_deadline_at",
        )
        .eq("organization_id", input.organizationId)
        .eq("id", input.leadId)
        .maybeSingle(),
      admin
        .from("company_settings")
        .select("active,sandbox_mode,can_use_ia,ai_actions_enabled")
        .eq("organization_id", input.organizationId)
        .maybeSingle(),
      admin
        .from("integrations")
        .select("enabled,connected,paused")
        .eq("organization_id", input.organizationId)
        .eq("key", "ai")
        .maybeSingle(),
      admin
        .from("organization_module_data")
        .select("data")
        .eq("organization_id", input.organizationId)
        .eq("module_key", "configuracao_runtime")
        .maybeSingle(),
      admin
        .from("lead_handoffs")
        .select("id")
        .eq("organization_id", input.organizationId)
        .eq("lead_id", input.leadId)
        .in("status", ["pending", "accepted"])
        .limit(1)
        .maybeSingle(),
      admin
        .from("integrations")
        .select("enabled,connected,paused")
        .eq("organization_id", input.organizationId)
        .eq(expectedIntegrationId ? "id" : "key", expectedIntegrationId ?? input.channel)
        .maybeSingle(),
    ]);
  if (
    [
      leadResult,
      companyResult,
      aiResult,
      runtimeResult,
      handoffResult,
      channelResult,
    ].some((result) => result.error)
  )
    throw new Error("dispatch_final_safety_read_failed");

  const block = automationBlockReason({
    company: companyResult.data,
    ai: aiResult.data,
    runtime: asObject(runtimeResult.data?.data),
    lead: leadResult.data,
    requiresApprovedContact: true,
  });
  if (
    block &&
    !(
      input.allowMeetingHandoffAcknowledgement === true &&
      block === "human_mode"
    )
  )
    return block;
  if (handoffResult.data?.id && !input.allowMeetingHandoffAcknowledgement)
    return "lead_handoff_open";
  if (!sameNullableInstant(leadResult.data?.last_contact, input.expectedLastContact))
    return "outbound_context_stale";
  if (
    input.expectedNoReplyDeadline !== undefined &&
    !sameInstant(
      leadResult.data?.no_reply_deadline_at,
      input.expectedNoReplyDeadline,
    )
  )
    return "cadence_context_stale";
  if (
    !channelResult.data?.connected ||
    channelResult.data.enabled !== true ||
    channelResult.data.paused !== false
  )
    return "channel_not_ready";
  if (input.channel === 'whatsapp' && expectedIntegrationId && expectedWhatsappAccountId) {
    const [accountRead, canonicalRouteRead] = await Promise.all([
      admin.from('whatsapp_accounts')
        .select('id,integration_id,provider,enabled,connection_status')
        .eq('id', expectedWhatsappAccountId).eq('organization_id', input.organizationId)
        .eq('integration_id', expectedIntegrationId).is('archived_at', null).maybeSingle(),
      admin.rpc('resolve_lead_whatsapp_account', {
        p_organization_id: input.organizationId,
        p_lead_id: input.leadId,
      }),
    ]);
    if (accountRead.error || canonicalRouteRead.error) throw new Error('whatsapp_final_route_read_failed');
    const account = accountRead.data;
    const routeRows = Array.isArray(canonicalRouteRead.data)
      ? canonicalRouteRead.data
      : canonicalRouteRead.data ? [canonicalRouteRead.data] : [];
    const canonicalRoute = asObject(routeRows[0]);
    if (!account || account.enabled !== true || account.connection_status !== 'connected') return 'channel_not_ready';
    if (
      asText(canonicalRoute.account_id, 80) !== expectedWhatsappAccountId
      || asText(canonicalRoute.integration_id, 80) !== expectedIntegrationId
    ) return 'whatsapp_account_changed';
    if (['evolution_go', 'wa_akg'].includes(asText(account.provider, 40))) {
      const controlledProvider = asText(account.provider, 40);
      const { data: controls, error: controlsError } = await admin.from('messaging_provider_controls')
        .select('send_enabled,automation_enabled,kill_switch')
        .eq('organization_id', input.organizationId).eq('provider', controlledProvider).maybeSingle();
      if (controlsError) throw new Error(`${controlledProvider}_control_read_failed`);
      if (!controls || controls.send_enabled !== true || controls.automation_enabled !== true || controls.kill_switch === true) {
        return `${controlledProvider}_automation_not_ready`;
      }
    }
  }
  if (input.expectedConfigurationVersionId) {
    const policy = await readPublishedAnaPolicy(admin, input.organizationId);
    if (!policy) return "ana_configuration_missing";
    if (
      policy.configurationVersionId !== input.expectedConfigurationVersionId ||
      !policy.allowedChannels.includes(input.channel)
    )
      return "ana_configuration_changed_before_cadence";
  }
  return null;
}

async function scheduleAnaCadence(
  admin: Admin,
  input: {
    organizationId: string;
    leadId: string;
    sourceJobId: string;
    sourceMessageId: string;
    channel: string;
    sentAt: string;
    initialSentAt?: string | null;
    previousCadenceStep?: string | null;
    noReplyDeadlineAt: string;
    policy: AnaPolicy;
    integrationId?: string;
    whatsappAccountId?: string;
  },
) {
  const sentAt = Date.parse(input.sentAt);
  const initialSentAt = Date.parse(input.initialSentAt ?? input.sentAt);
  const deadlineAt = Date.parse(input.noReplyDeadlineAt);
  if (
    !Number.isFinite(sentAt) ||
    !Number.isFinite(initialSentAt) ||
    !Number.isFinite(deadlineAt) ||
    deadlineAt <= sentAt
  )
    return { scheduled: 0, error: "cadence_schedule_input_invalid" };
  const steps = input.previousCadenceStep === "first"
    ? [{ name: "second", hours: input.policy.secondFollowUpHours, base: initialSentAt }]
    : input.previousCadenceStep
      ? []
      : [{ name: "first", hours: input.policy.firstFollowUpHours, base: sentAt }];
  if (!steps.length) return { scheduled: 0, error: null };
  const finalBlock = await automaticDispatchBlock(admin, {
    organizationId: input.organizationId,
    leadId: input.leadId,
    channel: input.channel,
    expectedLastContact: input.sentAt,
    expectedNoReplyDeadline: input.noReplyDeadlineAt,
    expectedConfigurationVersionId: input.policy.configurationVersionId,
    expectedIntegrationId: input.integrationId,
    expectedWhatsappAccountId: input.whatsappAccountId,
  });
  if (finalBlock) return { scheduled: 0, error: finalBlock };
  let scheduled = 0;
  for (const step of steps) {
    // The second step is not created until the first was provider-accepted.
    // Its configured offset remains relative to the original outreach, but it
    // can never be scheduled before the accepted first follow-up.
    const runAt = Math.max(
      sentAt,
      step.base + step.hours * 60 * 60 * 1000,
    );
    // A follow-up cannot compete with the already-configured timeout handoff.
    if (runAt >= deadlineAt) continue;
    const { error } = await admin.from("outreach_jobs").upsert(
      {
        organization_id: input.organizationId,
        lead_id: input.leadId,
        channel: "automation",
        run_at: new Date(runAt).toISOString(),
        status: "queued",
        attempt: 0,
        idempotency_key: `ana-cadence:${input.sourceJobId}:${step.name}`,
        payload: {
          kind: "ana_cadence",
          step: step.name,
          target_channel: input.channel,
          source_job_id: input.sourceJobId,
          source_message_id: input.sourceMessageId,
          initial_sent_at: new Date(initialSentAt).toISOString(),
          expected_last_contact: input.sentAt,
          no_reply_deadline_at: input.noReplyDeadlineAt,
          configuration_version_id: input.policy.configurationVersionId,
          ...(input.channel === 'whatsapp' && isUuid(input.integrationId) && isUuid(input.whatsappAccountId) ? {
            integration_id: input.integrationId,
            whatsapp_account_id: input.whatsappAccountId,
          } : {}),
        },
      },
      { onConflict: "idempotency_key", ignoreDuplicates: true },
    );
    if (error) return { scheduled, error: "cadence_schedule_persist_failed" };
    scheduled++;
  }
  return { scheduled, error: null };
}

async function processAnaCadenceJob(
  admin: Admin,
  input: {
    organizationId: string;
    job: { id: string; lead_id: string; attempt?: unknown; payload: Record<string, unknown> };
  },
): Promise<{ status: "completed" | "deferred" | "cancelled" | "failed"; reason?: string }> {
  const { organizationId, job } = input;
  const payload = job.payload;
  const configurationVersionId = asText(payload.configuration_version_id, 80);
  const expectedLastContact = asText(payload.expected_last_contact, 64);
  const deadlineAt = asText(payload.no_reply_deadline_at, 64);
  const targetChannel = canonicalChannel(payload.target_channel);
  try {
    if (
      !isUuid(configurationVersionId) ||
      !expectedLastContact ||
      !validFutureInstant(deadlineAt, new Date(0)) ||
      !["whatsapp", "email"].includes(targetChannel) ||
      payload.dry_run === true
    ) {
      await cancelCadenceJob(admin, organizationId, job.id, "cadence_payload_invalid");
      return { status: "cancelled", reason: "cadence_payload_invalid" };
    }

    const [leadResult, companyResult, aiResult, runtimeResult] = await Promise.all([
      admin
        .from("leads")
        .select(
          "id,owner_id,modo_atendimento,ai_paused,opt_out,contact_approval_status,last_contact,no_reply_deadline_at,active_channel",
        )
        .eq("organization_id", organizationId)
        .eq("id", job.lead_id)
        .maybeSingle(),
      admin
        .from("company_settings")
        .select("active,sandbox_mode,can_use_ia,ai_actions_enabled,ui_settings")
        .eq("organization_id", organizationId)
        .maybeSingle(),
      admin
        .from("integrations")
        .select("enabled,connected,paused")
        .eq("organization_id", organizationId)
        .eq("key", "ai")
        .maybeSingle(),
      admin
        .from("organization_module_data")
        .select("data")
        .eq("organization_id", organizationId)
        .eq("module_key", "configuracao_runtime")
        .maybeSingle(),
    ]);
    if ([leadResult, companyResult, aiResult, runtimeResult].some((read) => read.error))
      throw new Error("cadence_context_read_failed");

    const policy = await readPublishedAnaPolicy(admin, organizationId);
    if (!policy) {
      await cancelCadenceJob(admin, organizationId, job.id, "ana_configuration_missing");
      return { status: "cancelled", reason: "ana_configuration_missing" };
    }
    if (policy.configurationVersionId !== configurationVersionId) {
      await cancelCadenceJob(
        admin,
        organizationId,
        job.id,
        "ana_configuration_changed_before_cadence",
      );
      return {
        status: "cancelled",
        reason: "ana_configuration_changed_before_cadence",
      };
    }
    if (!policy.allowedChannels.includes(targetChannel)) {
      await cancelCadenceJob(
        admin,
        organizationId,
        job.id,
        "cadence_channel_not_allowed_by_ana_configuration",
      );
      return {
        status: "cancelled",
        reason: "cadence_channel_not_allowed_by_ana_configuration",
      };
    }

    const lead = leadResult.data;
    const company = companyResult.data;
    const runtime = asObject(runtimeResult.data?.data);
    const blocked = automationBlockReason({
      company,
      ai: aiResult.data,
      runtime,
      lead,
      requiresApprovedContact: true,
    });
    if (blocked) {
      await cancelCadenceJob(admin, organizationId, job.id, `cadence_${blocked}`);
      return { status: "cancelled", reason: `cadence_${blocked}` };
    }
    if (
      !sameInstant(lead?.last_contact, expectedLastContact) ||
      !sameInstant(lead?.no_reply_deadline_at, deadlineAt)
    ) {
      await cancelCadenceJob(admin, organizationId, job.id, "cadence_context_stale");
      return { status: "cancelled", reason: "cadence_context_stale" };
    }
    if (Date.parse(deadlineAt) <= Date.now()) {
      await cancelCadenceJob(admin, organizationId, job.id, "cadence_deadline_expired");
      return { status: "cancelled", reason: "cadence_deadline_expired" };
    }

    const timeZone = resolveTimeZone(runtime, asObject(company));
    if (policy.businessHoursOnly) {
      const businessHours = businessHoursDecision(runtime, timeZone);
      if (!businessHours.allowed) {
        if (!businessHours.nextRunAt) {
          await cancelCadenceJob(admin, organizationId, job.id, businessHours.reason);
          return { status: "cancelled", reason: businessHours.reason };
        }
        await deferJob(
          admin,
          organizationId,
          job.id,
          businessHours.reason,
          businessHours.nextRunAt,
        );
        return { status: "deferred", reason: businessHours.reason };
      }
    }

    const baseUrl = Deno.env.get("SUPABASE_URL");
    const serviceJwt = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const internalCredential = Deno.env.get("WHATSAPP_WEBHOOK_SHARED_SECRET");
    if (!baseUrl || !serviceJwt || !internalCredential)
      throw new Error("cadence_internal_auth_not_configured");
    const response = await fetch(`${baseUrl}/functions/v1/ana-run`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceJwt}`,
        "Content-Type": "application/json",
        "x-internal-worker-secret": internalCredential,
      },
      body: JSON.stringify({
        event: "cadence.followup",
        lead_id: job.lead_id,
        modo: "ia",
        organization_id: organizationId,
        request_id: `cadence:${job.id}`,
        retry_failed: true,
        contexto: {
          cadence: {
            step: asText(payload.step, 20),
            target_channel: targetChannel,
            source_job_id: asText(payload.source_job_id, 80),
            source_message_id: asText(payload.source_message_id, 80),
            initial_sent_at: asText(payload.initial_sent_at, 64),
            expected_last_contact: expectedLastContact,
            no_reply_deadline_at: deadlineAt,
            configuration_version_id: configurationVersionId,
          },
        },
      }),
      signal: AbortSignal.timeout(45_000),
    });
    const result = await response.json().catch(() => null);
    if (anaResponseSucceeded(response.status, result)) {
      if (asObject(result).skipped === true) {
        const reason = asText(asObject(result).reason, 120) || "ana_cadence_skipped";
        await cancelCadenceJob(admin, organizationId, job.id, reason);
        return { status: "cancelled", reason };
      }
      await completeCadenceJob(admin, organizationId, job.id);
      return { status: "completed" };
    }
    throw new Error(`ana_cadence_not_completed_${response.status}`);
  } catch (error) {
    const attempt = boundedInteger(job.attempt, 0, 0, 100) + 1;
    const reason = `ana_cadence_${safeError(error).slice(0, 96)}`;
    if (attempt < 3) {
      await retryCadenceJob(admin, organizationId, job.id, attempt, reason);
      return { status: "deferred", reason };
    }
    await failCadenceJob(admin, organizationId, job.id, attempt, reason);
    return { status: "failed", reason };
  }
}

async function maintainKnowledgeEmbeddings(admin: Admin, org: string) {
  const { data: chunks, error } = await admin
    .from("knowledge_chunks")
    .select("id,content,metadata")
    .eq("organization_id", org)
    .eq("status", "active")
    .is("embedding", null)
    .order("created_at", { ascending: true })
    .limit(20);
  if (error || !chunks?.length)
    return {
      processed: 0,
      remaining: 0,
      status: error ? "read_failed" : "complete",
    };
  const { data: ai, error: ae } = await admin
    .from("integrations")
    .select("id,enabled,connected,paused")
    .eq("organization_id", org)
    .eq("key", "ai")
    .maybeSingle();
  if (ae || !ai?.enabled || !ai.connected || ai.paused)
    return { processed: 0, remaining: chunks.length, status: "ai_not_ready" };
  const { data: secret, error: se } = await admin.rpc(
    "read_integration_secret",
    { p_integration: ai.id },
  );
  const key = asText(asObject(secret).openai_key, 1000);
  if (se || !key)
    return {
      processed: 0,
      remaining: chunks.length,
      status: "embedding_provider_not_configured",
    };
  try {
    const r = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "text-embedding-3-small",
        dimensions: 1536,
        input: chunks.map((x) => x.content),
      }),
      signal: AbortSignal.timeout(30000),
    });
    if (!r.ok)
      return {
        processed: 0,
        remaining: chunks.length,
        status: `provider_${r.status}`,
      };
    const b = (await r.json()) as {
      data?: Array<{ index?: number; embedding?: number[] }>;
    };
    const vectors = (b.data ?? [])
      .slice()
      .sort((a, b) => Number(a.index ?? 0) - Number(b.index ?? 0));
    if (
      vectors.length !== chunks.length ||
      vectors.some(
        (x) => !Array.isArray(x.embedding) || x.embedding?.length !== 1536,
      )
    )
      return {
        processed: 0,
        remaining: chunks.length,
        status: "invalid_embedding_response",
      };
    let processed = 0;
    const indexedAt = new Date().toISOString();
    for (let i = 0; i < chunks.length; i++) {
      const metadata = {
        ...asObject(chunks[i].metadata),
        embedding_model: "text-embedding-3-small",
        embedding_indexed_at: indexedAt,
      };
      const { error: e } = await admin
        .from("knowledge_chunks")
        .update({ embedding: vectors[i].embedding, metadata })
        .eq("id", chunks[i].id)
        .eq("organization_id", org)
        .is("embedding", null);
      if (!e) processed++;
    }
    const { count } = await admin
      .from("knowledge_chunks")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", org)
      .eq("status", "active")
      .is("embedding", null);
    return {
      processed,
      remaining: count ?? Math.max(0, chunks.length - processed),
      status: "ok",
    };
  } catch {
    return { processed: 0, remaining: chunks.length, status: "network_error" };
  }
}

async function sendWhatsapp(
  credentials: Record<string, unknown>,
  recipient: string,
  message: string,
) {
  const id = asText(credentials.instancia_id, 300),
    token = asText(credentials.token, 500),
    client = asText(credentials.client_token, 500);
  if (!id || !token || !client)
    throw new Error("channel_credentials_incomplete");
  const r = await fetch(
    `${zapiBaseUrl(credentials.url_base)}/instances/${encodeURIComponent(id)}/token/${encodeURIComponent(token)}/send-text`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": client },
      body: JSON.stringify({ phone: recipient, message }),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    },
  );
  if (!r.ok) throw new Error(`provider_http_${r.status}`);
  const receipt = (await r.json()) as { messageId?: unknown };
  if (typeof receipt.messageId !== "string" || !receipt.messageId)
    throw new Error("provider_receipt_missing");
  return { provider: "zapi", messageId: receipt.messageId };
}

async function sendWhatsappImage(
  credentials: Record<string, unknown>,
  recipient: string,
  image: string,
  caption: string,
) {
  const id = asText(credentials.instancia_id, 300),
    token = asText(credentials.token, 500),
    client = asText(credentials.client_token, 500);
  if (!id || !token || !client)
    throw new Error("channel_credentials_incomplete");
  const r = await fetch(
    `${zapiBaseUrl(credentials.url_base)}/instances/${encodeURIComponent(id)}/token/${encodeURIComponent(token)}/send-image`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "Client-Token": client },
      body: JSON.stringify({ phone: recipient, image, caption }),
      signal: AbortSignal.timeout(20000),
      redirect: "error",
    },
  );
  if (!r.ok) throw new Error(`provider_http_${r.status}`);
  const receipt = (await r.json()) as { messageId?: unknown };
  if (typeof receipt.messageId !== "string" || !receipt.messageId)
    throw new Error("provider_receipt_missing");
  return { provider: "zapi", messageId: receipt.messageId };
}

/** Keep outbound Evolution requests pinned to the administrator-approved tenant. */
const PROVISIONED_EVOLUTION_GO_ORIGIN = "https://evo-eisenflow.kz3solucoes.cloud";

function evolutionAllowedOrigins(): string[] {
  const origins = (Deno.env.get("EVOLUTION_GO_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return origins.length ? origins : [PROVISIONED_EVOLUTION_GO_ORIGIN];
}

function waAkgAllowedOrigins(): string[] {
  return (Deno.env.get("WA_AKG_ALLOWED_ORIGINS") ?? "")
    .split(",").map((value) => value.trim()).filter(Boolean);
}

async function loadWaAkgGatewaySecret(admin: Admin, organizationId: string): Promise<Record<string, unknown>> {
  const { data: account, error: accountError } = await admin.from('whatsapp_accounts')
    .select('integration_id').eq('organization_id', organizationId).eq('provider', 'wa_akg')
    .eq('account_type', 'corporate').is('archived_at', null)
    .order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (accountError) throw new Error('wa_akg_gateway_lookup_failed');
  const { data, error } = account?.integration_id
    ? await admin.rpc('read_integration_secret', { p_integration: account.integration_id })
    : { data: null, error: null };
  if (error) throw new Error('wa_akg_gateway_secret_read_failed');
  const stored = asObject(data);
  const baseUrl = asText(stored.base_url, 500) || asText(Deno.env.get('WA_AKG_BASE_URL'), 500);
  const apiKey = asText(stored.api_key, 1_000) || asText(Deno.env.get('WA_AKG_API_KEY'), 1_000);
  if (!baseUrl || !apiKey) throw new Error('wa_akg_gateway_not_configured');
  return { base_url: baseUrl, api_key: apiKey };
}

async function sendEvolutionGoWhatsapp(
  credentials: Record<string, unknown>,
  recipient: string,
  message: string,
  idempotencyKey: string,
  media?: { kind: "image" | "audio" | "video" | "document"; url: string; filename?: string },
) {
  const provider = new EvolutionGoProvider({
    baseUrl: asText(credentials.base_url, 500),
    instanceToken: asText(credentials.instance_token, 1_000),
    allowedOrigins: evolutionAllowedOrigins(),
    timeoutMs: Number(credentials.timeout_ms) || undefined,
  });
  const receipt = await provider.send(media
    ? {
      to: recipient, kind: media.kind, idempotencyKey,
      text: message, media: { link: media.url, caption: message, filename: media.filename },
    }
    : { to: recipient, kind: "text", text: message, idempotencyKey });
  return { provider: "evolution_go", messageId: receipt.providerMessageId };
}

async function sendWaAkgWhatsapp(
  credentials: Record<string, unknown>,
  recipient: string,
  message: string,
  idempotencyKey: string,
  media?: { kind: "image" | "audio" | "video" | "document"; url: string; filename?: string },
) {
  const provider = new WaAkgProvider({
    baseUrl: asText(credentials.base_url, 500),
    apiKey: asText(credentials.api_key, 1_000),
    sessionId: asText(credentials.session_id, 120),
    allowedOrigins: waAkgAllowedOrigins(),
    timeoutMs: Number(credentials.timeout_ms) || undefined,
  });
  const receipt = await provider.send(media
    ? { to: recipient, kind: media.kind, idempotencyKey, text: message,
      media: { link: media.url, caption: message, filename: media.filename } }
    : { to: recipient, kind: "text", text: message, idempotencyKey });
  return { provider: "wa_akg", messageId: receipt.providerMessageId };
}

async function processWaAkgQueues(organizationId: string): Promise<Record<string, unknown>> {
  const baseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceRole) return { status: 'not_configured' };
  try {
    const response = await fetch(`${baseUrl}/functions/v1/wa-akg-worker`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceRole}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: organizationId }),
      signal: AbortSignal.timeout(50_000),
    });
    const payload = asObject(await response.json().catch(() => null));
    return response.ok && payload.ok === true ? { status: 'ok', ...payload } : { status: 'failed' };
  } catch {
    return { status: 'network_error' };
  }
}

function requestedEvolutionMedia(payload: Record<string, unknown>): { kind: "image" | "audio" | "video" | "document"; url: string; filename?: string } | null {
  const media = asObject(payload.provider_media);
  const kind = asText(media.kind, 20);
  const url = asText(media.url, 2_000);
  if (!url || !["image", "audio", "video", "document"].includes(kind)) return null;
  return {
    kind: kind as "image" | "audio" | "video" | "document",
    url,
    ...(asText(media.filename, 240) ? { filename: asText(media.filename, 240) } : {}),
  };
}

type ResolvedCatalogImageMedia = {
  catalogItemId: string;
  itemName: string;
  imageUrl: string;
};

async function resolveCatalogImageMedia(
  admin: Admin,
  input: {
    organizationId: string;
    leadId: string;
    messageId: string;
    channel: string;
    payload: Record<string, unknown>;
    manual: boolean;
    anaPolicy: AnaPolicy | null;
  },
): Promise<ResolvedCatalogImageMedia | null> {
  const request = readCatalogImageMedia(input.payload.media);
  if (!request) return null;
  if (input.channel !== "whatsapp") throw new Error("catalog_media_channel_not_supported");
  if (!input.manual && !input.anaPolicy?.catalogMediaImagesEnabled)
    throw new Error("catalog_media_disabled_by_ana_configuration");

  const { data: item, error: itemError } = await admin
    .from("knowledge_catalog_items")
    .select("id,name,status,ana_enabled,image_url")
    .eq("organization_id", input.organizationId)
    .eq("id", request.catalogItemId)
    .maybeSingle();
  if (itemError) throw new Error("catalog_media_read_failed");
  if (!item || item.status !== "active") throw new Error("catalog_media_not_available");
  if (!input.manual && item.ana_enabled !== true)
    throw new Error("catalog_media_not_enabled_for_ana");
  const imageUrl = safePublicImageUrl(item.image_url);
  if (!imageUrl) throw new Error("catalog_media_url_not_allowed");

  const { data: attachment, error: attachmentError } = await admin
    .from("message_attachments")
    .select("external_url")
    .eq("organization_id", input.organizationId)
    .eq("lead_id", input.leadId)
    .eq("message_id", input.messageId)
    .eq("media_type", "image")
    .limit(1)
    .maybeSingle();
  if (attachmentError) throw new Error("catalog_media_attachment_read_failed");
  if (!attachment) throw new Error("catalog_media_attachment_missing");
  if (safePublicImageUrl(attachment.external_url) !== imageUrl)
    throw new Error("catalog_media_changed_before_dispatch");

  return { catalogItemId: item.id, itemName: asText(item.name, 240), imageUrl };
}
async function sendEmail(
  credentials: Record<string, unknown>,
  configuration: Record<string, unknown>,
  recipient: string,
  message: string,
  subject: string,
) {
  const key = asText(credentials.resend_api_key || credentials.api_key, 1000),
    fromEmail = asText(credentials.from_email || configuration.from_email, 254),
    fromName =
      asText(credentials.from_name || configuration.from_name, 160) ||
      "Wayflex";
  if (!key || !validEmail(fromEmail))
    throw new Error("email_credentials_incomplete");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `${fromName} <${fromEmail}>`,
      to: [recipient],
      subject: subject || "Contato Wayflex",
      text: message,
    }),
    signal: AbortSignal.timeout(20000),
    redirect: "error",
  });
  if (!r.ok) throw new Error(`provider_http_${r.status}`);
  const receipt = (await r.json()) as { id?: unknown };
  if (typeof receipt.id !== "string" || !receipt.id)
    throw new Error("provider_receipt_missing");
  return { provider: "resend", messageId: receipt.id };
}

function nextAnaScheduleAt(timeZone: string, runTime: unknown, weekdays: unknown, from = new Date()): string {
  const minute = clockMinutes(asText(runTime, 8).slice(0, 5)) ?? 9 * 60;
  const allowed = Array.isArray(weekdays) ? weekdays.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6) : [1, 2, 3, 4, 5];
  const local = localDateTime(from, timeZone);
  for (let offset = 0; offset < 8; offset += 1) {
    const day = addLocalDays(local, offset);
    const noon = zonedTime(day, 12 * 60, timeZone);
    if (!allowed.includes(noon.getUTCDay())) continue;
    const candidate = zonedTime(day, minute, timeZone);
    if (candidate.getTime() > from.getTime() + 30_000) return candidate.toISOString();
  }
  return new Date(from.getTime() + 24 * 60 * 60 * 1000).toISOString();
}

async function createCommercialDigests(admin: Admin, organizationId: string) {
  const { data: preferences, error } = await admin.from('notification_preferences').select('user_id,digest_time,timezone').eq('organization_id', organizationId).eq('digest_enabled', true);
  if (error) throw new Error('digest_preferences_read_failed');
  let created = 0;
  for (const preference of preferences ?? []) {
    const timeZone = validTimeZone(preference.timezone) ?? 'America/Sao_Paulo';
    const local = localDateTime(new Date(), timeZone);
    const digestMinute = clockMinutes(asText(preference.digest_time, 8).slice(0, 5)) ?? 18 * 60;
    if (local.hour * 60 + local.minute < digestMinute) continue;
    const dateKey = localDayKey(local);
    const dayStart = zonedTime(local, 0, timeZone).toISOString();
    const { data: ownedLeads, error: ownedLeadsError } = await admin.from('leads').select('id').eq('organization_id', organizationId).or(`owner_id.eq.${preference.user_id},assigned_to.eq.${preference.user_id}`);
    if (ownedLeadsError) throw new Error('digest_leads_read_failed');
    const leadIds = (ownedLeads ?? []).map((lead) => lead.id);
    const emptyCount = Promise.resolve({ count: 0 });
    const [{ count: replies }, { count: hot }, { count: meetings }, { count: quotes }, { count: human }] = await Promise.all(leadIds.length ? [
      admin.from('domain_events').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).eq('event_name', 'lead.reply.received').in('entity_id', leadIds).gte('occurred_at', dayStart),
      admin.from('lead_qualifications').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).in('lead_id', leadIds).eq('interest_level', 'hot').gte('updated_at', dayStart),
      admin.from('lead_qualifications').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).in('lead_id', leadIds).eq('requested_action', 'meeting').gte('updated_at', dayStart),
      admin.from('lead_qualifications').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).in('lead_id', leadIds).eq('requested_action', 'quote').gte('updated_at', dayStart),
      admin.from('lead_qualifications').select('id', { count: 'exact', head: true }).eq('organization_id', organizationId).in('lead_id', leadIds).eq('requested_action', 'human').gte('updated_at', dayStart),
    ] : [emptyCount, emptyCount, emptyCount, emptyCount, emptyCount]);
    const description = `${replies ?? 0} responderam · ${hot ?? 0} quentes · ${meetings ?? 0} reuniões · ${quotes ?? 0} orçamentos · ${human ?? 0} exigem atendimento humano.`;
    const { data } = await admin.from('notifications').upsert({ organization_id: organizationId, user_id: preference.user_id, kind: 'DAILY_DIGEST', title: `Resumo comercial — ${dateKey.split('-').reverse().join('/')}`, description, read: false, link: '/dashboard', priority: 'normal', status: 'open', action_required: false, recommended_action: 'Revisar prioridades do dia', metadata: { date: dateKey, replies, hot, meetings, quotes, human }, deduplication_key: `daily-digest:${dateKey}` }, { onConflict: 'organization_id,user_id,deduplication_key', ignoreDuplicates: true }).select('id').maybeSingle();
    if (data?.id) created += 1;
  }
  return created;
}

type DailyReportPreference = {
  user_id: string;
  daily_lead_report_phone: string | null;
  daily_lead_report_time: string | null;
  timezone: string | null;
};

type DailyReportRun = {
  status: 'idle' | 'sent' | 'blocked' | 'integration_unavailable' | 'real_mode_required' | 'manual_skip';
  due: number;
  sent: number;
  failed: number;
  reconciliationRequired: number;
};

async function setDailyReportPreferenceState(
  admin: Admin,
  organizationId: string,
  userId: string,
  state: 'sending' | 'sent' | 'failed' | 'reconciliation_required' | 'blocked',
  input: { sentAt?: string; error?: string | null } = {},
) {
  const { error } = await admin.from('notification_preferences').update({
    daily_lead_report_last_status: state,
    ...(input.sentAt ? { daily_lead_report_last_sent_at: input.sentAt } : {}),
    daily_lead_report_last_error: input.error ?? null,
    updated_at: new Date().toISOString(),
  }).eq('organization_id', organizationId).eq('user_id', userId);
  if (error) throw new Error('daily_report_preference_state_save_failed');
}

async function dailyLeadReportContent(
  admin: Admin,
  organizationId: string,
  userId: string,
  role: string,
  local: LocalDateTime,
  timeZone: string,
): Promise<string> {
  let query = admin.from('leads').select('stage,created_at,last_contact').eq('organization_id', organizationId);
  if (role !== 'administrador') query = query.or(`owner_id.eq.${userId},assigned_to.eq.${userId}`);
  const { data, error } = await query;
  if (error) throw new Error('daily_report_leads_read_failed');
  const start = zonedTime(local, 0, timeZone).getTime();
  const stages = dailyLeadReportStages.reduce((current, stage) => {
    current[stage] = 0;
    return current;
  }, {} as Record<DailyLeadReportStage, number>);
  let totalLeads = 0;
  let newLeads = 0;
  let interactionsToday = 0;
  let noInteraction = 0;
  for (const lead of (data ?? []) as Array<{ stage?: unknown; created_at?: unknown; last_contact?: unknown }>) {
    const stage = dailyLeadReportStage(lead.stage);
    stages[stage] += 1;
    totalLeads += 1;
    const createdAt = Date.parse(asText(lead.created_at, 64));
    if (Number.isFinite(createdAt) && createdAt >= start) newLeads += 1;
    const lastContact = Date.parse(asText(lead.last_contact, 64));
    if (Number.isFinite(lastContact) && lastContact >= start) interactionsToday += 1;
    if (!Number.isFinite(lastContact)) noInteraction += 1;
  }
  const dateLabel = `${String(local.day).padStart(2, '0')}/${String(local.month).padStart(2, '0')}`;
  return formatDailyLeadReport({
    dateLabel,
    totalLeads,
    newLeads,
    interactionsToday,
    noInteraction,
    stages,
  });
}

async function processDailyWhatsappReports(admin: Admin, organizationId: string): Promise<DailyReportRun> {
  const empty = (status: DailyReportRun['status']): DailyReportRun => ({ status, due: 0, sent: 0, failed: 0, reconciliationRequired: 0 });
  const [companyRead, preferencesRead, whatsappRead, riskRead] = await Promise.all([
    admin.from('company_settings').select('active,sandbox_mode').eq('organization_id', organizationId).maybeSingle(),
    admin.from('notification_preferences')
      .select('user_id,daily_lead_report_phone,daily_lead_report_time,timezone')
      .eq('organization_id', organizationId).eq('daily_lead_report_enabled', true),
    admin.from('integrations').select('id,connected,enabled,paused').eq('organization_id', organizationId).eq('key', 'whatsapp').maybeSingle(),
    admin.from('channel_policy_events').select('id').eq('organization_id', organizationId).eq('channel', 'whatsapp')
      .eq('action', 'pause').is('resolved_at', null).limit(1).maybeSingle(),
  ]);
  if (companyRead.error || preferencesRead.error || whatsappRead.error || riskRead.error) throw new Error('daily_report_runtime_read_failed');
  if (companyRead.data?.active !== true || companyRead.data?.sandbox_mode !== false) return empty('real_mode_required');
  const now = new Date();
  const due = (preferencesRead.data ?? []).map((item) => {
    const preference = item as DailyReportPreference;
    const timeZone = validTimeZone(preference.timezone) ?? 'America/Sao_Paulo';
    const local = localDateTime(now, timeZone);
    const scheduleTime = validDailyReportTime(preference.daily_lead_report_time) || '18:00';
    const scheduledMinute = clockMinutes(scheduleTime) ?? 18 * 60;
    return { preference, timeZone, local, scheduleTime, due: local.hour * 60 + local.minute >= scheduledMinute };
  }).filter((item) => item.due);
  if (!due.length) return empty('idle');
  const whatsapp = whatsappRead.data;
  const channelUnavailable = !whatsapp?.connected || !whatsapp?.enabled || whatsapp?.paused || Boolean(riskRead.data);
  if (channelUnavailable) {
    await Promise.all(due.map(({ preference }) => setDailyReportPreferenceState(admin, organizationId, preference.user_id, 'blocked', {
      error: whatsapp?.paused || riskRead.data ? 'whatsapp_policy_pause_active' : 'whatsapp_channel_unavailable',
    }).catch(() => undefined)));
    return { ...empty('blocked'), due: due.length };
  }
  if (!whatsapp) return { ...empty('blocked'), due: due.length };
  const { data: credentials, error: credentialsError } = await admin.rpc('read_integration_secret', { p_integration: whatsapp.id });
  if (credentialsError) {
    await Promise.all(due.map(({ preference }) => setDailyReportPreferenceState(admin, organizationId, preference.user_id, 'blocked', { error: 'whatsapp_credentials_unavailable' }).catch(() => undefined)));
    return { ...empty('integration_unavailable'), due: due.length };
  }

  let sent = 0;
  let failed = 0;
  let reconciliationRequired = 0;
  for (const item of due) {
    const { preference, timeZone, local, scheduleTime } = item;
    const phone = normalizeDailyReportPhone(preference.daily_lead_report_phone);
    if (!phone) {
      failed += 1;
      await setDailyReportPreferenceState(admin, organizationId, preference.user_id, 'blocked', { error: 'daily_report_phone_invalid' }).catch(() => undefined);
      continue;
    }
    const { data: member, error: memberError } = await admin.from('organization_members').select('role,status')
      .eq('organization_id', organizationId).eq('user_id', preference.user_id).maybeSingle();
    if (memberError || !member || member.status !== 'active') {
      failed += 1;
      await setDailyReportPreferenceState(admin, organizationId, preference.user_id, 'blocked', { error: 'daily_report_member_inactive' }).catch(() => undefined);
      continue;
    }
    let providerAccepted = false;
    let deliveryId: string | null = null;
    try {
      const content = await dailyLeadReportContent(admin, organizationId, preference.user_id, asText(member.role, 40), local, timeZone);
      const localDay = localDayKey(local);
      const { data: reservation, error: reservationError } = await admin.from('daily_lead_report_deliveries').insert({
        organization_id: organizationId,
        user_id: preference.user_id,
        local_day: localDay,
        scheduled_for: scheduleTime,
        message_sha256: await sha256Hex(content),
        status: 'sending',
        attempted_at: new Date().toISOString(),
      }).select('id').maybeSingle();
      if (reservationError?.code === '23505') continue;
      if (reservationError || !reservation?.id) throw new Error('daily_report_reservation_failed');
      deliveryId = reservation.id;
      await setDailyReportPreferenceState(admin, organizationId, preference.user_id, 'sending');
      const receipt = await sendWhatsapp(asObject(credentials), phone, content);
      providerAccepted = true;
      const sentAt = new Date().toISOString();
      const { error: deliveryError } = await admin.from('daily_lead_report_deliveries').update({
        status: 'sent', sent_at: sentAt, provider_message_id: receipt.messageId, error: null, updated_at: sentAt,
      }).eq('id', deliveryId).eq('organization_id', organizationId).eq('status', 'sending');
      if (deliveryError) throw new Error('daily_report_acceptance_persist_failed');
      await setDailyReportPreferenceState(admin, organizationId, preference.user_id, 'sent', { sentAt });
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_name: 'Sistema',
        actor_type: 'system',
        action: 'notification.daily_report_provider_accepted',
        detail: 'Resumo diário aceito pela Z-API para entrega ao usuário configurado.',
        entity_table: 'daily_lead_report_deliveries',
        entity_id: deliveryId,
        event_data: { user_id: preference.user_id, local_day: localDay, phone_suffix: phone.slice(-4) },
      });
      sent += 1;
    } catch (error) {
      const state = providerAccepted ? 'reconciliation_required' : 'failed';
      const code = providerAccepted ? 'daily_report_provider_accepted_reconciliation_required' : safeError(error).slice(0, 160);
      if (deliveryId) await admin.from('daily_lead_report_deliveries').update({
        status: state, error: code, updated_at: new Date().toISOString(),
      }).eq('id', deliveryId).eq('organization_id', organizationId);
      await setDailyReportPreferenceState(admin, organizationId, preference.user_id, state, { error: code }).catch(() => undefined);
      await admin.from('audit_logs').insert({
        organization_id: organizationId,
        actor_name: 'Sistema',
        actor_type: 'system',
        action: providerAccepted ? 'notification.daily_report_reconciliation_required' : 'notification.daily_report_failed',
        detail: providerAccepted ? 'A Z-API aceitou o resumo diário, mas o registro final requer reconciliação.' : 'O resumo diário não foi enviado pelo provedor.',
        entity_table: 'daily_lead_report_deliveries',
        entity_id: deliveryId,
        event_data: { user_id: preference.user_id, phone_suffix: phone.slice(-4), reason: code },
      });
      if (providerAccepted) reconciliationRequired += 1;
      else failed += 1;
    }
  }
  return { status: sent > 0 ? 'sent' : 'idle', due: due.length, sent, failed, reconciliationRequired };
}

type HandoffWhatsappRun = { status: 'idle' | 'sent' | 'blocked' | 'integration_unavailable' | 'real_mode_required'; queued: number; sent: number; failed: number; reconciliationRequired: number };

async function processHandoffWhatsappNotifications(admin: Admin, organizationId: string): Promise<HandoffWhatsappRun> {
  const empty = (status: HandoffWhatsappRun['status']): HandoffWhatsappRun => ({ status, queued: 0, sent: 0, failed: 0, reconciliationRequired: 0 });
  const { data: deliveries, error: deliveriesError } = await admin.from('handoff_whatsapp_deliveries')
    .select('id,handoff_id,lead_id,recipient_user_id,recipient_phone').eq('organization_id', organizationId).eq('status', 'queued').order('created_at', { ascending: true }).limit(25);
  if (deliveriesError) throw new Error('handoff_notification_queue_read_failed');
  if (!(deliveries ?? []).length) return empty('idle');
  const [companyRead, whatsappRead, riskRead] = await Promise.all([
    admin.from('company_settings').select('active,sandbox_mode').eq('organization_id', organizationId).maybeSingle(),
    admin.from('integrations').select('id,connected,enabled,paused').eq('organization_id', organizationId).eq('key', 'whatsapp').maybeSingle(),
    admin.from('channel_policy_events').select('id').eq('organization_id', organizationId).eq('channel', 'whatsapp').eq('action', 'pause').is('resolved_at', null).limit(1).maybeSingle(),
  ]);
  if (companyRead.error || whatsappRead.error || riskRead.error) throw new Error('handoff_notification_runtime_read_failed');
  if (companyRead.data?.active !== true || companyRead.data?.sandbox_mode !== false) return { ...empty('real_mode_required'), queued: deliveries!.length };
  const whatsapp = whatsappRead.data;
  if (!whatsapp?.connected || !whatsapp.enabled || whatsapp.paused || riskRead.data) return { ...empty('blocked'), queued: deliveries!.length };
  const { data: credentials, error: credentialsError } = await admin.rpc('read_integration_secret', { p_integration: whatsapp.id });
  if (credentialsError) return { ...empty('integration_unavailable'), queued: deliveries!.length };
  let sent = 0; let failed = 0; let reconciliationRequired = 0;
  for (const delivery of deliveries ?? []) {
    const { data: claimed, error: claimError } = await admin.from('handoff_whatsapp_deliveries').update({ status: 'sending', attempted_at: new Date().toISOString(), updated_at: new Date().toISOString(), error: null }).eq('id', delivery.id).eq('organization_id', organizationId).eq('status', 'queued').select('id').maybeSingle();
    if (claimError) throw new Error('handoff_notification_claim_failed');
    if (!claimed) continue;
    let providerAccepted = false;
    try {
      const [{ data: lead, error: leadError }, { data: handoff, error: handoffError }] = await Promise.all([
        admin.from('leads').select('company,contact,ana_stage').eq('id', delivery.lead_id).eq('organization_id', organizationId).maybeSingle(),
        admin.from('lead_handoffs').select('reason').eq('id', delivery.handoff_id).eq('organization_id', organizationId).maybeSingle(),
      ]);
      if (leadError || handoffError || !lead || !handoff) throw new Error('handoff_notification_context_not_found');
      const subject = asText(lead.contact, 120) || asText(lead.company, 160) || 'um lead';
      const reason = asText(handoff.reason, 220) || 'A Ana solicitou atendimento humano.';
      const stage = asText(lead.ana_stage, 40) || 'atual';
      const message = `Wayflex: ${subject} foi transferido para você na etapa ${stage}. Motivo: ${reason} Abra a Central de Atendimento para assumir.`;
      const receipt = await sendWhatsapp(asObject(credentials), delivery.recipient_phone, message);
      providerAccepted = true;
      const sentAt = new Date().toISOString();
      const { error: sentError } = await admin.from('handoff_whatsapp_deliveries').update({ status: 'sent', provider_message_id: receipt.messageId, sent_at: sentAt, updated_at: sentAt, error: null }).eq('id', delivery.id).eq('organization_id', organizationId).eq('status', 'sending');
      if (sentError) throw new Error('handoff_notification_acceptance_persist_failed');
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_name: 'Sistema', actor_type: 'system', action: 'notification.handoff_provider_accepted', detail: 'Aviso interno de transferência aceito pela Z-API.', entity_table: 'handoff_whatsapp_deliveries', entity_id: delivery.id, event_data: { handoff_id: delivery.handoff_id, user_id: delivery.recipient_user_id, phone_suffix: delivery.recipient_phone.slice(-4) } });
      sent += 1;
    } catch (error) {
      const status = providerAccepted ? 'reconciliation_required' : 'failed';
      const code = providerAccepted ? 'handoff_notification_provider_accepted_reconciliation_required' : safeError(error).slice(0, 160);
      await admin.from('handoff_whatsapp_deliveries').update({ status, error: code, updated_at: new Date().toISOString() }).eq('id', delivery.id).eq('organization_id', organizationId);
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_name: 'Sistema', actor_type: 'system', action: providerAccepted ? 'notification.handoff_reconciliation_required' : 'notification.handoff_failed', detail: providerAccepted ? 'A Z-API aceitou o aviso interno, mas a persistência final requer reconciliação.' : 'O aviso interno de transferência não foi enviado.', entity_table: 'handoff_whatsapp_deliveries', entity_id: delivery.id, event_data: { handoff_id: delivery.handoff_id, user_id: delivery.recipient_user_id, phone_suffix: delivery.recipient_phone.slice(-4), reason: code } });
      if (providerAccepted) reconciliationRequired += 1; else failed += 1;
    }
  }
  return { status: sent > 0 ? 'sent' : 'idle', queued: deliveries!.length, sent, failed, reconciliationRequired };
}

async function resolveOperationAssignees(admin: Admin, organizationId: string, schedule: Record<string, unknown>) {
  const mode = ['ana', 'human', 'team'].includes(asText(schedule.initial_assignment_mode, 20))
    ? asText(schedule.initial_assignment_mode, 20)
    : 'ana';
  const configured = mode === 'team'
    ? [...new Set((Array.isArray(schedule.team_member_ids) ? schedule.team_member_ids : []).map((item) => asText(item, 80)).filter(isUuid))]
    : [asText(mode === 'human' ? schedule.initial_assignee_user_id : schedule.handoff_assignee_user_id || schedule.owner_id, 80)].filter(isUuid);
  if (!configured.length) return { mode, users: [], error: 'operation_assignee_not_configured' };
  const { data: members, error } = await admin.from('organization_members').select('user_id')
    .eq('organization_id', organizationId).eq('status', 'active').in('user_id', configured);
  if (error) throw new Error('operation_assignee_read_failed');
  const active = new Set((members ?? []).map((member) => asText(member.user_id, 80)));
  const users = configured.filter((userId) => active.has(userId));
  return { mode, users, error: users.length ? null : 'operation_assignee_unavailable' };
}

async function processAnaOperations(admin: Admin, organizationId: string, schedulerToken: string) {
  const now = new Date();
  const [{ data: company }, { data: runtime }] = await Promise.all([
    admin.from('company_settings').select('active,sandbox_mode,ana_operation_enabled,ana_operation_mode').eq('organization_id', organizationId).maybeSingle(),
    admin.from('organization_module_data').select('data').eq('organization_id', organizationId).eq('module_key', 'configuracao_runtime').maybeSingle(),
  ]);
  const digestCreated = await createCommercialDigests(admin, organizationId);
  if (company?.active !== true || company?.sandbox_mode === true || company?.ana_operation_enabled !== true || asObject(runtime?.data).killSwitchGlobal === true) return { status: 'disabled', digest_created: digestCreated };
  const mode = asText(company.ana_operation_mode, 20);
  const { data: dueSchedules, error: dueError } = await admin.from('prospecting_schedules').select('*').eq('organization_id', organizationId).eq('active', true).lte('next_run_at', now.toISOString()).limit(5);
  if (dueError) throw new Error('ana_schedule_read_failed');
  for (const schedule of dueSchedules ?? []) {
    const timeZone = validTimeZone(schedule.timezone) ?? 'America/Sao_Paulo';
    const localDate = localDayKey(localDateTime(now, timeZone));
    const status = mode === 'simulation' ? 'simulated' : mode === 'supervised' ? 'awaiting_approval' : 'queued';
    const { error: runError } = await admin.from('prospecting_schedule_runs').upsert({ organization_id: organizationId, schedule_id: schedule.id, operation_mode: mode, idempotency_key: `scheduled:${schedule.id}:${localDate}`, scheduled_local_date: localDate, status, requested_by: schedule.owner_id, next_run_at: status === 'queued' ? now.toISOString() : null, completed_at: status === 'simulated' ? now.toISOString() : null, result: status === 'simulated' ? { simulated: true, external_calls: 0, filters: schedule.filters, quantity: schedule.quantity } : {} }, { onConflict: 'organization_id,idempotency_key', ignoreDuplicates: true });
    if (runError) throw new Error('ana_schedule_run_create_failed');
    const nextRun = nextAnaScheduleAt(timeZone, schedule.run_time, schedule.weekdays, now);
    const { error: scheduleError } = await admin.from('prospecting_schedules').update({ last_run_at: now.toISOString(), next_run_at: nextRun, locked_at: null, locked_by: null, updated_at: now.toISOString() }).eq('organization_id', organizationId).eq('id', schedule.id);
    if (scheduleError) throw new Error('ana_schedule_advance_failed');
  }

  const staleLockBefore = new Date(now.getTime() - 10 * 60 * 1000).toISOString();
  const { data: run, error: runReadError } = await admin.from('prospecting_schedule_runs').select('*,prospecting_schedules(*)')
    .eq('organization_id', organizationId).in('status', ['queued','running']).lte('next_run_at', now.toISOString())
    .or(`status.eq.queued,locked_at.is.null,locked_at.lt.${staleLockBefore}`)
    .order('created_at', { ascending: true }).limit(1).maybeSingle();
  if (runReadError) throw new Error('ana_operation_queue_read_failed');
  if (!run) return { status: 'idle', digest_created: digestCreated };
  const schedule = asObject(run.prospecting_schedules);
  const executionAuthorized = run.operation_mode === 'automatic'
    ? schedule.paid_prospecting_approved === true
    : run.operation_mode === 'supervised' && isUuid(run.approved_by);
  if (!executionAuthorized) return { status: 'approval_required', digest_created: digestCreated };
  const lockId = crypto.randomUUID();
  let claim = admin.from('prospecting_schedule_runs').update({
    status: 'running', locked_at: now.toISOString(), locked_by: `automation-worker:${lockId}`,
    started_at: run.started_at || now.toISOString(),
  }).eq('organization_id', organizationId).eq('id', run.id).eq('status', run.status);
  claim = run.status === 'queued'
    ? claim
    : run.locked_at
      ? claim.lt('locked_at', staleLockBefore)
      : claim.is('locked_at', null);
  const { data: claimed, error: claimError } = await claim.select('id').maybeSingle();
  if (claimError || !claimed) return { status: 'contended', digest_created: digestCreated };
  const timeZone = validTimeZone(schedule.timezone) ?? 'America/Sao_Paulo';
  const localDate = localDayKey(localDateTime(now, timeZone));
  const monthStart = `${localDate.slice(0, 7)}-01`;
  const { data: recentRuns, error: usageError } = await admin.from('prospecting_schedule_runs').select('scheduled_local_date,imported_count').eq('organization_id', organizationId).eq('schedule_id', run.schedule_id).gte('scheduled_local_date', monthStart).in('status', ['completed','running']);
  if (usageError) throw new Error('ana_operation_usage_read_failed');
  const dailyUsed = (recentRuns ?? []).filter((item) => item.scheduled_local_date === localDate).reduce((sum, item) => sum + Number(item.imported_count || 0), 0);
  const monthlyUsed = (recentRuns ?? []).reduce((sum, item) => sum + Number(item.imported_count || 0), 0);
  const remaining = Math.min(
    boundedInteger(schedule.quantity, 20, 1, 100),
    Math.max(0, boundedInteger(schedule.daily_cap, 50, 1, 10_000) - dailyUsed),
    Math.max(0, boundedInteger(schedule.monthly_cap, 500, 1, 100_000) - monthlyUsed),
  );
  if (remaining <= 0) {
    await admin.from('prospecting_schedule_runs').update({ status: 'cancelled', error_code: 'prospecting_cap_reached', completed_at: now.toISOString(), result: { daily_used: dailyUsed, monthly_used: monthlyUsed } }).eq('id', run.id).eq('organization_id', organizationId);
    return { status: 'cap_reached', digest_created: digestCreated };
  }
  const routing = await resolveOperationAssignees(admin, organizationId, schedule);
  if (routing.error) {
    await admin.from('prospecting_schedule_runs').update({ status: 'failed', error_code: routing.error, error_message: 'A rota de atendimento configurada não possui um usuário ativo.', completed_at: now.toISOString(), locked_at: null, locked_by: null }).eq('id', run.id).eq('organization_id', organizationId);
    return { status: 'failed', error: routing.error, digest_created: digestCreated };
  }
  const baseUrl = Deno.env.get('SUPABASE_URL'), serviceJwt = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!baseUrl || !serviceJwt) throw new Error('ana_operation_internal_auth_missing');
  const response = await fetch(`${baseUrl}/functions/v1/prospectar-leads`, { method: 'POST', headers: { Authorization: `Bearer ${serviceJwt}`, 'Content-Type': 'application/json', 'x-leadai-scheduler-token': schedulerToken }, body: JSON.stringify({ sourceKey: 'apify', mode: 'production', source: 'server_scheduler', organization_id: organizationId, schedule_run_id: run.id, filters: { ...asObject(schedule.filters), volumeMaximo: remaining }, ...(run.prospecting_run_id ? { runId: run.prospecting_run_id } : {}) }), signal: AbortSignal.timeout(45_000) });
  const result = asObject(await response.json().catch(() => ({})));
  if (response.status === 202 && isUuid(result.runId)) {
    await admin.from('prospecting_schedule_runs').update({ prospecting_run_id: result.runId, next_run_at: new Date(Date.now() + 60_000).toISOString(), locked_at: null, locked_by: null, result: { pending: true } }).eq('id', run.id).eq('organization_id', organizationId);
    return { status: 'provider_pending', digest_created: digestCreated };
  }
  if (!response.ok || result.ok !== true || !Array.isArray(result.leads)) {
    const code = asText(result.error, 120) || `prospecting_http_${response.status}`;
    await admin.from('prospecting_schedule_runs').update({ status: 'failed', error_code: code, error_message: 'A busca automática não foi concluída.', completed_at: new Date().toISOString(), locked_at: null, locked_by: null }).eq('id', run.id).eq('organization_id', organizationId);
    return { status: 'failed', error: code, digest_created: digestCreated };
  }
  let imported = 0, approved = 0, rejected = 0;
  const minimum = boundedInteger(schedule.auto_approve_min_score, 70, 0, 100);
  for (const raw of result.leads.slice(0, remaining).map(asObject)) {
    const score = boundedInteger(raw.score, 0, 0, 100), whatsapp = asText(raw.whatsapp, 80), email = asText(raw.email, 300);
    if (score < minimum) { rejected += 1; continue; }
    const contactApproved = Boolean(whatsapp) && asText(asObject(raw.channel_verification).whatsapp, 40) === 'source_reported';
    const sourceRecordId = asText(raw.source_record_id, 300) || crypto.randomUUID();
    const assignedTo = routing.users[imported % routing.users.length];
    const anaOwnsLead = routing.mode === 'ana';
    const contactIsApproved = contactApproved && Boolean(assignedTo);
    const { data: inserted, error: insertError } = await admin.from('leads').upsert({ organization_id: organizationId, company: asText(raw.razao_social, 500) || asText(raw.nome_fantasia, 500) || 'Empresa prospectada', phone: asText(raw.telefone, 80) || null, whatsapp: whatsapp || null, email: email || null, segment: asText(raw.cnae_descricao, 300) || null, uf: asText(raw.uf, 2) || null, city: asText(raw.municipio, 160) || null, score, temp: score >= 80 ? 'hot' : score >= 55 ? 'warm' : 'cold', stage: 'Prospecção', origin: 'Apify · operação automática', owner_id: assignedTo, assigned_to: assignedTo, owner: anaOwnsLead ? 'ia' : 'humano', active_channel: whatsapp ? 'whatsapp' : email ? 'email' : null, modo_atendimento: anaOwnsLead ? 'ia' : 'humano', ai_paused: !anaOwnsLead, contact_approval_status: contactIsApproved ? 'approved' : 'pending', contact_approval_reason: contactIsApproved ? 'Canal informado explicitamente pela fonte e fit acima do limite configurado.' : 'Canal ou responsável requer validação humana.', contact_approved_at: contactIsApproved ? new Date().toISOString() : null, contact_approved_by: contactIsApproved ? assignedTo : null, automation_status: anaOwnsLead ? (contactIsApproved ? 'running' : 'pending_approval') : 'human', source_record_id: sourceRecordId, source_url: asText(raw.source_url, 1000) || null, source_metadata: { prospecting_run_id: result.runId, schedule_run_id: run.id, score_reason: raw.score_reason, initial_assignment_mode: routing.mode }, deduplication_key: `apify:${sourceRecordId}` }, { onConflict: 'organization_id,deduplication_key', ignoreDuplicates: true }).select('id').maybeSingle();
    if (insertError) throw new Error('ana_lead_import_failed');
    if (!inserted?.id) continue;
    imported += 1;
    if (anaOwnsLead && schedule.handoff_stage && isUuid(schedule.handoff_assignee_user_id)) {
      const { error: policyError } = await admin.from('lead_handoff_policies').upsert({
        organization_id: organizationId, lead_id: inserted.id, assignee_user_id: schedule.handoff_assignee_user_id,
        handoff_stage: schedule.handoff_stage, notify_whatsapp: schedule.handoff_notify_whatsapp === true,
        created_by: isUuid(schedule.updated_by) ? schedule.updated_by : null, updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,lead_id' });
      if (policyError) throw new Error('operation_handoff_policy_not_saved');
    }
    if (!anaOwnsLead) {
      const { error: taskError } = await admin.from('lead_tasks').insert({
        organization_id: organizationId, lead_id: inserted.id, owner_id: assignedTo, owner_label: 'Responsável',
        text: 'Assumir lead encaminhado pela operação automática.', due_at: new Date().toISOString(), completed: false,
        metadata: { schedule_run_id: run.id, initial_assignment_mode: routing.mode },
      });
      if (taskError) throw new Error('operation_human_task_not_created');
    }
    if (anaOwnsLead && contactIsApproved) {
      approved += 1;
      const internalCredential = Deno.env.get('WHATSAPP_WEBHOOK_SHARED_SECRET');
      if (internalCredential) await fetch(`${baseUrl}/functions/v1/ana-run`, { method: 'POST', headers: { Authorization: `Bearer ${serviceJwt}`, 'Content-Type': 'application/json', 'x-internal-worker-secret': internalCredential }, body: JSON.stringify({ event: 'lead.created', lead_id: inserted.id, modo: 'ia', organization_id: organizationId, request_id: `operation:${run.id}:${inserted.id}` }), signal: AbortSignal.timeout(45_000) }).catch(() => undefined);
    }
  }
  await admin.from('prospecting_schedule_runs').update({ status: 'completed', prospecting_run_id: result.runId, result_cache_id: result.cacheId, candidate_count: result.leads.length, imported_count: imported, approved_count: approved, rejected_count: rejected, completed_at: new Date().toISOString(), next_run_at: null, locked_at: null, locked_by: null, result: { source: 'apify', candidate_count: result.leads.length, imported, approved, rejected } }).eq('id', run.id).eq('organization_id', organizationId);
  return { status: 'completed', imported, approved, rejected, digest_created: digestCreated };
}

/** Drains due Evolution GO callbacks from the durable queue on the existing
 * server scheduler. A failure here is reported but never blocks commercial
 * outreach processing. */
async function processEvolutionGoCallbacks(admin: Admin, organizationId: string) {
  const { count, error } = await admin.from('evolution_go_webhook_events')
    .select('*', { count: 'exact', head: true }).eq('organization_id', organizationId)
    .in('processing_status', ['queued', 'failed']).lte('next_retry_at', new Date().toISOString());
  if (error) return { status: 'read_failed', queued: 0, processed: 0, failed: 0 };
  if (!count) return { status: 'idle', queued: 0, processed: 0, failed: 0 };
  const serviceJwt = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const baseUrl = Deno.env.get('SUPABASE_URL');
  if (!serviceJwt || !baseUrl) return { status: 'runtime_unavailable', queued: count, processed: 0, failed: 0 };
  try {
    const response = await fetch(`${baseUrl}/functions/v1/evolution-go-worker`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${serviceJwt}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ organization_id: organizationId }), signal: AbortSignal.timeout(45_000),
    });
    const result = asObject(await response.json().catch(() => null));
    if (!response.ok || result.ok !== true) return { status: 'worker_failed', queued: count, processed: 0, failed: count };
    return { status: 'processed', queued: count, processed: Number(result.processed ?? 0), failed: Number(result.failed ?? 0) };
  } catch {
    return { status: 'worker_timeout', queued: count, processed: 0, failed: 0 };
  }
}

Deno.serve(async (request) => {
  const pf = preflight(request);
  if (pf) return pf;
  if (!hasAllowedOrigin(request))
    return json({ error: "origin_not_allowed" }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== "POST")
    return json({ error: "method_not_allowed" }, 405, headers);
  let schedulerIntegrationId: string | null = null,
    schedulerOrganizationId: string | null = null,
    serverScheduler = false;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      run?: string;
      organization_id?: unknown;
      source?: unknown;
      job_id?: unknown;
    };
    const requestedJobId = body.job_id === undefined ? null : body.job_id;
    if (requestedJobId !== null && !isUuid(requestedJobId))
      throw new Error("outreach_job_id_invalid");
    const admin = createAdminClient();
    const schedulerToken = request.headers.get("x-leadai-scheduler-token");
    let orgId: string;
    let actor: { id: string; name: string } | null = null;
    if (schedulerToken) {
      if (
        !["outreach", "all"].includes(body.run || "") ||
        !isUuid(body.organization_id) ||
        body.source !== "server_scheduler" ||
        requestedJobId !== null
      )
        throw new Error("scheduler_request_invalid");
      const { data: scheduler, error } = await admin
        .from("integrations")
        .select("id,organization_id")
        .eq("organization_id", body.organization_id)
        .eq("key", "scheduler")
        .maybeSingle();
      if (error || !scheduler) throw new Error("scheduler_not_configured");
      const { data: secret, error: se } = await admin.rpc(
        "read_integration_secret",
        { p_integration: scheduler.id },
      );
      const expected = asText(asObject(secret).scheduler_token, 1000);
      if (se || expected.length < 48 || !secureEqual(schedulerToken, expected))
        throw new Error("scheduler_authentication_failed");
      orgId = scheduler.organization_id;
      schedulerIntegrationId = scheduler.id;
      schedulerOrganizationId = orgId;
      serverScheduler = true;
    } else {
      const { user } = await requireUser(request);
      const { data: profile } = await admin
        .from("profiles")
        .select("active_organization_id,name")
        .eq("id", user.id)
        .maybeSingle();
      if (!profile?.active_organization_id)
        throw new Error("organization_context_required");
      orgId = profile.active_organization_id as string;
      await requireOrganizationRole(admin, user.id, orgId, [
        "owner",
        "admin",
        "manager",
      ]);
      actor = { id: user.id, name: profile.name || "Usuário" };
    }
    const reads = await Promise.all([
      admin
        .from("company_settings")
        .select("active,sandbox_mode,can_use_ia,ai_actions_enabled,ana_operation_enabled,ana_operation_mode")
        .eq("organization_id", orgId)
        .maybeSingle(),
      admin
        .from("integrations")
        .select("enabled,connected,paused")
        .eq("organization_id", orgId)
        .eq("key", "ai")
        .maybeSingle(),
      admin
        .from("organization_module_data")
        .select("data")
        .eq("organization_id", orgId)
        .eq("module_key", "configuracao_runtime")
        .maybeSingle(),
    ]);
    if (reads.some((x) => x.error))
      throw new Error("runtime_safety_read_failed");
    if (serverScheduler && schedulerIntegrationId) {
      const { error } = await admin
        .from("integrations")
        .update({
          connected: true,
          enabled: true,
          paused: false,
          last_tested_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_error: null,
          status_detail:
            "Worker server-side em execução; heartbeat confirmado pelo agendador.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", schedulerIntegrationId)
        .eq("organization_id", orgId);
      if (error) throw new Error("scheduler_heartbeat_persist_failed");
    }
    let reconciledProviderAcceptances = 0;
    if (serverScheduler) {
      const { data: reconciled, error: reconciliationError } = await admin.rpc(
        "reconcile_provider_accepted_outreach",
        { p_organization_id: orgId, p_limit: 100 },
      );
      if (reconciliationError)
        throw new Error("provider_acceptance_reconciliation_failed");
      reconciledProviderAcceptances = Number(reconciled ?? 0);
    }
    const knowledgeMaintenance = serverScheduler
      ? await maintainKnowledgeEmbeddings(admin, orgId)
      : { processed: 0, remaining: 0, status: "manual_skip" };
    const anaOperations = serverScheduler && schedulerToken
      ? await processAnaOperations(admin, orgId, schedulerToken)
      : { status: 'manual_skip', digest_created: 0 };
    const dailyWhatsappReports = serverScheduler
      ? await processDailyWhatsappReports(admin, orgId)
      : { status: 'manual_skip', due: 0, sent: 0, failed: 0, reconciliationRequired: 0 };
    const handoffWhatsappNotifications = serverScheduler
      ? await processHandoffWhatsappNotifications(admin, orgId)
      : { status: 'manual_skip', queued: 0, sent: 0, failed: 0, reconciliationRequired: 0 };
    const evolutionGoWebhooks = serverScheduler
      ? await processEvolutionGoCallbacks(admin, orgId)
      : { status: 'manual_skip', queued: 0, processed: 0, failed: 0 };
    let waAkgQueues: Record<string, unknown> = { status: 'manual_skip' };
    const blocked =
      reads[0].data?.active !== true ? "company_not_active" : null;
    if (blocked)
      return json(
        {
          ok: true,
          skipped: true,
          reason: blocked,
          sent_jobs: 0,
          timeout_runs: 0,
          knowledge_embeddings: knowledgeMaintenance,
          reconciled_provider_acceptances: reconciledProviderAcceptances,
          daily_whatsapp_reports: dailyWhatsappReports,
        },
        200,
        headers,
      );
    if (reads[0].data?.sandbox_mode === true) {
      if (body.run !== "outreach" && body.run !== "all")
        return json(
          {
            ok: true,
            skipped: true,
            reason: "sandbox_mode",
            sent_jobs: 0,
            timeout_runs: 0,
            knowledge_embeddings: knowledgeMaintenance,
            reconciled_provider_acceptances: reconciledProviderAcceptances,
            daily_whatsapp_reports: dailyWhatsappReports,
          },
          200,
          headers,
        );
      const { data: queuedTests, error: queuedTestsError } = await admin
        .from("outreach_jobs")
        .select("payload")
        .eq("organization_id", orgId)
        .eq("status", "queued")
        .lte("run_at", new Date().toISOString())
        .limit(25);
      if (queuedTestsError) throw queuedTestsError;
      if (
        !(queuedTests ?? []).some((job) =>
          activeControlledSandboxTest(asObject(job.payload)),
        )
      )
        return json(
          {
            ok: true,
            skipped: true,
            reason: "sandbox_mode",
            sent_jobs: 0,
            timeout_runs: 0,
            knowledge_embeddings: knowledgeMaintenance,
          },
          200,
          headers,
        );
    }
    // Do not wake any external connector in sandbox or while the company is
    // inactive. WA-AKG consumes only after the same real-mode gate used by the
    // canonical outbound queue has passed.
    if (serverScheduler) waAkgQueues = await processWaAkgQueues(orgId);
    const since = new Date(Date.now() - 86400000).toISOString();
    const [
      { count: sent },
      { count: failed },
      { count: optOuts },
      { data: wa },
      { data: activePolicy },
    ] = await Promise.all([
      admin
        .from("outreach_jobs")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("channel", "whatsapp")
        .eq("status", "processed")
        .gte("processed_at", since),
      admin
        .from("outreach_jobs")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("channel", "whatsapp")
        .eq("status", "failed")
        .gte("run_at", since),
      admin
        .from("contact_suppressions")
        .select("*", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .ilike("channel", "whatsapp")
        .gte("created_at", since),
      admin
        .from("integrations")
        .select("id")
        .eq("organization_id", orgId)
        .eq("key", "whatsapp")
        .maybeSingle(),
      admin
        .from("channel_policy_events")
        .select("risk_level,action")
        .eq("organization_id", orgId)
        .eq("channel", "whatsapp")
        .is("resolved_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const sentCount = sent ?? 0,
      failedCount = failed ?? 0,
      optOutCount = optOuts ?? 0;
    const { error: healthSampleError } = await admin
      .from("channel_health_samples")
      .insert({
        organization_id: orgId,
        integration_id: wa?.id ?? null,
        channel: "whatsapp",
        source: "derived",
        sent_count: sentCount,
        delivered_count: 0,
        failed_count: failedCount,
        opt_out_count: optOutCount,
        complaint_count: 0,
        raw_metrics: { window_hours: 24, worker: "automation-worker" },
      });
    if (healthSampleError) throw new Error("channel_health_sample_persist_failed");
    const optOutRate = sentCount > 0 ? optOutCount / sentCount : 0,
      failureRate =
        sentCount + failedCount > 0
          ? failedCount / (sentCount + failedCount)
          : 0,
      shouldPause =
        sentCount + failedCount >= 20 &&
        (optOutRate >= 0.08 || failureRate >= 0.15);
    if (shouldPause) {
      if (!activePolicy)
        await admin
          .from("channel_policy_events")
          .insert({
            organization_id: orgId,
            integration_id: wa?.id ?? null,
            channel: "whatsapp",
            risk_level: "high",
            action: "pause",
            reason:
              optOutRate >= 0.08
                ? "Taxa de opt-out acima do limite operacional configurado."
                : "Taxa de falhas acima do limite operacional configurado.",
            evidence: {
              sent_count: sentCount,
              failed_count: failedCount,
              opt_out_count: optOutCount,
              failure_rate: failureRate,
              opt_out_rate: optOutRate,
            },
          });
      if (wa?.id)
        await admin
          .from("integrations")
          .update({
            paused: true,
            status_detail:
              "Envios pausados automaticamente pelo monitor de risco.",
          })
          .eq("id", wa.id)
          .eq("organization_id", orgId);
    }
    let sentJobs = 0,
      failedJobs = 0;
    const jobResults: Array<{
      id: string;
      status: "sent" | "failed" | "deferred" | "cadence_completed" | "cadence_deferred" | "cadence_cancelled";
      error?: string;
      cadence_scheduled?: number;
      cadence_error?: string;
    }> = [];
    const workerLockId = crypto.randomUUID();
    if (body.run === "outreach" || body.run === "all") {
      let jobsRequest = admin
        .from("outreach_jobs")
        .select("id,lead_id,channel,attempt,payload")
        .eq("organization_id", orgId)
        .eq("status", "queued")
        .lte("run_at", new Date().toISOString())
        .order("run_at", { ascending: true })
        .limit(25);
      if (requestedJobId) jobsRequest = jobsRequest.eq("id", requestedJobId);
      const { data: jobs, error } = await jobsRequest;
      if (error) throw error;
      for (const job of jobs ?? []) {
        const payload = asObject(job.payload);
        if (
          reads[0].data?.sandbox_mode === true &&
          !activeControlledSandboxTest(payload)
        )
          continue;
        const channel = canonicalChannel(job.channel);
        const { data: claimed, error: ce } = await admin
          .from("outreach_jobs")
          .update({
            status: "processing",
            locked_at: new Date().toISOString(),
            locked_by: serverScheduler ? `server_scheduler:${workerLockId}` : `manual:${actor?.id ?? workerLockId}`,
          })
          .eq("id", job.id)
          .eq("organization_id", orgId)
          .eq("status", "queued")
          .select("id")
          .maybeSingle();
        if (ce) throw ce;
        if (!claimed) continue;
        if (payload.kind === "ana_cadence") {
          const cadence = await processAnaCadenceJob(admin, {
            organizationId: orgId,
            job: {
              id: job.id,
              lead_id: job.lead_id,
              attempt: job.attempt,
              payload,
            },
          });
          if (cadence.status === "failed") failedJobs++;
          jobResults.push({
            id: job.id,
            status:
              cadence.status === "completed"
                ? "cadence_completed"
                : cadence.status === "deferred"
                  ? "cadence_deferred"
                  : cadence.status === "cancelled"
                    ? "cadence_cancelled"
                    : "failed",
            ...(cadence.reason ? { error: cadence.reason } : {}),
          });
          continue;
        }
        const manual = payload.manual === true;
        let persistedPayload = payload;
        let dispatchStarted = false,
          providerAccepted = false,
          providerMessageId: string | null = null;
        let waAkgSlotReserved = false;
        let waAkgSlotAccountId = '';
        let whatsappProvider = "zapi";
        try {
          if (!["whatsapp", "email"].includes(channel))
            throw new Error("channel_not_supported");
          const requestedIntegrationId = channel === "whatsapp"
            ? asText(payload.integration_id, 80)
            : "";
          if (channel === "whatsapp" && requestedIntegrationId && !isUuid(requestedIntegrationId)) {
            throw new Error("whatsapp_integration_id_invalid");
          }
          const channelIntegrationRead = requestedIntegrationId
            ? admin
              .from("integrations")
              .select("id,provider,connected,enabled,paused,configuration")
              .eq("organization_id", orgId)
              .eq("id", requestedIntegrationId)
              .maybeSingle()
            : admin
              .from("integrations")
              .select("id,provider,connected,enabled,paused,configuration")
              .eq("organization_id", orgId)
              .eq("key", channel)
              .maybeSingle();
          const initial = await Promise.all([
            admin
              .from("leads")
              .select(
                "phone,whatsapp,email,opt_out,ai_paused,owner_id,modo_atendimento,contact_approval_status,last_contact,no_reply_deadline_at",
              )
              .eq("organization_id", orgId)
              .eq("id", job.lead_id)
              .maybeSingle(),
            admin
              .from("company_settings")
              .select("active,sandbox_mode,can_use_ia,ai_actions_enabled,ui_settings")
              .eq("organization_id", orgId)
              .maybeSingle(),
            admin
              .from("integrations")
              .select("enabled,connected,paused")
              .eq("organization_id", orgId)
              .eq("key", "ai")
              .maybeSingle(),
            admin
              .from("organization_module_data")
              .select("data")
              .eq("organization_id", orgId)
              .eq("module_key", "configuracao_runtime")
              .maybeSingle(),
            channelIntegrationRead,
          ]);
          if (initial.some((x) => x.error))
            throw new Error("dispatch_safety_read_failed");
          const [
            { data: lead },
            { data: company },
            { data: ai },
            { data: runtime },
            { data: integration },
          ] = initial;
          if (channel === "whatsapp" && requestedIntegrationId) {
            const requestedAccountId = asText(payload.whatsapp_account_id, 80);
            if (!isUuid(requestedAccountId)) throw new Error("whatsapp_account_id_invalid");
            const { data: account, error: accountError } = await admin
              .from("whatsapp_accounts")
              .select("id,provider,enabled,connection_status")
              .eq("id", requestedAccountId)
              .eq("organization_id", orgId)
              .eq("integration_id", requestedIntegrationId)
              .is("archived_at", null)
              .maybeSingle();
            if (accountError || !account) throw new Error("whatsapp_account_integration_mismatch");
            if (account.enabled !== true || account.connection_status !== 'connected') throw new Error('whatsapp_account_not_ready');
            whatsappProvider = asText(account.provider, 40) || "zapi";
            if (['evolution_go', 'wa_akg'].includes(whatsappProvider)) {
              const { data: controls, error: controlsError } = await admin.from('messaging_provider_controls')
                .select('send_enabled,automation_enabled,kill_switch')
                .eq('organization_id', orgId).eq('provider', whatsappProvider).maybeSingle();
              if (controlsError) throw new Error(`${whatsappProvider}_control_read_failed`);
              if (!controls || controls.send_enabled !== true || controls.kill_switch === true) {
                throw new Error(`${whatsappProvider}_send_not_ready`);
              }
              if (!manual && controls.automation_enabled !== true) throw new Error(`${whatsappProvider}_automation_not_ready`);
            }
          }
          const controlledSandboxTest =
            manual &&
            company?.sandbox_mode === true &&
            activeControlledSandboxTest(payload);
          const meetingHandoffAcknowledgement =
            payload.handoff_acknowledgement === "meeting_confirmation";
          const { data: suppressions, error: se } = await admin
            .from("contact_suppressions")
            .select("id,channel")
            .eq("organization_id", orgId)
            .or(
              suppressionOrFilter(
                job.lead_id,
                await suppressionHashes(lead ?? {}),
              ),
            )
            .limit(10);
          if (se) throw new Error("dispatch_suppression_read_failed");
          const block = manual
            ? company?.active !== true
              ? "company_not_active"
              : company?.sandbox_mode !== false && !controlledSandboxTest
                ? "operational_mode_protected"
                : null
            : automationBlockReason({
                company,
                ai,
                runtime: runtime?.data ?? null,
                lead,
                requiresApprovedContact: true,
              });
          // Ana may acknowledge a meeting request while a human handoff is
          // open. The queue marker is only written by ana-run after the
          // narrow meeting-safety policy has passed; every other safety block
          // remains mandatory.
          if (
            block &&
            !(
              !manual &&
              meetingHandoffAcknowledgement &&
              block === "human_mode"
            )
          )
            throw new Error(block);
          if (
            suppressions?.some((s) =>
              ["all", channel].includes(canonicalChannel(s.channel)),
            )
          )
            throw new Error("contact_suppressed");
          let anaPolicy: AnaPolicy | null = null;
          let noReplyDeadlineAt: string | null = null;
          let isCadenceOutbound = false;
          let cadenceDeadlineAt: string | null = null;
          if (!manual) {
            anaPolicy = await readPublishedAnaPolicy(admin, orgId);
            if (!anaPolicy) throw new Error("ana_configuration_missing");
            if (!anaPolicy.allowedChannels.includes(channel))
              throw new Error("channel_not_allowed_by_ana_configuration");
            const queuedConfigurationVersionId = asText(
              payload.configuration_version_id,
              80,
            );
            const queuedCadence = asObject(payload.cadence);
            isCadenceOutbound = Object.keys(queuedCadence).length > 0;
            cadenceDeadlineAt = validFutureInstant(
              queuedCadence.no_reply_deadline_at,
              new Date(),
            );
            if (isCadenceOutbound) {
              const queuedStep = asText(queuedCadence.step, 20);
              const queuedVersionId = asText(
                queuedCadence.configuration_version_id,
                80,
              );
              const expectedLastContact = asText(
                queuedCadence.expected_last_contact,
                64,
              );
              if (
                !["first", "second"].includes(queuedStep) ||
                !isUuid(queuedVersionId) ||
                queuedVersionId !== anaPolicy.configurationVersionId
              )
                throw new Error("ana_configuration_changed_before_cadence");
              if (
                !cadenceDeadlineAt ||
                !sameInstant(payload.no_reply_deadline_at, cadenceDeadlineAt) ||
                !sameInstant(lead?.last_contact, expectedLastContact) ||
                !sameInstant(lead?.no_reply_deadline_at, cadenceDeadlineAt)
              )
                throw new Error("cadence_context_stale");
            } else if (
              !isUuid(queuedConfigurationVersionId) ||
              queuedConfigurationVersionId !== anaPolicy.configurationVersionId
            ) {
              throw new Error("ana_configuration_changed_before_dispatch");
            }
            const runtimeConfiguration = asObject(runtime?.data);
            const timeZone = resolveTimeZone(
              runtimeConfiguration,
              asObject(company),
            );
            const now = new Date();
            const businessHours = businessHoursDecision(
              runtimeConfiguration,
              timeZone,
              now,
            );
            if (anaPolicy.businessHoursOnly && !businessHours.allowed) {
              if (!businessHours.nextRunAt)
                throw new Error(businessHours.reason);
              await deferJob(
                admin,
                orgId,
                job.id,
                businessHours.reason,
                businessHours.nextRunAt,
              );
              jobResults.push({
                id: job.id,
                status: "deferred",
                error: businessHours.reason,
              });
              continue;
            }
            const localDay = anaPolicy.businessHoursOnly
              ? businessHours.localDay
              : localDayKey(localDateTime(now, timeZone));
            const { data: reservation, error: reservationError } = await admin.rpc(
              "reserve_ana_outbound_policy",
              {
                p_organization_id: orgId,
                p_job_id: job.id,
                p_lead_id: job.lead_id,
                p_channel: channel,
                p_daily_limit: anaPolicy.dailyMessageLimit,
                p_time_zone: timeZone,
                p_local_day: localDay,
                p_configuration_version_id: anaPolicy.configurationVersionId,
              },
            );
            if (reservationError)
              throw new Error("ana_policy_reservation_failed");
            const policyReservation = Array.isArray(reservation)
              ? reservation[0]
              : reservation;
            if (asObject(policyReservation).allowed !== true) {
              const reason =
                asText(asObject(policyReservation).reason, 120) ||
                "ana_policy_reservation_rejected";
              if (reason === "ana_daily_message_limit_reached") {
                let runAt = nextLocalDayStart(timeZone, now);
                if (anaPolicy.businessHoursOnly) {
                  const nextBusiness = businessHoursDecision(
                    runtimeConfiguration,
                    timeZone,
                    runAt,
                  );
                  if (!nextBusiness.allowed && !nextBusiness.nextRunAt)
                    throw new Error(nextBusiness.reason);
                  if (nextBusiness.nextRunAt)
                    runAt = new Date(nextBusiness.nextRunAt);
                }
                await deferJob(admin, orgId, job.id, reason, runAt.toISOString());
                jobResults.push({
                  id: job.id,
                  status: "deferred",
                  error: reason,
                });
                continue;
              }
              throw new Error(reason);
            }
            persistedPayload = {
              ...payload,
              ana_policy_day: localDay,
              ana_policy_version_id: anaPolicy.configurationVersionId,
            };
            noReplyDeadlineAt = isCadenceOutbound
              ? cadenceDeadlineAt
              : validFutureInstant(payload.no_reply_deadline_at, now) ??
                new Date(
                  now.getTime() + anaPolicy.timeoutHours * 60 * 60 * 1000,
                ).toISOString();
          }
          const { data: credentials, error: credsError } = integration?.id
            ? await admin.rpc("read_integration_secret", {
                p_integration: integration.id,
              })
            : { data: null, error: null };
          if (credsError) throw new Error("channel_credentials_unavailable");
          const recipient =
              channel === "whatsapp"
                ? String(lead?.whatsapp || lead?.phone || "").replace(/\D/g, "")
                : String(lead?.email || "")
                    .trim()
                    .toLowerCase(),
            message = asText(payload.message ?? payload.text, 4096);
          if (
            !integration?.connected ||
            !integration.enabled ||
            integration.paused ||
            !credentials
          )
            throw new Error("channel_not_ready");
          if (
            !lead ||
            !message ||
            typeof payload.message_id !== "string" ||
            (!manual && typeof payload.agent_run_id !== "string")
          )
            throw new Error("lead_or_payload_blocked");
          if (channel === "whatsapp" && !/^\d{10,15}$/.test(recipient))
            throw new Error("recipient_invalid");
          if (channel === "email" && !validEmail(recipient))
            throw new Error("recipient_invalid");
          if (payload.recipient) {
            const expected =
              channel === "whatsapp"
                ? String(payload.recipient).replace(/\D/g, "")
                : String(payload.recipient).trim().toLowerCase();
            if (expected !== recipient) throw new Error("recipient_mismatch");
          }
          if (
            !Object.hasOwn(payload, "context_last_contact") ||
            (lead.last_contact ? Date.parse(lead.last_contact) : null) !==
              (typeof payload.context_last_contact === "string"
                ? Date.parse(payload.context_last_contact)
                : null)
          )
            throw new Error("outbound_context_stale");
          if (!manual) {
            const { data: run, error: re } = await admin
              .from("agent_runs")
              .select("id,status,result")
              .eq("id", payload.agent_run_id)
              .eq("organization_id", orgId)
              .eq("lead_id", job.lead_id)
              .maybeSingle();
            const queuedByAna = run?.result?.status_canal === "enfileirado" ||
              (meetingHandoffAcknowledgement &&
                Array.isArray(run?.result?.acoes) &&
                run.result.acoes.some((action: unknown) => {
                  const item = asObject(action);
                  return item.tipo === "enviar_mensagem" && item.status === "enfileirado";
                }));
            if (
              re ||
              run?.status !== "completed" ||
              !queuedByAna
            )
              throw new Error("outbound_decision_not_completed");
          }
          const { data: draft, error: de } = await admin
            .from("lead_messages")
            .select("id,text,type")
            .eq("id", payload.message_id)
            .eq("organization_id", orgId)
            .eq("lead_id", job.lead_id)
            .eq("sender", manual ? "human" : "ana")
            .maybeSingle();
          if (
            de ||
            !draft ||
            draft.type !== (manual ? "queued" : "draft") ||
            draft.text !== message
          )
            throw new Error("outbound_message_mismatch");
          const catalogImageMedia = await resolveCatalogImageMedia(admin, {
            organizationId: orgId,
            leadId: job.lead_id,
            messageId: draft.id,
            channel,
            payload,
            manual,
            anaPolicy,
          });
          const provider = channel === "whatsapp" ? whatsappProvider : "resend";
          const { error: pe } = await admin
            .from("lead_outreach")
            .upsert(
              {
                id: job.id,
                organization_id: orgId,
                lead_id: job.lead_id,
                owner_id: lead.owner_id,
                channel,
                whatsapp_account_id: channel === "whatsapp"
                  ? asText(payload.whatsapp_account_id, 80) || null
                  : null,
                status: "pending",
                provider,
                content: message,
                metadata: {
                  job_id: job.id,
                  message_id: draft.id,
                  subject:
                    channel === "email" ? asText(payload.subject, 300) : null,
                  controlled_test: controlledSandboxTest,
                  catalog_media: catalogImageMedia
                    ? {
                      type: "image",
                      catalog_item_id: catalogImageMedia.catalogItemId,
                      item_name: catalogImageMedia.itemName,
                    }
                    : null,
                },
              },
              { onConflict: "id", ignoreDuplicates: true },
            );
          if (pe) throw pe;
          if (!manual) {
            const finalBlock = await automaticDispatchBlock(admin, {
              organizationId: orgId,
              leadId: job.lead_id,
              channel,
              expectedLastContact: payload.context_last_contact,
              ...(isCadenceOutbound
                ? { expectedNoReplyDeadline: cadenceDeadlineAt }
                : {}),
              expectedConfigurationVersionId: asText(
                payload.configuration_version_id,
                80,
              ),
              expectedIntegrationId: requestedIntegrationId || undefined,
              expectedWhatsappAccountId: asText(payload.whatsapp_account_id, 80) || undefined,
              allowMeetingHandoffAcknowledgement: meetingHandoffAcknowledgement,
            });
            if (finalBlock) {
              await admin
                .from("lead_outreach")
                .update({
                  status: "failed",
                  error: finalBlock,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", job.id)
                .eq("organization_id", orgId)
                .eq("status", "pending");
              throw new Error(finalBlock);
            }
          }
          if (!manual && meetingHandoffAcknowledgement) {
            // This narrowly approved acknowledgement can be retried after a
            // pre-dispatch handoff block. Clear only that stale local failure
            // before the provider is called; never overwrite a provider ID.
            const { error: retryStateError } = await admin
              .from("lead_outreach")
              .update({ status: "pending", error: null, updated_at: new Date().toISOString() })
              .eq("id", job.id)
              .eq("organization_id", orgId)
              .eq("status", "failed")
              .in("error", ["human_mode", "outbound_decision_not_completed"])
              .is("provider_message_id", null);
            if (retryStateError) throw new Error("handoff_acknowledgement_retry_state_failed");
          }

          let waAkgCredentials: Record<string, unknown> | null = null;
          if (channel === 'whatsapp' && whatsappProvider === 'wa_akg') {
            waAkgSlotAccountId = asText(payload.whatsapp_account_id, 80);
            if (!isUuid(waAkgSlotAccountId)) throw new Error('whatsapp_account_id_invalid');
            const { data: slotData, error: slotError } = await admin.rpc('reserve_whatsapp_send_slot', {
              p_organization_id: orgId,
              p_whatsapp_account_id: waAkgSlotAccountId,
              p_idempotency_key: job.id,
            });
            if (slotError) throw new Error('wa_akg_send_slot_reservation_failed');
            const slot = asObject(Array.isArray(slotData) ? slotData[0] : slotData);
            if (slot.allowed !== true) throw new Error(asText(slot.reason, 120) || 'wa_akg_send_slot_rejected');
            waAkgSlotReserved = true;
            const notBefore = Date.parse(asText(slot.not_before, 80));
            if (!Number.isFinite(notBefore)) throw new Error('wa_akg_send_slot_invalid');
            if (notBefore > Date.now() + 500) {
              await deferJob(admin, orgId, job.id, 'wa_akg_pacing_wait', new Date(notBefore).toISOString());
              jobResults.push({ id: job.id, status: 'deferred', error: 'wa_akg_pacing_wait' });
              continue;
            }
            waAkgCredentials = {
              ...asObject(await loadWaAkgGatewaySecret(admin, orgId)),
              ...asObject(credentials),
            };
          }
          dispatchStarted = true;
          const receipt =
            channel === "whatsapp"
              ? whatsappProvider === "evolution_go"
                ? await sendEvolutionGoWhatsapp(
                  asObject(credentials),
                  recipient,
                  message,
                  job.id,
                  catalogImageMedia
                    ? { kind: "image", url: catalogImageMedia.imageUrl }
                    : requestedEvolutionMedia(payload) ?? undefined,
                )
                : whatsappProvider === "wa_akg"
                  ? await sendWaAkgWhatsapp(
                    waAkgCredentials ?? {}, recipient, message, job.id,
                    catalogImageMedia
                      ? { kind: "image", url: catalogImageMedia.imageUrl }
                      : requestedEvolutionMedia(payload) ?? undefined,
                  )
                : catalogImageMedia
                  ? await sendWhatsappImage(
                    asObject(credentials),
                    recipient,
                    catalogImageMedia.imageUrl,
                    message,
                  )
                  : await sendWhatsapp(asObject(credentials), recipient, message)
              : await sendEmail(
                  asObject(credentials),
                  asObject(integration.configuration),
                  recipient,
                  message,
                  asText(payload.subject, 300),
                );
          providerAccepted = true;
          providerMessageId = receipt.messageId;
          if (waAkgSlotReserved) {
            const { error: slotCompleteError } = await admin.rpc('complete_whatsapp_send_slot', {
              p_organization_id: orgId, p_whatsapp_account_id: waAkgSlotAccountId,
              p_idempotency_key: job.id, p_provider_message_id: receipt.messageId, p_succeeded: true,
            });
            if (slotCompleteError) throw new Error('wa_akg_send_slot_complete_failed');
          }
          const sentAt = new Date().toISOString();
          const { error: acceptanceError } = await admin.rpc(
            "record_outreach_provider_acceptance",
            {
              p_organization_id: orgId,
              p_job_id: job.id,
              p_lead_id: job.lead_id,
              p_message_id: draft.id,
              p_provider: provider,
              p_provider_message_id: receipt.messageId,
              p_sent_at: sentAt,
              p_no_reply_deadline_at: noReplyDeadlineAt,
            },
          );
          if (acceptanceError) throw acceptanceError;
          if (channel === "whatsapp" && receipt.messageId) {
            try {
              const earlyReceipts = await reconcileEarlyWhatsappReceipts(admin, orgId, receipt.messageId);
              if (earlyReceipts.matched > 0) {
                await admin.from("audit_logs").insert({
                  organization_id: orgId,
                  actor_name: "Sistema",
                  actor_type: "system",
                  action: "whatsapp.early_receipt_reconciled",
                  detail: "Recibo antecipado do WhatsApp reconciliado após a confirmação do provedor.",
                  entity_table: "outreach_jobs",
                  entity_id: job.id,
                  event_data: earlyReceipts,
                });
              }
            } catch (earlyReceiptError) {
              await admin.from("audit_logs").insert({
                organization_id: orgId,
                actor_name: "Sistema",
                actor_type: "system",
                action: "whatsapp.early_receipt_reconciliation_failed",
                detail: "A confirmação do envio foi preservada, mas um recibo antecipado exige nova reconciliação.",
                entity_table: "outreach_jobs",
                entity_id: job.id,
                event_data: { reason: safeError(earlyReceiptError).slice(0, 160) },
              });
            }
          }
          let cadence: { scheduled: number; error: string | null } = {
            scheduled: 0,
            error: null,
          };
          const previousCadence = asObject(payload.cadence);
          const previousCadenceStep = asText(previousCadence.step, 20);
          if (
            !manual &&
            anaPolicy &&
            (!previousCadenceStep || previousCadenceStep === "first")
          ) {
            try {
              cadence = await scheduleAnaCadence(admin, {
                organizationId: orgId,
                leadId: job.lead_id,
                sourceJobId: asText(previousCadence.source_job_id, 80) || job.id,
                sourceMessageId: draft.id,
                channel,
                sentAt,
                initialSentAt:
                  asText(previousCadence.initial_sent_at, 64) || sentAt,
                previousCadenceStep: previousCadenceStep || null,
                noReplyDeadlineAt: noReplyDeadlineAt!,
                policy: anaPolicy,
                integrationId: requestedIntegrationId || undefined,
                whatsappAccountId: asText(payload.whatsapp_account_id, 80) || undefined,
              });
            } catch {
              cadence = { scheduled: 0, error: "cadence_schedule_persist_failed" };
            }
          }
          if (cadence.error) {
            await admin.from("audit_logs").insert({
              organization_id: orgId,
              actor_name: "Ana",
              actor_type: "system",
              action: "ana.cadence_schedule_failed",
              detail: "A mensagem foi aceita pelo provedor, mas a cadência não foi agendada.",
              entity_table: "outreach_jobs",
              entity_id: job.id,
              event_data: { reason: cadence.error },
            });
          }
          sentJobs++;
          jobResults.push({
            id: job.id,
            status: "sent",
            cadence_scheduled: cadence.scheduled,
            ...(cadence.error ? { cadence_error: cadence.error } : {}),
          });
        } catch (error) {
          if (waAkgSlotReserved && !providerAccepted) {
            await admin.rpc('complete_whatsapp_send_slot', {
              p_organization_id: orgId, p_whatsapp_account_id: waAkgSlotAccountId,
              p_idempotency_key: job.id, p_provider_message_id: '', p_succeeded: false,
            });
          }
          const attempt = Number(job.attempt ?? 0) + 1,
            code = providerAccepted
              ? "provider_accepted_reconciliation_required"
              : dispatchStarted
                ? "delivery_unknown_reconciliation_required"
                : safeError(error),
            status = dispatchStarted ? "reconciliation_required" : "failed";
          if (providerMessageId) {
            await admin
              .from("lead_outreach")
              .update({ provider_message_id: providerMessageId, updated_at: new Date().toISOString() })
              .eq("id", job.id)
              .eq("organization_id", orgId)
              .is("provider_message_id", null);
          }
          const { error: fe } = await admin
            .from("outreach_jobs")
            .update({
              status,
              attempt,
              locked_at: null,
              locked_by: null,
              error: code,
              payload: {
                ...persistedPayload,
                ...(providerMessageId
                  ? { provider_message_id: providerMessageId }
                  : {}),
              },
            })
            .eq("id", job.id)
            .eq("organization_id", orgId)
            .eq("status", "processing");
          if (fe) throw new Error("job_failure_persist_failed");
          if (manual && typeof payload.message_id === "string")
            await admin
              .from("lead_messages")
              .update({ type: status })
              .eq("id", payload.message_id)
              .eq("organization_id", orgId)
              .eq("lead_id", job.lead_id)
              .eq("sender", "human")
              .eq("type", "queued");
          failedJobs++;
          jobResults.push({ id: job.id, status: "failed", error: code });
        }
      }
    }
    if (!serverScheduler && actor)
      await admin
        .from("audit_logs")
        .insert({
          organization_id: orgId,
          actor_id: actor.id,
          actor_name: actor.name,
          actor_type: "user",
          action: "automation.worker_ran",
          detail:
            "Telemetria, políticas de canal, fila e manutenção semântica avaliadas.",
          entity_table: "channel_health_samples",
          event_data: {
            sent_count: sentCount,
            opt_out_count: optOutCount,
            pause_recommended: shouldPause,
            knowledge_embeddings: knowledgeMaintenance,
          },
        });
    return json(
      {
        ok: true,
        sent_count: sentCount,
        failed_count: failedCount,
        opt_out_count: optOutCount,
        pause_recommended: shouldPause,
        timeout_runs: 0,
        sent_jobs: sentJobs,
        failed_jobs: failedJobs,
        job_results: jobResults,
        knowledge_embeddings: knowledgeMaintenance,
        reconciled_provider_acceptances: reconciledProviderAcceptances,
        ana_operations: anaOperations,
        daily_whatsapp_reports: dailyWhatsappReports,
        handoff_whatsapp_notifications: handoffWhatsappNotifications,
        evolution_go_webhooks: evolutionGoWebhooks,
        wa_akg_queues: waAkgQueues,
      },
      200,
      headers,
    );
  } catch (error) {
    if (serverScheduler && schedulerIntegrationId && schedulerOrganizationId) {
      const admin = createAdminClient();
      await admin
        .from("integrations")
        .update({
          connected: false,
          last_error: safeError(error).slice(0, 120),
          status_detail:
            "Worker server-side encontrou uma falha; consulte o Registro do Sistema.",
          updated_at: new Date().toISOString(),
        })
        .eq("id", schedulerIntegrationId)
        .eq("organization_id", schedulerOrganizationId);
    }
    return json({ error: safeError(error) }, 400, headers);
  }
});
