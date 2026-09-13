import { createAdminClient, requireOrganizationRole, requireUser } from '../_shared/auth.ts';
import { allowedCorsHeaders, hasAllowedOrigin, json, preflight, safeError } from '../_shared/http.ts';

type OperationMode = 'simulation' | 'supervised' | 'automatic';
const ACTIONS = new Set(['get', 'save', 'run_now', 'approve_run']);
const asObject = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
const asText = (value: unknown, max = 1_000) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const bounded = (value: unknown, fallback: number, min: number, max: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};
const list = (value: unknown, max = 30) => Array.isArray(value)
  ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))].slice(0, max)
  : [];
const isUuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function validTimezone(value: unknown): string {
  const timezone = asText(value, 80) || 'America/Sao_Paulo';
  try { new Intl.DateTimeFormat('pt-BR', { timeZone: timezone }).format(); return timezone; } catch { throw new Error('timezone_invalid'); }
}

function validClock(value: unknown): string {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/.exec(asText(value, 8));
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error('run_time_invalid');
  return `${match[1]}:${match[2]}`;
}

function weekdays(value: unknown): number[] {
  const result = Array.isArray(value) ? [...new Set(value.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))] : [];
  if (!result.length) throw new Error('weekdays_required');
  return result.sort();
}

function localParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return { year: Number(get('year')), month: Number(get('month')), day: Number(get('day')), hour: Number(get('hour')), minute: Number(get('minute')), weekday: get('weekday') };
}

const dayNumber: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function zonedInstant(year: number, month: number, day: number, hour: number, minute: number, timezone: string): Date {
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let instant = target;
  for (let index = 0; index < 3; index += 1) {
    const local = localParts(new Date(instant), timezone);
    const represented = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute);
    instant += target - represented;
  }
  return new Date(instant);
}

function nextRunAt(timezone: string, clock: string, allowedDays: number[], from = new Date()): string {
  const [hour, minute] = clock.split(':').map(Number);
  const local = localParts(from, timezone);
  for (let offset = 0; offset < 8; offset += 1) {
    const date = new Date(Date.UTC(local.year, local.month - 1, local.day + offset));
    const candidateDay = date.getUTCDay();
    if (!allowedDays.includes(candidateDay)) continue;
    const candidate = zonedInstant(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate(), hour, minute, timezone);
    if (candidate.getTime() > from.getTime() + 30_000) return candidate.toISOString();
  }
  throw new Error('next_run_not_found');
}

function normalizeSettings(value: unknown) {
  const input = asObject(value);
  const mode = asText(input.mode, 20) as OperationMode;
  if (!['simulation', 'supervised', 'automatic'].includes(mode)) throw new Error('operation_mode_invalid');
  const timezone = validTimezone(input.timezone);
  const runTime = validClock(input.runTime);
  const scheduledDays = weekdays(input.weekdays);
  const digestTime = validClock(input.digestTime);
  const quantity = bounded(input.dailyLeadLimit, 20, 1, 100);
  const dailyCap = bounded(input.dailyCap, quantity, quantity, 500);
  const monthlyCap = bounded(input.monthlyCap, Math.max(dailyCap, 500), dailyCap, 10_000);
  return {
    mode,
    enabled: input.enabled === true,
    schedule: {
      name: asText(input.name, 160) || 'Operação diária da Ana', source_key: 'apify', timezone,
      weekdays: scheduledDays, run_time: runTime, next_run_at: nextRunAt(timezone, runTime, scheduledDays),
      quantity, daily_cap: dailyCap, monthly_cap: monthlyCap,
      auto_approve_min_score: bounded(input.minimumFitScore, 70, 0, 100),
      assignment_strategy: ['owner', 'round_robin', 'existing_owner'].includes(asText(input.assignmentStrategy, 30)) ? asText(input.assignmentStrategy, 30) : 'owner',
      paid_prospecting_approved: input.paidProspectingApproved === true,
      notify_immediate: input.notifyImmediate !== false,
      notify_progress: input.notifyProgress !== false,
      digest_enabled: input.digestEnabled !== false,
      digest_time: digestTime,
      filters: {
        pais: 'Brasil', estados: list(input.regions, 27), segmentos: list(input.segments),
        atividades: list(input.keywords), exigeSite: input.requireWebsite === true,
        exigeWhatsApp: input.requireWhatsapp === true, exigeEmail: input.requireEmail === true,
        volumeMaximo: quantity,
      },
    },
  };
}

async function readiness(admin: ReturnType<typeof createAdminClient>, organizationId: string) {
  const [{ data: company }, { data: integrations }, { data: runtime }, { data: agent }] = await Promise.all([
    admin.from('company_settings').select('active,sandbox_mode,can_use_ia,ai_actions_enabled').eq('organization_id', organizationId).maybeSingle(),
    admin.from('integrations').select('key,connected,enabled,paused').eq('organization_id', organizationId).in('key', ['ai','apify','scheduler','whatsapp','whatsapp_webhook']),
    admin.from('organization_module_data').select('data').eq('organization_id', organizationId).eq('module_key', 'configuracao_runtime').maybeSingle(),
    admin.from('ai_agents').select('active_version_id').eq('organization_id', organizationId).eq('key', 'ana').maybeSingle(),
  ]);
  const available = new Map((integrations ?? []).map((item) => [item.key, item.connected === true && item.enabled === true && item.paused === false]));
  const checks = {
    company: company?.active === true,
    realEnvironment: company?.sandbox_mode === false,
    anaConfiguration: Boolean(agent?.active_version_id),
    ai: company?.can_use_ia === true && company?.ai_actions_enabled === true && available.get('ai') === true,
    apify: available.get('apify') === true,
    scheduler: available.get('scheduler') === true,
    whatsappOutbound: available.get('whatsapp') === true,
    whatsappInbound: available.get('whatsapp_webhook') === true,
    killSwitchOff: asObject(runtime?.data).killSwitchGlobal === false,
  };
  return { checks, automaticReady: Object.values(checks).every(Boolean) };
}

Deno.serve(async (request) => {
  const options = preflight(request); if (options) return options;
  if (!hasAllowedOrigin(request)) return json({ ok: false, error: 'origin_not_allowed' }, 403);
  const headers = allowedCorsHeaders(request);
  if (request.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405, headers);
  try {
    const body = asObject(await request.json());
    const action = asText(body.action, 40);
    if (!ACTIONS.has(action)) throw new Error('unsupported_action');
    const { user } = await requireUser(request);
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin.from('profiles').select('active_organization_id,name').eq('id', user.id).maybeSingle();
    if (profileError || !profile?.active_organization_id) throw new Error('organization_context_required');
    const organizationId = profile.active_organization_id as string;
    await requireOrganizationRole(admin, user.id, organizationId, ['owner','admin','manager','seller','sdr']);

    if (action === 'get') {
      const [{ data: company }, { data: schedule }, { data: runs }, { data: preference }, operationReadiness] = await Promise.all([
        admin.from('company_settings').select('ana_operation_enabled,ana_operation_mode').eq('organization_id', organizationId).maybeSingle(),
        admin.from('prospecting_schedules').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        admin.from('prospecting_schedule_runs').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(10),
        admin.from('notification_preferences').select('*').eq('organization_id', organizationId).eq('user_id', user.id).maybeSingle(),
        readiness(admin, organizationId),
      ]);
      return json({ ok: true, company, schedule, runs: runs ?? [], preference, readiness: operationReadiness }, 200, headers);
    }

    await requireOrganizationRole(admin, user.id, organizationId, ['owner','admin','manager']);
    if (action === 'save') {
      const normalized = normalizeSettings(body.settings);
      const operationReadiness = await readiness(admin, organizationId);
      if (normalized.enabled && normalized.mode === 'automatic' && (!normalized.schedule.paid_prospecting_approved || !operationReadiness.automaticReady)) {
        throw new Error(!normalized.schedule.paid_prospecting_approved ? 'paid_prospecting_approval_required' : 'automatic_mode_not_ready');
      }
      const { data: existing } = await admin.from('prospecting_schedules').select('id').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const schedulePayload = { organization_id: organizationId, owner_id: user.id, active: normalized.enabled, updated_by: user.id, updated_at: new Date().toISOString(), ...normalized.schedule };
      const write = existing?.id
        ? await admin.from('prospecting_schedules').update(schedulePayload).eq('id', existing.id).eq('organization_id', organizationId).select('*').single()
        : await admin.from('prospecting_schedules').insert(schedulePayload).select('*').single();
      if (write.error || !write.data) throw write.error ?? new Error('schedule_not_saved');
      const { error: companyError } = await admin.from('company_settings').update({ ana_operation_enabled: normalized.enabled, ana_operation_mode: normalized.mode, updated_at: new Date().toISOString() }).eq('organization_id', organizationId);
      if (companyError) throw companyError;
      await admin.from('notification_preferences').upsert({
        organization_id: organizationId, user_id: user.id, immediate_in_app: normalized.schedule.notify_immediate,
        digest_enabled: normalized.schedule.digest_enabled, digest_time: normalized.schedule.digest_time,
        timezone: normalized.schedule.timezone, updated_by: user.id, updated_at: new Date().toISOString(),
      }, { onConflict: 'organization_id,user_id' });
      await admin.from('audit_logs').insert({ organization_id: organizationId, actor_id: user.id, actor_name: profile.name, actor_type: 'user', action: 'ana.operation_configuration_saved', detail: 'Configuração da operação automática da Ana atualizada.', entity_table: 'prospecting_schedules', entity_id: write.data.id, event_data: { mode: normalized.mode, enabled: normalized.enabled } });
      return json({ ok: true, schedule: write.data, mode: normalized.mode, enabled: normalized.enabled, readiness: operationReadiness }, 200, headers);
    }

    const { data: company, error: companyError } = await admin.from('company_settings').select('ana_operation_enabled,ana_operation_mode').eq('organization_id', organizationId).maybeSingle();
    if (companyError || !company) throw new Error('operation_configuration_missing');
    const { data: schedule, error: scheduleError } = await admin.from('prospecting_schedules').select('*').eq('organization_id', organizationId).order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (scheduleError || !schedule) throw new Error('operation_schedule_missing');

    if (action === 'run_now') {
      const mode = company.ana_operation_mode as OperationMode;
      const operationReadiness = await readiness(admin, organizationId);
      if (mode === 'automatic' && (!schedule.paid_prospecting_approved || !operationReadiness.automaticReady)) throw new Error('automatic_mode_not_ready');
      const now = new Date();
      const local = localParts(now, schedule.timezone);
      const localDate = `${local.year}-${String(local.month).padStart(2,'0')}-${String(local.day).padStart(2,'0')}`;
      const idempotency = `manual:${schedule.id}:${mode}:${crypto.randomUUID()}`;
      const status = mode === 'simulation' ? 'simulated' : mode === 'supervised' ? 'awaiting_approval' : 'queued';
      const { data: run, error: runError } = await admin.from('prospecting_schedule_runs').insert({
        organization_id: organizationId, schedule_id: schedule.id, operation_mode: mode, idempotency_key: idempotency,
        scheduled_local_date: localDate, status, requested_by: user.id, next_run_at: status === 'queued' ? now.toISOString() : null,
        completed_at: status === 'simulated' ? now.toISOString() : null,
        result: status === 'simulated' ? { simulated: true, source: 'apify', filters: schedule.filters, quantity: schedule.quantity, external_calls: 0 } : {},
      }).select('*').single();
      if (runError || !run) throw runError ?? new Error('operation_run_not_created');
      return json({ ok: true, run }, 200, headers);
    }

    const runId = body.runId;
    if (!isUuid(runId)) throw new Error('run_id_invalid');
    const { data: run, error: runError } = await admin.from('prospecting_schedule_runs').update({
      status: 'queued', approved_by: user.id, approved_at: new Date().toISOString(), next_run_at: new Date().toISOString(), error_code: null,
    }).eq('id', runId).eq('organization_id', organizationId).eq('status', 'awaiting_approval').select('*').maybeSingle();
    if (runError || !run) throw new Error('operation_run_not_awaiting_approval');
    return json({ ok: true, run }, 200, headers);
  } catch (error) {
    return json({ ok: false, error: safeError(error) }, 400, headers);
  }
});
