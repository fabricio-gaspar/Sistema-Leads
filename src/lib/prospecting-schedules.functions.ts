import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'




const filtersSchema = z.object({
  source: z.enum(['cnpj_ws', 'google_places', 'ai_only', 'apify']).default('google_places'),
  keyword: z.string().nullable().optional(),
  cnae: z.string().nullable().optional(),
  uf: z.string().length(2).nullable().optional(),
  municipio: z.string().nullable().optional(),
  porte: z.string().nullable().optional(),
  min_capital: z.number().nullable().optional(),
  radius_km: z.number().min(1).max(50).nullable().optional(),
})

const upsertSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2).max(120),
  description: z.string().max(500).nullable().optional(),
  filters: filtersSchema,
  quantity: z.number().int().min(1).max(100),
  days_of_week: z.array(z.number().int().min(0).max(6)).min(1).max(7),
  time_of_day: z.string().regex(/^\d{2}:\d{2}$/),
  timezone: z.string().default('America/Sao_Paulo'),
  auto_approve_min_score: z.number().int().min(0).max(100),
  sequence_id: z.string().uuid().nullable().optional(),
  assignment_strategy: z.enum(['owner', 'round_robin', 'ia_only']),
  daily_cap: z.number().int().min(1).max(500),
  monthly_cap: z.number().int().min(1).max(10000),
  quiet_hours_start: z.string().regex(/^\d{2}:\d{2}$/).default('20:00'),
  quiet_hours_end: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
  active: z.boolean().default(true),
})

// ============= Helper: compute next run =============
// Produz o próximo horário (UTC ISO) que corresponde a
// (days_of_week[Sunday=0..Sat=6] + time_of_day HH:MM em `timezone`).
export function computeNextRun(
  now: Date,
  daysOfWeek: number[],
  timeOfDay: string,
  timezone: string,
): Date {
  const [hh, mm] = timeOfDay.split(':').map((n) => parseInt(n, 10))
  // Tenta próximas 14 datas partindo de hoje no fuso local do schedule.
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(now.getTime() + i * 86400000)
    // Descobre o dia da semana no fuso alvo.
    const dow = parseInt(
      new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone })
        .formatToParts(candidate)
        .find((p: any) => p.type === 'weekday')?.value
        ? ({ Sun: '0', Mon: '1', Tue: '2', Wed: '3', Thu: '4', Fri: '5', Sat: '6' } as Record<string, string>)[
            new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: timezone }).format(candidate)
          ]
        : '0',
      10,
    )
    if (!daysOfWeek.includes(dow)) continue
    // Constrói o horário "local" no timezone.
    const y = new Intl.DateTimeFormat('en-CA', { year: 'numeric', timeZone: timezone }).format(candidate)
    const m = new Intl.DateTimeFormat('en-CA', { month: '2-digit', timeZone: timezone }).format(candidate)
    const d = new Intl.DateTimeFormat('en-CA', { day: '2-digit', timeZone: timezone }).format(candidate)
    // Interpreta essa data como local do timezone e converte para UTC ISO.
    const utcish = new Date(`${y}-${m}-${d}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:00Z`)
    // Ajusta pelo offset do timezone naquele instante.
    const offsetMin = getTimezoneOffsetMinutes(timezone, utcish)
    const target = new Date(utcish.getTime() + offsetMin * 60_000)
    if (target.getTime() > now.getTime()) return target
  }
  // Fallback: 24h à frente.
  return new Date(now.getTime() + 86_400_000)
}

function getTimezoneOffsetMinutes(timezone: string, when: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(when)
  const map: Record<string, string> = {}
  parts.forEach((p) => { if (p.type !== 'literal') map[p.type] = p.value })
  const asUtc = Date.UTC(
    parseInt(map.year, 10), parseInt(map.month, 10) - 1, parseInt(map.day, 10),
    parseInt(map.hour, 10) === 24 ? 0 : parseInt(map.hour, 10),
    parseInt(map.minute, 10), parseInt(map.second, 10),
  )
  return Math.round((asUtc - when.getTime()) / 60_000)
}

// ============= CRUD =============

export const listSchedules = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await ((context as any).supabase as any)
      .from('prospecting_schedules' as any) as any
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return data ?? []
  })

export const getSchedule = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await ((context as any).supabase as any)
      .from('prospecting_schedules' as any) as any
      .select('*')
      .eq('id', data.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!row) throw new Error('Campanha não encontrada')
    return row
  })

export const upsertSchedule = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => upsertSchema.parse(d))
  .handler(async ({ data, context }) => {
    const next = computeNextRun(new Date(), data.days_of_week, data.time_of_day, data.timezone)
    if (data.id) {
      const { data: row, error } = await ((context as any).supabase as any)
        .from('prospecting_schedules' as any) as any
        .update({
          name: data.name,
          description: data.description ?? null,
          filters: data.filters as never,
          quantity: data.quantity,
          days_of_week: data.days_of_week,
          time_of_day: data.time_of_day,
          timezone: data.timezone,
          auto_approve_min_score: data.auto_approve_min_score,
          sequence_id: data.sequence_id ?? null,
          assignment_strategy: data.assignment_strategy,
          daily_cap: data.daily_cap,
          monthly_cap: data.monthly_cap,
          quiet_hours_start: data.quiet_hours_start,
          quiet_hours_end: data.quiet_hours_end,
          active: data.active,
          next_run_at: data.active ? next.toISOString() : null,
        } as never)
        .eq('id', data.id)
        .select('*')
        .single()
      if (error) throw new Error(error.message)
      return row
    }
    const { data: row, error } = await ((context as any).supabase as any)
      .from('prospecting_schedules' as any) as any
      .insert({
        owner_id: context.userId,
        name: data.name,
        description: data.description ?? null,
        filters: data.filters as never,
        quantity: data.quantity,
        days_of_week: data.days_of_week,
        time_of_day: data.time_of_day,
        timezone: data.timezone,
        auto_approve_min_score: data.auto_approve_min_score,
        sequence_id: data.sequence_id ?? null,
        assignment_strategy: data.assignment_strategy,
        daily_cap: data.daily_cap,
        monthly_cap: data.monthly_cap,
        quiet_hours_start: data.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end,
        active: data.active,
        next_run_at: data.active ? next.toISOString() : null,
      } as never)
      .select('*')
      .single()
    if (error) throw new Error(error.message)
    return row
  })

export const toggleSchedule = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), active: z.boolean() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: cur } = await ((context as any).supabase as any)
      .from('prospecting_schedules' as any) as any
      .select('days_of_week, time_of_day, timezone')
      .eq('id', data.id)
      .maybeSingle()
    if (!cur) throw new Error('Campanha não encontrada')
    const next = data.active
      ? computeNextRun(new Date(), cur.days_of_week as number[], cur.time_of_day as string, cur.timezone as string)
      : null
    const { error } = await ((context as any).supabase as any)
      .from('prospecting_schedules' as any) as any
      .update({ active: data.active, next_run_at: next ? next.toISOString() : null, consecutive_failures: 0 } as never)
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const deleteSchedule = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await ((context as any).supabase as any)
      .from('prospecting_schedules' as any) as any
      .delete()
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const listScheduleRuns = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ schedule_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await ((context as any).supabase as any)
      .from('prospecting_schedule_runs' as any) as any
      .select('*')
      .eq('schedule_id', data.schedule_id)
      .order('started_at', { ascending: false })
      .limit(20)
    if (error) throw new Error(error.message)
    return rows ?? []
  })

// ============= Execução manual (botão "Rodar agora") =============
export const runScheduleNow = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: schedule, error: sErr } = await ((context as any).supabase as any)
      .from('prospecting_schedules' as any) as any
      .select('*')
      .eq('id', data.id)
      .maybeSingle()
    if (sErr) throw new Error(sErr.message)
    if (!schedule) throw new Error('Campanha não encontrada')

    const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
    const { runProspectingCampaignInternal } = await import('./prospecting.functions')

    const { data: runRow } = await supabaseAdmin
      .from('prospecting_schedule_runs' as any) as any
      .insert({ schedule_id: schedule.id, status: 'running' } as never)
      .select('id')
      .single()

    try {
      const result = await runProspectingCampaignInternal(supabaseAdmin, schedule as never)
      await supabaseAdmin
        .from('prospecting_schedule_runs' as any) as any
        .update({
          status: result.imported === 0 && result.found > 0 ? 'partial' : 'success',
          finished_at: new Date().toISOString(),
          found_count: result.found,
          approved_count: result.approved,
          imported_count: result.imported,
          skipped_count: result.skipped,
          detail: result.reasons as never,
        } as never)
        .eq('id', runRow?.id ?? '')
      await supabaseAdmin
        .from('prospecting_schedules' as any) as any
        .update({ last_run_at: new Date().toISOString(), consecutive_failures: 0 } as never)
        .eq('id', schedule.id)
      return { ok: true, ...result }
    } catch (err) {
      const msg = (err as Error).message
      await supabaseAdmin
        .from('prospecting_schedule_runs' as any) as any
        .update({ status: 'failed', finished_at: new Date().toISOString(), error: msg } as never)
        .eq('id', runRow?.id ?? '')
      throw new Error(msg)
    }
  })
