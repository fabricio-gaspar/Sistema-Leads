import { createServerFn } from '@tanstack/react-start'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'
import { z } from 'zod'

export const COMMERCIAL_STAGES = [
  'Novo',
  'Apresentado',
  'Qualificando',
  'Reunião',
  'Orçamento',
  'Ganho',
  'Perdido',
] as const

export type CommercialStage = (typeof COMMERCIAL_STAGES)[number]

const commercialStage = z.enum(COMMERCIAL_STAGES)

export const listCommercialStages = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from('pipeline_stages')
      .select('id,pipeline_id,name,position,is_won,is_lost')
      .eq('active', true)
      .not('ana_stage_key', 'is', null)
      .order('position', { ascending: true })
    if (error) throw new Error(error.message)

    const canonical = (data ?? []).filter((row) =>
      (COMMERCIAL_STAGES as readonly string[]).includes(row.name),
    )
    return canonical
  })

export const moveLeadCommercialStage = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), stage: commercialStage }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: lead, error: leadError } = await context.supabase
      .from('leads')
      .select('id,pipeline_id,pipeline_stage_id,company')
      .eq('id', data.id)
      .maybeSingle()
    if (leadError) throw new Error(leadError.message)
    if (!lead?.pipeline_id) throw new Error('Lead sem pipeline configurado.')

    const { data: target, error: stageError } = await context.supabase
      .from('pipeline_stages')
      .select('id,name')
      .eq('pipeline_id', lead.pipeline_id)
      .eq('name', data.stage)
      .eq('active', true)
      .maybeSingle()
    if (stageError) throw new Error(stageError.message)
    if (!target) throw new Error(`Etapa comercial não configurada: ${data.stage}`)

    if (lead.pipeline_stage_id === target.id) return lead

    const { data: row, error } = await context.supabase
      .from('leads')
      .update({ pipeline_stage_id: target.id })
      .eq('id', data.id)
      .select()
      .single()
    if (error) throw new Error(error.message)

    await context.supabase.from('audit_logs').insert({
      actor_id: context.userId,
      actor_name: context.claims?.email ?? 'user',
      actor_type: 'human',
      action: 'commercial_stage_change',
      detail: `Lead ${data.id} → ${data.stage}`,
      entity_table: 'leads',
      entity_id: data.id,
      event_data: { pipeline_stage_id: target.id, stage: data.stage },
    } as never)

    return row
  })
