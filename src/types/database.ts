export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: { Row: { id: string; name: string; slug: string; created_at: string; updated_at: string }; Insert: any; Update: any }
      organization_members: { Row: { organization_id: string; user_id: string; role: string; created_at: string }; Insert: any; Update: any }
      organization_invites: { Row: { id: string; organization_id: string; email: string; role: string; inviter_id: string; created_at: string; expires_at: string; accepted_at: string | null }; Insert: any; Update: any }
      leads: { Row: { id: string; organization_id: string; company: string; contact: string | null; title: string | null; phone: string | null; email: string | null; segment: string | null; uf: string | null; distance: number | null; score: number; temp: string; stage: string; value: number; owner: string; assigned_to: string | null; stale_hours: number; escalated: boolean; escalation_reason: string | null; sla_info: string | null; last_contact: string | null; lost_reason: string | null; origin: string | null; created_at: string; updated_at: string; annual_revenue: string | null; score_snapshot: Json | null; score_explanation: string | null; score_source: string | null; score_verified_at: string | null; whatsapp: string | null; opt_out: boolean; owner_id: string | null; next_action_at: string | null; contact_channels: Json | null }; Insert: any; Update: any }
      profiles: { Row: { id: string; name: string; email: string; phone: string | null; avatar: string | null; active: boolean; can_use_ia: boolean; created_at: string; updated_at: string }; Insert: any; Update: any }
      notifications: { Row: { id: string; organization_id: string; owner_id: string; kind: string; title: string; description: string | null; read: boolean; link: string | null; created_at: string }; Insert: any; Update: any }
      audit_logs: { Row: { id: string; organization_id: string; actor_id: string | null; actor_name: string; actor_type: string; action: string; detail: string | null; rule: string | null; occurred_at: string; created_at: string }; Insert: any; Update: any }
      lead_messages: { Row: { id: string; organization_id: string; lead_id: string; sender: string; sender_name: string; type: string; text: string; sent_at: string; created_at: string }; Insert: any; Update: any }
      lead_tasks: { Row: { id: string; organization_id: string; lead_id: string; text: string; due_at: string | null; owner_id: string | null; owner_label: string | null; completed: boolean; created_at: string; updated_at: string }; Insert: any; Update: any }
      proposals: { Row: { id: string; organization_id: string; number: string; lead_id: string | null; client: string; items: string; value: number; discount: string | null; creator: string; creator_name: string | null; status: string; need_approval: boolean; created_at: string; updated_at: string }; Insert: any; Update: any }
      orders: { Row: { id: string; organization_id: string; number: string; lead_id: string | null; proposal_id: string | null; company: string; seller_name: string; seller_type: string; order_date: string; items: string; value: number; payment: string | null; contract_status: string | null; status: string; created_at: string; updated_at: string }; Insert: any; Update: any }
      company_settings: { Row: { id: string; organization_id: string; name: string; ai_prompt: string | null; ai_model: string | null; ai_temperature: number | null; ai_max_tokens: number | null; description: string | null; tone_of_voice: string | null; differentiators: string | null; active: boolean; can_use_ia: boolean; assignment_strategy: string; handoff_sla_minutes: number; handoff_readiness_score: number; nurture_days: number; nurture_max_cycles: number; autonomy: Json; outreach_wait_hours: number | null; outreach_max_attempts: number | null; prospecting_sources: Json }; Insert: any; Update: any }
      outreach_sequences: { Row: { id: string; organization_id: string; name: string }; Insert: any; Update: any }
      outreach_sequence_steps: { Row: { id: string; organization_id: string; type: string; content: string; wait_hours: number; order_index: number; max_attempts: number; continue_on: string }; Insert: any; Update: any }
      lead_sequence_enrollments: { Row: { id: string; organization_id: string; lead_id: string; sequence_id: string; status: string; current_step_id: string | null; next_run_at: string | null; last_error: string | null }; Insert: any; Update: any }
      prospecting_schedules: { Row: { id: string; organization_id: string; owner_id: string; filters: Json; quantity: number; auto_approve_min_score: number; sequence_id: string | null; assignment_strategy: string; daily_cap: number; monthly_cap: number }; Insert: any; Update: any }
      prospecting_schedule_runs: { Row: { id: string; organization_id: string; imported_count: number }; Insert: any; Update: any }
      user_roles: { Row: { id: string; organization_id: string; user_id: string; role: string }; Insert: any; Update: any }
      documents: { Row: { id: string; organization_id: string; name: string; content_text: string | null; storage_path: string | null }; Insert: any; Update: any }
      lead_outreach: { Row: { id: string; organization_id: string; channel: string; actor_type: string; lead_id: string; status: string; replied_at: string | null; attempt: number; created_at: string; content: string | null; error: string | null }; Insert: any; Update: any }
      score_weights: { Row: { id: string; organization_id: string; segment: number; whatsapp: number; site: number; porte: number; google: number; regiao: number; updated_at: string }; Insert: any; Update: any }
      unanswered_questions: { Row: { id: string; organization_id: string; text: string; count: number; resolved: boolean }; Insert: any; Update: any }
      integrations: { Row: { id: string; organization_id: string; key: string; label: string; connected: boolean; updated_at: string }; Insert: any; Update: any }
      lead_qualifications: { Row: { id: string; organization_id: string; lead_id: string; question: string; answer: string | null; status: string }; Insert: any; Update: any }
      lead_handoffs: { Row: { id: string; organization_id: string; lead_id: string; from_user_id: string; to_user_id: string | null; status: string; sla_expires_at: string | null }; Insert: any; Update: any }
      appointments: { Row: { id: string; organization_id: string; lead_id: string; user_id: string; title: string; start_at: string; end_at: string; status: string; meeting_url: string | null }; Insert: any; Update: any }
    }
    Views: { [_ in never]: never }
    Functions: {
      has_role: { Args: { _user_id: string; _role: string }; Returns: boolean }
      current_org_id: { Args: Record<PropertyKey, never>; Returns: string }
      is_org_member: { Args: { _org: string; _user: string; _role?: string }; Returns: boolean }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}

export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
