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
      appointments: {
        Row: {
          created_at: string
          ends_at: string | null
          external_id: string | null
          id: string
          lead_id: string
          notes: string | null
          origin: string
          owner_id: string | null
          provider: string | null
          starts_at: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          external_id?: string | null
          id?: string
          lead_id: string
          notes?: string | null
          origin?: string
          owner_id?: string | null
          provider?: string | null
          starts_at: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          external_id?: string | null
          id?: string
          lead_id?: string
          notes?: string | null
          origin?: string
          owner_id?: string | null
          provider?: string | null
          starts_at?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
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
          assignment_strategy: string
          city: string | null
          cnpj: string | null
          created_at: string
          description: string | null
          differentiators: string | null
          email: string | null
          handoff_readiness_score: number
          handoff_sla_minutes: number
          id: string
          logo_url: string | null
          name: string
          outreach_max_attempts: number
          outreach_wait_hours: number
          phone: string | null
          prospecting_sources: Json
          sandbox_mode: boolean
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
          assignment_strategy?: string
          city?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          differentiators?: string | null
          email?: string | null
          handoff_readiness_score?: number
          handoff_sla_minutes?: number
          id?: string
          logo_url?: string | null
          name: string
          outreach_max_attempts?: number
          outreach_wait_hours?: number
          phone?: string | null
          prospecting_sources?: Json
          sandbox_mode?: boolean
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
          assignment_strategy?: string
          city?: string | null
          cnpj?: string | null
          created_at?: string
          description?: string | null
          differentiators?: string | null
          email?: string | null
          handoff_readiness_score?: number
          handoff_sla_minutes?: number
          id?: string
          logo_url?: string | null
          name?: string
          outreach_max_attempts?: number
          outreach_wait_hours?: number
          phone?: string | null
          prospecting_sources?: Json
          sandbox_mode?: boolean
          segment?: string | null
          size?: string | null
          state?: string | null
          tone_of_voice?: string | null
          updated_at?: string
          website?: string | null
        }
        Relationships: []
      }
      consent_events: {
        Row: {
          actor_id: string | null
          channel: string
          contact_point_id: string | null
          created_at: string
          event: string
          id: string
          lead_id: string | null
          source: string
          text: string | null
        }
        Insert: {
          actor_id?: string | null
          channel: string
          contact_point_id?: string | null
          created_at?: string
          event: string
          id?: string
          lead_id?: string | null
          source: string
          text?: string | null
        }
        Update: {
          actor_id?: string | null
          channel?: string
          contact_point_id?: string | null
          created_at?: string
          event?: string
          id?: string
          lead_id?: string | null
          source?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_events_contact_point_id_fkey"
            columns: ["contact_point_id"]
            isOneToOne: false
            referencedRelation: "contact_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_points: {
        Row: {
          created_at: string
          id: string
          kind: string
          lead_id: string
          preferred: boolean
          sandbox: boolean
          source: string | null
          status: string
          updated_at: string
          value: string
          value_hash: string
          value_normalized: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          lead_id: string
          preferred?: boolean
          sandbox?: boolean
          source?: string | null
          status?: string
          updated_at?: string
          value: string
          value_hash: string
          value_normalized: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          lead_id?: string
          preferred?: boolean
          sandbox?: boolean
          source?: string | null
          status?: string
          updated_at?: string
          value?: string
          value_hash?: string
          value_normalized?: string
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "contact_points_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_suppressions: {
        Row: {
          channel: string
          contact_hash: string
          created_at: string
          lead_id: string | null
          reason: string
        }
        Insert: {
          channel: string
          contact_hash: string
          created_at?: string
          lead_id?: string | null
          reason?: string
        }
        Update: {
          channel?: string
          contact_hash?: string
          created_at?: string
          lead_id?: string | null
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_suppressions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content_text: string | null
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
          content_text?: string | null
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
          content_text?: string | null
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
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          id: string
          status: string
          tokens: number | null
          version: number
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          id?: string
          status?: string
          tokens?: number | null
          version?: number
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          id?: string
          status?: string
          tokens?: number | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_assignments: {
        Row: {
          changed_by: string | null
          created_at: string
          from_user: string | null
          id: string
          lead_id: string
          reason: string | null
          source: string
          to_user: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_user?: string | null
          id?: string
          lead_id: string
          reason?: string | null
          source?: string
          to_user?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_user?: string | null
          id?: string
          lead_id?: string
          reason?: string | null
          source?: string
          to_user?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_assignments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_handoffs: {
        Row: {
          accepted_at: string | null
          assigned_to: string | null
          category: string
          closed_at: string | null
          context: Json
          created_at: string
          due_at: string | null
          id: string
          lead_id: string
          reason: string
          requested_at: string
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          context?: Json
          created_at?: string
          due_at?: string | null
          id?: string
          lead_id: string
          reason: string
          requested_at?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          assigned_to?: string | null
          category?: string
          closed_at?: string | null
          context?: Json
          created_at?: string
          due_at?: string | null
          id?: string
          lead_id?: string
          reason?: string
          requested_at?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_handoffs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_messages: {
        Row: {
          created_at: string
          id: string
          lead_id: string
          provider_message_id: string | null
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
          provider_message_id?: string | null
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
          provider_message_id?: string | null
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
      lead_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          lead_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          lead_id: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
          updated_at?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_notes_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_outreach: {
        Row: {
          actor_type: string
          attempt: number
          channel: Database["public"]["Enums"]["outreach_channel"]
          content: string | null
          created_at: string
          delivered_at: string | null
          error: string | null
          failed_at: string | null
          id: string
          lead_id: string
          metadata: Json
          owner_id: string
          provider: string | null
          provider_message_id: string | null
          read_at: string | null
          replied_at: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["outreach_status"]
          updated_at: string
        }
        Insert: {
          actor_type?: string
          attempt?: number
          channel: Database["public"]["Enums"]["outreach_channel"]
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          failed_at?: string | null
          id?: string
          lead_id: string
          metadata?: Json
          owner_id: string
          provider?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outreach_status"]
          updated_at?: string
        }
        Update: {
          actor_type?: string
          attempt?: number
          channel?: Database["public"]["Enums"]["outreach_channel"]
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          failed_at?: string | null
          id?: string
          lead_id?: string
          metadata?: Json
          owner_id?: string
          provider?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outreach_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_outreach_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_qualifications: {
        Row: {
          budget_range: string | null
          created_at: string
          decision_maker: string | null
          evidence: Json
          id: string
          intent: string | null
          lead_id: string
          next_action: string | null
          objections: Json
          pain: string | null
          readiness_score: number | null
          sentiment: string | null
          service_interest: string | null
          summary: string | null
          updated_at: string
          updated_by: string
          urgency: string | null
        }
        Insert: {
          budget_range?: string | null
          created_at?: string
          decision_maker?: string | null
          evidence?: Json
          id?: string
          intent?: string | null
          lead_id: string
          next_action?: string | null
          objections?: Json
          pain?: string | null
          readiness_score?: number | null
          sentiment?: string | null
          service_interest?: string | null
          summary?: string | null
          updated_at?: string
          updated_by?: string
          urgency?: string | null
        }
        Update: {
          budget_range?: string | null
          created_at?: string
          decision_maker?: string | null
          evidence?: Json
          id?: string
          intent?: string | null
          lead_id?: string
          next_action?: string | null
          objections?: Json
          pain?: string | null
          readiness_score?: number | null
          sentiment?: string | null
          service_interest?: string | null
          summary?: string | null
          updated_at?: string
          updated_by?: string
          urgency?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_qualifications_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sequence_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string
          current_step_index: number
          id: string
          last_error: string | null
          last_step_at: string | null
          lead_id: string
          next_run_at: string | null
          pause_reason: string | null
          sequence_id: string
          started_at: string
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          current_step_index?: number
          id?: string
          last_error?: string | null
          last_step_at?: string | null
          lead_id: string
          next_run_at?: string | null
          pause_reason?: string | null
          sequence_id: string
          started_at?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          current_step_index?: number
          id?: string
          last_error?: string | null
          last_step_at?: string | null
          lead_id?: string
          next_run_at?: string | null
          pause_reason?: string | null
          sequence_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sequence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: true
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sequence_enrollments_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "outreach_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_stage_history: {
        Row: {
          changed_by: string | null
          created_at: string
          from_stage: string | null
          id: string
          lead_id: string
          reason: string | null
          source: string
          to_stage: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          lead_id: string
          reason?: string | null
          source?: string
          to_stage: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          from_stage?: string | null
          id?: string
          lead_id?: string
          reason?: string | null
          source?: string
          to_stage?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_stage_history_lead_id_fkey"
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
          active_channel: Database["public"]["Enums"]["outreach_channel"] | null
          ai_paused: boolean
          annual_revenue: number | null
          assigned_to: string | null
          city: string | null
          company: string
          contact: string | null
          contact_channels: Json
          created_at: string
          distance: number | null
          email: string | null
          escalated: boolean
          escalation_reason: string | null
          id: string
          last_contact: string | null
          lost_reason: string | null
          next_action_at: string | null
          opt_out: boolean
          origin: string | null
          owner: Database["public"]["Enums"]["owner_type"]
          owner_id: string | null
          phone: string | null
          score: number
          score_explanation: string | null
          score_snapshot: Json
          score_source: string | null
          score_verified_at: string | null
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
          whatsapp: string | null
        }
        Insert: {
          active_channel?:
            | Database["public"]["Enums"]["outreach_channel"]
            | null
          ai_paused?: boolean
          annual_revenue?: number | null
          assigned_to?: string | null
          city?: string | null
          company: string
          contact?: string | null
          contact_channels?: Json
          created_at?: string
          distance?: number | null
          email?: string | null
          escalated?: boolean
          escalation_reason?: string | null
          id?: string
          last_contact?: string | null
          lost_reason?: string | null
          next_action_at?: string | null
          opt_out?: boolean
          origin?: string | null
          owner?: Database["public"]["Enums"]["owner_type"]
          owner_id?: string | null
          phone?: string | null
          score?: number
          score_explanation?: string | null
          score_snapshot?: Json
          score_source?: string | null
          score_verified_at?: string | null
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
          whatsapp?: string | null
        }
        Update: {
          active_channel?:
            | Database["public"]["Enums"]["outreach_channel"]
            | null
          ai_paused?: boolean
          annual_revenue?: number | null
          assigned_to?: string | null
          city?: string | null
          company?: string
          contact?: string | null
          contact_channels?: Json
          created_at?: string
          distance?: number | null
          email?: string | null
          escalated?: boolean
          escalation_reason?: string | null
          id?: string
          last_contact?: string | null
          lost_reason?: string | null
          next_action_at?: string | null
          opt_out?: boolean
          origin?: string | null
          owner?: Database["public"]["Enums"]["owner_type"]
          owner_id?: string | null
          phone?: string | null
          score?: number
          score_explanation?: string | null
          score_snapshot?: Json
          score_source?: string | null
          score_verified_at?: string | null
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
          whatsapp?: string | null
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
      outreach_jobs: {
        Row: {
          attempt: number
          channel: string
          created_at: string
          error: string | null
          id: string
          idempotency_key: string | null
          lead_id: string
          locked_at: string | null
          locked_by: string | null
          outreach_id: string | null
          payload: Json
          processed_at: string | null
          run_at: string
          status: string
          updated_at: string
        }
        Insert: {
          attempt?: number
          channel: string
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id: string
          locked_at?: string | null
          locked_by?: string | null
          outreach_id?: string | null
          payload?: Json
          processed_at?: string | null
          run_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          attempt?: number
          channel?: string
          created_at?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id?: string
          locked_at?: string | null
          locked_by?: string | null
          outreach_id?: string | null
          payload?: Json
          processed_at?: string | null
          run_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_jobs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outreach_jobs_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "lead_outreach"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sequence_steps: {
        Row: {
          active: boolean
          channel: Database["public"]["Enums"]["sequence_step_channel"]
          continue_on: Json
          created_at: string
          delay_minutes: number
          id: string
          max_attempts: number
          order_index: number
          sequence_id: string
          template: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          channel: Database["public"]["Enums"]["sequence_step_channel"]
          continue_on?: Json
          created_at?: string
          delay_minutes?: number
          id?: string
          max_attempts?: number
          order_index: number
          sequence_id: string
          template?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          channel?: Database["public"]["Enums"]["sequence_step_channel"]
          continue_on?: Json
          created_at?: string
          delay_minutes?: number
          id?: string
          max_attempts?: number
          order_index?: number
          sequence_id?: string
          template?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequence_steps_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "outreach_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sequences: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
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
          answer: string | null
          count: number
          created_at: string
          id: string
          resolved: boolean
          text: string
          updated_at: string
        }
        Insert: {
          answer?: string | null
          count?: number
          created_at?: string
          id?: string
          resolved?: boolean
          text: string
          updated_at?: string
        }
        Update: {
          answer?: string | null
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
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          external_id: string | null
          id: string
          lead_id: string | null
          outreach_id: string | null
          payload_sha: string | null
          processed_at: string | null
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          external_id?: string | null
          id?: string
          lead_id?: string | null
          outreach_id?: string | null
          payload_sha?: string | null
          processed_at?: string | null
          provider: string
          status?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string | null
          external_id?: string | null
          id?: string
          lead_id?: string | null
          outreach_id?: string | null
          payload_sha?: string | null
          processed_at?: string | null
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_events_outreach_id_fkey"
            columns: ["outreach_id"]
            isOneToOne: false
            referencedRelation: "lead_outreach"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clear_contact_suppressions: {
        Args: { _hashes: string[]; _lead_id: string }
        Returns: number
      }
      has_contact_suppression: {
        Args: { _hashes: string[]; _lead_id: string }
        Returns: boolean
      }
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
      enrollment_status: "active" | "paused" | "completed" | "cancelled"
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
      outreach_channel: "whatsapp" | "email" | "phone"
      outreach_status:
        | "pending"
        | "sent"
        | "delivered"
        | "read"
        | "replied"
        | "failed"
        | "skipped"
      owner_type: "ia" | "human"
      sequence_step_channel: "whatsapp" | "email" | "phone"
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
      enrollment_status: ["active", "paused", "completed", "cancelled"],
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
      outreach_channel: ["whatsapp", "email", "phone"],
      outreach_status: [
        "pending",
        "sent",
        "delivered",
        "read",
        "replied",
        "failed",
        "skipped",
      ],
      owner_type: ["ia", "human"],
      sequence_step_channel: ["whatsapp", "email", "phone"],
    },
  },
} as const
