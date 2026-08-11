export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      company_settings: {
        Row: {
          active: boolean | null
          ai_max_tokens: number | null
          ai_model: string | null
          ai_prompt: string | null
          ai_temperature: number | null
          assignment_strategy: string | null
          autonomy: Json | null
          can_use_ia: boolean | null
          description: string | null
          differentiators: string | null
          handoff_readiness_score: number | null
          handoff_sla_minutes: number | null
          id: string
          name: string | null
          nurture_days: number | null
          nurture_max_cycles: number | null
          organization_id: string
          outreach_max_attempts: number | null
          outreach_wait_hours: number | null
          prospecting_sources: Json | null
          sandbox_mode: boolean | null
          tone_of_voice: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          ai_max_tokens?: number | null
          ai_model?: string | null
          ai_prompt?: string | null
          ai_temperature?: number | null
          assignment_strategy?: string | null
          autonomy?: Json | null
          can_use_ia?: boolean | null
          description?: string | null
          differentiators?: string | null
          handoff_readiness_score?: number | null
          handoff_sla_minutes?: number | null
          id?: string
          name?: string | null
          nurture_days?: number | null
          nurture_max_cycles?: number | null
          organization_id: string
          outreach_max_attempts?: number | null
          outreach_wait_hours?: number | null
          prospecting_sources?: Json | null
          sandbox_mode?: boolean | null
          tone_of_voice?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          ai_max_tokens?: number | null
          ai_model?: string | null
          ai_prompt?: string | null
          ai_temperature?: number | null
          assignment_strategy?: string | null
          autonomy?: Json | null
          can_use_ia?: boolean | null
          description?: string | null
          differentiators?: string | null
          handoff_readiness_score?: number | null
          handoff_sla_minutes?: number | null
          id?: string
          name?: string | null
          nurture_days?: number | null
          nurture_max_cycles?: number | null
          organization_id?: string
          outreach_max_attempts?: number | null
          outreach_wait_hours?: number | null
          prospecting_sources?: Json | null
          sandbox_mode?: boolean | null
          tone_of_voice?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          ai_paused: boolean | null
          annual_revenue: string | null
          assigned_to: string | null
          company: string
          contact: string | null
          contact_channels: Json | null
          created_at: string | null
          distance: number | null
          email: string | null
          escalated: boolean | null
          escalation_reason: string | null
          id: string
          last_contact: string | null
          lost_reason: string | null
          next_action_at: string | null
          opt_out: boolean | null
          organization_id: string
          origin: string | null
          owner_id: string | null
          phone: string | null
          score: number | null
          score_explanation: string | null
          score_snapshot: Json | null
          score_source: string | null
          score_verified_at: string | null
          segment: string | null
          sla_info: string | null
          stage: Database["public"]["Enums"]["lead_stage"] | null
          stale_hours: number | null
          temp: string | null
          title: string | null
          uf: string | null
          updated_at: string | null
          value: number | null
          whatsapp: string | null
        }
        Insert: {
          ai_paused?: boolean | null
          annual_revenue?: string | null
          assigned_to?: string | null
          company: string
          contact?: string | null
          contact_channels?: Json | null
          created_at?: string | null
          distance?: number | null
          email?: string | null
          escalated?: boolean | null
          escalation_reason?: string | null
          id?: string
          last_contact?: string | null
          lost_reason?: string | null
          next_action_at?: string | null
          opt_out?: boolean | null
          organization_id: string
          origin?: string | null
          owner_id?: string | null
          phone?: string | null
          score?: number | null
          score_explanation?: string | null
          score_snapshot?: Json | null
          score_source?: string | null
          score_verified_at?: string | null
          segment?: string | null
          sla_info?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"] | null
          stale_hours?: number | null
          temp?: string | null
          title?: string | null
          uf?: string | null
          updated_at?: string | null
          value?: number | null
          whatsapp?: string | null
        }
        Update: {
          ai_paused?: boolean | null
          annual_revenue?: string | null
          assigned_to?: string | null
          company?: string
          contact?: string | null
          contact_channels?: Json | null
          created_at?: string | null
          distance?: number | null
          email?: string | null
          escalated?: boolean | null
          escalation_reason?: string | null
          id?: string
          last_contact?: string | null
          lost_reason?: string | null
          next_action_at?: string | null
          opt_out?: boolean | null
          organization_id?: string
          origin?: string | null
          owner_id?: string | null
          phone?: string | null
          score?: number | null
          score_explanation?: string | null
          score_snapshot?: Json | null
          score_source?: string | null
          score_verified_at?: string | null
          segment?: string | null
          sla_info?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"] | null
          stale_hours?: number | null
          temp?: string | null
          title?: string | null
          uf?: string | null
          updated_at?: string | null
          value?: number | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          active: boolean | null
          avatar: string | null
          can_use_ia: boolean | null
          created_at: string | null
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          avatar?: string | null
          can_use_ia?: boolean | null
          created_at?: string | null
          email: string
          id: string
          name: string
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          avatar?: string | null
          can_use_ia?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string | null
        }
        Insert: {
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Update: {
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      app_role: "administrador" | "vendedor" | "ia"
      lead_stage:
        | "Prospecção"
        | "Qualificado"
        | "Proposta"
        | "Negociação"
        | "Pedido"
        | "Fechado"
        | "Perdido"
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

export const Constants = {
  public: {
    Enums: {
      app_role: ["administrador", "vendedor", "ia"],
      lead_stage: [
        "Prospecção",
        "Qualificado",
        "Proposta",
        "Negociação",
        "Pedido",
        "Fechado",
        "Perdido",
      ],
    },
  },
} as const
