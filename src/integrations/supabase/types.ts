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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          actor_type: Database["public"]["Enums"]["owner_type"]
          created_at: string
          detail: string | null
          id: string
          occurred_at: string
          rule: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name: string
          actor_type?: Database["public"]["Enums"]["owner_type"]
          created_at?: string
          detail?: string | null
          id?: string
          occurred_at?: string
          rule?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_type?: Database["public"]["Enums"]["owner_type"]
          created_at?: string
          detail?: string | null
          id?: string
          occurred_at?: string
          rule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_settings: {
        Row: {
          address: string | null
          ai_max_tokens: number | null
          ai_model: string | null
          ai_prompt: string | null
          ai_temperature: number | null
          annual_revenue: string | null
          city: string | null
          cnpj: string | null
          created_at: string
          description: string | null
          differentiators: string | null
          email: string | null
          id: string
          logo_url: string | null
          name: string
          phone: string | null
          prospecting_sources: Json
          segment: string | null
          size: string | null
          state: string | null
          tone_of_voice: string | null
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          ai_max_tokens?: number | null
          ai_model?: string | null
          ai_prompt?: string | null
          ai_temperature?: number | null
          annual_revenue?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          differentiators?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name: string
          phone?: string | null
          prospecting_sources?: Json
          segment?: string | null
          size?: string | null
          state?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          ai_max_tokens?: number | null
          ai_model?: string | null
          ai_prompt?: string | null
          ai_temperature?: number | null
          annual_revenue?: string | null
          city?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          differentiators?: string | null
          email?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          phone?: string | null
          prospecting_sources?: Json
          segment?: string | null
          size?: string | null
          state?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string
          id: string
          name: string
          size: string | null
          status: string
          storage_path: string | null
          type: string | null
          updated_at: string
          uploaded_by: string | null
          uses: number
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          size?: string | null
          status?: string
          storage_path?: string | null
          type?: string | null
          updated_at?: string
          uploaded_by?: string | null
          uses?: number
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          size?: string | null
          status?: string
          storage_path?: string | null
          type?: string | null
          updated_at?: string
          uploaded_by?: string | null
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          config: Json
          connected: boolean
          id: string
          key: string
          label: string
          updated_at: string
        }
        Insert: {
          config?: Json
          connected?: boolean
          id?: string
          key: string
          label: string
          updated_at?: string
        }
        Update: {
          config?: Json
          connected?: boolean
          id?: string
          key?: string
          label?: string
          updated_at?: string
        }
        Relationships: []
      }
      lead_messages: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          sender: Database["public"]["Enums"]["message_sender"]
          sender_name: string
          sent_at: string
          text: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id: string
          sender: Database["public"]["Enums"]["message_sender"]
          sender_name: string
          sent_at?: string
          text: string
          type: Database["public"]["Enums"]["message_type"]
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: string
          sender?: Database["public"]["Enums"]["message_sender"]
          sender_name?: string
          sent_at?: string
          text?: string
          type?: Database["public"]["Enums"]["message_type"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          completed: boolean
          created_at: string
          due_at: string | null
          id: string
          lead_id: string
          owner_id: string | null
          owner_label: string | null
          text: string
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          due_at?: string | null
          id?: string
          lead_id: string
          owner_id?: string | null
          owner_label?: string | null
          text: string
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          due_at?: string | null
          id?: string
          lead_id?: string
          owner_id?: string | null
          owner_label?: string | null
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          annual_revenue: number | null
          assigned_to: string | null
          city: string | null
          company: string
          contact: string | null
          created_at: string
          distance: number | null
          email: string | null
          escalated: boolean
          escalation_reason: string | null
          id: string
          last_contact: string | null
          lost_reason: string | null
          origin: string | null
          owner: Database["public"]["Enums"]["owner_type"]
          owner_id: string | null
          phone: string | null
          score: number
          segment: string | null
          size: string | null
          sla_info: string | null
          stage: Database["public"]["Enums"]["lead_stage"]
          stale_hours: number
          temp: Database["public"]["Enums"]["lead_temp"]
          title: string | null
          uf: string | null
          updated_at: string
          value: number
        }
        Insert: {
          annual_revenue?: number | null
          assigned_to?: string | null
          city?: string | null
          company: string
          contact?: string | null
          created_at?: string
          distance?: number | null
          email?: string | null
          escalated?: boolean
          escalation_reason?: string | null
          id?: string
          last_contact?: string | null
          lost_reason?: string | null
          origin?: string | null
          owner?: Database["public"]["Enums"]["owner_type"]
          owner_id?: string | null
          phone?: string | null
          score?: number
          segment?: string | null
          size?: string | null
          sla_info?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          stale_hours?: number
          temp?: Database["public"]["Enums"]["lead_temp"]
          title?: string | null
          uf?: string | null
          updated_at?: string
          value?: number
        }
        Update: {
          annual_revenue?: number | null
          assigned_to?: string | null
          city?: string | null
          company?: string
          contact?: string | null
          created_at?: string
          distance?: number | null
          email?: string | null
          escalated?: boolean
          escalation_reason?: string | null
          id?: string
          last_contact?: string | null
          lost_reason?: string | null
          origin?: string | null
          owner?: Database["public"]["Enums"]["owner_type"]
          owner_id?: string | null
          phone?: string | null
          score?: number
          segment?: string | null
          size?: string | null
          sla_info?: string | null
          stage?: Database["public"]["Enums"]["lead_stage"]
          stale_hours?: number
          temp?: Database["public"]["Enums"]["lead_temp"]
          title?: string | null
          uf?: string | null
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "leads_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      objections: {
        Row: {
          created_at: string
          id: string
          response: string
          trigger: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          response: string
          trigger: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          response?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          company: string
          contract_status: string | null
          created_at: string
          id: string
          items: string | null
          lead_id: string | null
          number: string
          order_date: string
          owner_id: string | null
          payment: string | null
          proposal_id: string | null
          seller_name: string | null
          seller_type: Database["public"]["Enums"]["owner_type"]
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          company: string
          contract_status?: string | null
          created_at?: string
          id?: string
          items?: string | null
          lead_id?: string | null
          number: string
          order_date?: string
          owner_id?: string | null
          payment?: string | null
          proposal_id?: string | null
          seller_name?: string | null
          seller_type?: Database["public"]["Enums"]["owner_type"]
          status?: string
          updated_at?: string
          value?: number
        }
        Update: {
          company?: string
          contract_status?: string | null
          created_at?: string
          id?: string
          items?: string | null
          lead_id?: string | null
          number?: string
          order_date?: string
          owner_id?: string | null
          payment?: string | null
          proposal_id?: string | null
          seller_name?: string | null
          seller_type?: Database["public"]["Enums"]["owner_type"]
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          avatar: string | null
          can_use_ia: boolean
          created_at: string
          discount_limit: string | null
          email: string
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          avatar?: string | null
          can_use_ia?: boolean
          created_at?: string
          discount_limit?: string | null
          email: string
          id: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          avatar?: string | null
          can_use_ia?: boolean
          created_at?: string
          discount_limit?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      proposals: {
        Row: {
          client: string
          created_at: string
          creator: Database["public"]["Enums"]["owner_type"]
          creator_name: string | null
          discount: string | null
          id: string
          items: string
          lead_id: string | null
          need_approval: boolean
          number: string
          owner_id: string | null
          status: string
          updated_at: string
          value: number
        }
        Insert: {
          client: string
          created_at?: string
          creator?: Database["public"]["Enums"]["owner_type"]
          creator_name?: string | null
          discount?: string | null
          id?: string
          items: string
          lead_id?: string | null
          need_approval?: boolean
          number: string
          owner_id?: string | null
          status?: string
          updated_at?: string
          value?: number
        }
        Update: {
          client?: string
          created_at?: string
          creator?: Database["public"]["Enums"]["owner_type"]
          creator_name?: string | null
          discount?: string | null
          id?: string
          items?: string
          lead_id?: string | null
          need_approval?: boolean
          number?: string
          owner_id?: string | null
          status?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "proposals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proposals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_cache: {
        Row: {
          created_at: string
          expires_at: string
          filters: Json
          filters_hash: string
          id: string
          name: string | null
          results: Json
          saved: boolean
          scored: boolean
          total_found: number
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string
          filters: Json
          filters_hash: string
          id?: string
          name?: string | null
          results?: Json
          saved?: boolean
          scored?: boolean
          total_found?: number
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          filters?: Json
          filters_hash?: string
          id?: string
          name?: string | null
          results?: Json
          saved?: boolean
          scored?: boolean
          total_found?: number
          user_id?: string
        }
        Relationships: []
      }
      score_weights: {
        Row: {
          google: number
          id: string
          porte: number
          regiao: number
          segment: number
          site: number
          updated_at: string
          whatsapp: number
        }
        Insert: {
          google?: number
          id?: string
          porte?: number
          regiao?: number
          segment?: number
          site?: number
          updated_at?: string
          whatsapp?: number
        }
        Update: {
          google?: number
          id?: string
          porte?: number
          regiao?: number
          segment?: number
          site?: number
          updated_at?: string
          whatsapp?: number
        }
        Relationships: []
      }
      services: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          id: string
          max_discount: number
          name: string
          price: number
          term: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          max_discount?: number
          name: string
          price?: number
          term?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string | null
          created_at?: string
          description?: string | null
          id?: string
          max_discount?: number
          name?: string
          price?: number
          term?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tasks: {
        Row: {
          completed: boolean
          created_at: string
          due_at: string | null
          id: string
          owner_id: string | null
          owner_label: string | null
          text: string
          time_label: string | null
          updated_at: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          due_at?: string | null
          id?: string
          owner_id?: string | null
          owner_label?: string | null
          text: string
          time_label?: string | null
          updated_at?: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          due_at?: string | null
          id?: string
          owner_id?: string | null
          owner_label?: string | null
          text?: string
          time_label?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      unanswered_questions: {
        Row: {
          count: number
          created_at: string
          id: string
          resolved: boolean
          text: string
          updated_at: string
        }
        Insert: {
          count?: number
          created_at?: string
          id?: string
          resolved?: boolean
          text: string
          updated_at?: string
        }
        Update: {
          count?: number
          created_at?: string
          id?: string
          resolved?: boolean
          text?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_sessions: {
        Row: {
          created_at: string
          ended_at: string | null
          id: string
          minutes: number | null
          session_date: string
          started_at: string
          token: string | null
          user_id: string | null
          user_name: string
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          id?: string
          minutes?: number | null
          session_date?: string
          started_at?: string
          token?: string | null
          user_id?: string | null
          user_name: string
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          id?: string
          minutes?: number | null
          session_date?: string
          started_at?: string
          token?: string | null
          user_id?: string | null
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "administrador" | "vendedor" | "sdr" | "cx"
      lead_stage:
        | "Prospecção"
        | "Qualificado"
        | "Proposta"
        | "Negociação"
        | "Pedido"
        | "Fechado"
        | "Perdido"
      lead_temp: "hot" | "warm" | "cold"
      message_sender: "ia" | "human" | "client"
      message_type: "ia" | "ia-escalated" | "human" | "client"
      owner_type: "ia" | "human"
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
      app_role: ["administrador", "vendedor", "sdr", "cx"],
      lead_stage: [
        "Prospecção",
        "Qualificado",
        "Proposta",
        "Negociação",
        "Pedido",
        "Fechado",
        "Perdido",
      ],
      lead_temp: ["hot", "warm", "cold"],
      message_sender: ["ia", "human", "client"],
      message_type: ["ia", "ia-escalated", "human", "client"],
      owner_type: ["ia", "human"],
    },
  },
} as const
