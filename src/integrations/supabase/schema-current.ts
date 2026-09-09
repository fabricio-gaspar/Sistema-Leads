import type { Database as LegacyDatabase } from './types'

type LegacyPublic = LegacyDatabase['public']
type LegacyLeads = LegacyPublic['Tables']['leads']

type CurrentLeads = {
  Row: LegacyLeads['Row'] & {
    ana_outcome: string | null
    ana_stage: string | null
    modo_atendimento: string | null
    pipeline_id: string | null
    pipeline_stage_id: string | null
    phone_identity: string | null
    whatsapp_identity: string | null
  }
  Insert: LegacyLeads['Insert'] & {
    ana_outcome?: string | null
    ana_stage?: string | null
    modo_atendimento?: string | null
    pipeline_id?: string | null
    pipeline_stage_id?: string | null
  }
  Update: LegacyLeads['Update'] & {
    ana_outcome?: string | null
    ana_stage?: string | null
    modo_atendimento?: string | null
    pipeline_id?: string | null
    pipeline_stage_id?: string | null
  }
  Relationships: LegacyLeads['Relationships']
}

type PipelineStages = {
  Row: {
    active: boolean
    ana_stage_key: string | null
    color: string
    created_at: string
    id: string
    is_lost: boolean
    is_won: boolean
    legacy_stage: LegacyDatabase['public']['Enums']['lead_stage']
    name: string
    organization_id: string
    pipeline_id: string
    position: number
    probability: number
    updated_at: string
  }
  Insert: {
    active?: boolean
    ana_stage_key?: string | null
    color?: string
    created_at?: string
    id?: string
    is_lost?: boolean
    is_won?: boolean
    legacy_stage?: LegacyDatabase['public']['Enums']['lead_stage']
    name: string
    organization_id?: string
    pipeline_id: string
    position: number
    probability?: number
    updated_at?: string
  }
  Update: {
    active?: boolean
    ana_stage_key?: string | null
    color?: string
    created_at?: string
    id?: string
    is_lost?: boolean
    is_won?: boolean
    legacy_stage?: LegacyDatabase['public']['Enums']['lead_stage']
    name?: string
    organization_id?: string
    pipeline_id?: string
    position?: number
    probability?: number
    updated_at?: string
  }
  Relationships: []
}

export type CurrentDatabase = Omit<LegacyDatabase, 'public'> & {
  public: Omit<LegacyPublic, 'Tables'> & {
    Tables: Omit<LegacyPublic['Tables'], 'leads'> & {
      leads: CurrentLeads
      pipeline_stages: PipelineStages
    }
  }
}

export type CurrentLeadRow = CurrentDatabase['public']['Tables']['leads']['Row']
