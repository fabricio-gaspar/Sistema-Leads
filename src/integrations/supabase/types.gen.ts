export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      leads: {
        Row: {
          id: string
          company: string
          contact: string | null
          title: string | null
          phone: string | null
          email: string | null
          segment: string | null
          uf: string | null
          distance: number | null
          score: number
          temp: "hot" | "warm" | "cold"
          stage: "Prospecção" | "Qualificado" | "Proposta" | "Negociação" | "Pedido" | "Fechado" | "Perdido"
          value: number
          owner: "ia" | "human"
          assigned_to: string | null
          stale_hours: number
          escalated: boolean
          escalation_reason: string | null
          sla_info: string | null
          last_contact: string | null
          lost_reason: string | null
          origin: string | null
          created_at: string
          updated_at: string
          annual_revenue: string | null
        }
        Insert: any
        Update: any
      }
      profiles: {
        Row: {
          id: string
          name: string
          email: string
          phone: string | null
          avatar: string | null
          active: boolean
          can_use_ia: boolean
          discount_limit: string | null
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      notifications: {
        Row: {
          id: string
          owner_id: string
          kind: string
          title: string
          description: string | null
          read: boolean
          link: string | null
          created_at: string
        }
        Insert: any
        Update: any
      }
      audit_logs: {
        Row: {
          id: string
          actor_id: string | null
          actor_name: string
          actor_type: "ia" | "human"
          action: string
          detail: string | null
          rule: string | null
          occurred_at: string
          created_at: string
        }
        Insert: any
        Update: any
      }
      lead_messages: {
        Row: {
          id: string
          lead_id: string
          sender: "ia" | "human" | "client"
          sender_name: string
          type: "ia" | "ia-escalated" | "human" | "client"
          text: string
          sent_at: string
          created_at: string
        }
        Insert: any
        Update: any
      }
      lead_tasks: {
        Row: {
          id: string
          lead_id: string
          text: string
          due_at: string | null
          owner_id: string | null
          owner_label: string | null
          completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      proposals: {
        Row: {
          id: string
          number: string
          lead_id: string | null
          client: string
          items: string
          value: number
          discount: string | null
          creator: "ia" | "human"
          creator_name: string | null
          status: string
          need_approval: boolean
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      orders: {
        Row: {
          id: string
          number: string
          lead_id: string | null
          proposal_id: string | null
          company: string
          seller_name: string
          seller_type: "ia" | "human"
          order_date: string
          items: string
          value: number
          payment: string | null
          contract_status: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      company_settings: {
        Row: {
          id: string
          name: string
          cnpj: string | null
          segment: string | null
          size: "pequena" | "media" | "grande" | null
          annual_revenue: string | null
          city: string | null
          state: string | null
          website: string | null
          address: string | null
          phone: string | null
          email: string | null
          description: string | null
          tone_of_voice: string | null
          differentiators: string | null
          logo_url: string | null
          ai_prompt: string | null
          ai_model: string | null
          ai_temperature: number | null
          ai_max_tokens: number | null
          prospecting_sources: Json
          outreach_wait_hours: number | null
          outreach_max_attempts: number | null
          assignment_strategy: "manual" | "round_robin" | "least_loaded"
          handoff_sla_minutes: number
          handoff_readiness_score: number
          sandbox_mode: boolean | null
          nurture_days: number
          nurture_max_cycles: number
          autonomy: Json
          created_at: string
          updated_at: string
        }
        Insert: any
        Update: any
      }
      outreach_sequences: { Row: { id: string; name: string }; Insert: any; Update: any }
      outreach_sequence_steps: { Row: { id: string }; Insert: any; Update: any }
      lead_sequence_enrollments: { Row: { id: string; status: string }; Insert: any; Update: any }
      prospecting_schedules: { Row: { id: string; owner_id: string; filters: Json; quantity: number; auto_approve_min_score: number; sequence_id: string | null; assignment_strategy: string; daily_cap: number; monthly_cap: number }; Insert: any; Update: any }
      prospecting_schedule_runs: { Row: { id: string; imported_count: number }; Insert: any; Update: any }
      user_roles: { Row: { id: string; user_id: string; role: string }; Insert: any; Update: any }
      documents: { Row: { id: string; name: string; content_text?: string; storage_path?: string }; Insert: any; Update: any }
      lead_outreach: { Row: { id: string; channel: string; actor_type: string; lead_id: string; status: string; replied_at?: string }; Insert: any; Update: any }
      score_weights: { Row: { id: string; segment: number; whatsapp: number; site: number; porte: number; google: number; regiao: number; updated_at: string }; Insert: any; Update: any }
      unanswered_questions: { Row: { id: string; text: string; count: number; resolved: boolean }; Insert: any; Update: any }
      integrations: { Row: { id: string; key: string; label: string; connected: boolean; updated_at: string }; Insert: any; Update: any }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: { _user_id: string; _role: "administrador" | "vendedor" | "sdr" | "cx" }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "administrador" | "vendedor" | "sdr" | "cx"
      lead_temp: "hot" | "warm" | "cold"
      lead_stage: "Prospecção" | "Qualificado" | "Proposta" | "Negociação" | "Pedido" | "Fechado" | "Perdido"
      owner_type: "ia" | "human"
      message_sender: "ia" | "human" | "client"
      message_type: "ia" | "ia-escalated" | "human" | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
