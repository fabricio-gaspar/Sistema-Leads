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
      appointments: {
        Row: {
          created_at: string | null
          ends_at: string
          external_id: string | null
          id: string
          lead_id: string
          meeting_url: string | null
          notes: string | null
          organization_id: string
          provider: string | null
          starts_at: string
          status: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          ends_at: string
          external_id?: string | null
          id?: string
          lead_id: string
          meeting_url?: string | null
          notes?: string | null
          organization_id?: string
          provider?: string | null
          starts_at: string
          status?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          ends_at?: string
          external_id?: string | null
          id?: string
          lead_id?: string
          meeting_url?: string | null
          notes?: string | null
          organization_id?: string
          provider?: string | null
          starts_at?: string
          status?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          actor_type: string
          created_at: string | null
          detail: string | null
          entity_id: string | null
          entity_table: string | null
          event_data: Json
          id: string
          occurred_at: string | null
          organization_id: string
          rule: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name: string
          actor_type: string
          created_at?: string | null
          detail?: string | null
          entity_id?: string | null
          entity_table?: string | null
          event_data?: Json
          id?: string
          occurred_at?: string | null
          organization_id?: string
          rule?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_type?: string
          created_at?: string | null
          detail?: string | null
          entity_id?: string | null
          entity_table?: string | null
          event_data?: Json
          id?: string
          occurred_at?: string | null
          organization_id?: string
          rule?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_heartbeats: {
        Row: {
          detail: Json
          job_name: string
          last_error: string | null
          last_finished_at: string | null
          last_started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          detail?: Json
          job_name: string
          last_error?: string | null
          last_finished_at?: string | null
          last_started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          detail?: Json
          job_name?: string
          last_error?: string | null
          last_finished_at?: string | null
          last_started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      call_records: {
        Row: {
          created_at: string
          created_by: string | null
          direction: string
          duration_seconds: number | null
          ended_at: string | null
          external_id: string | null
          id: string
          lead_id: string
          organization_id: string
          provider: string | null
          recording_consent: boolean
          recording_url: string | null
          started_at: string | null
          status: string
          ticket_id: string | null
          transcript: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_id?: string | null
          id?: string
          lead_id: string
          organization_id?: string
          provider?: string | null
          recording_consent?: boolean
          recording_url?: string | null
          started_at?: string | null
          status?: string
          ticket_id?: string | null
          transcript?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          direction?: string
          duration_seconds?: number | null
          ended_at?: string | null
          external_id?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          provider?: string | null
          recording_consent?: boolean
          recording_url?: string | null
          started_at?: string | null
          status?: string
          ticket_id?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "call_records_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "call_records_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_inbound_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string
          external_id: string
          id: string
          lead_id: string | null
          organization_id: string
          payload: Json
          processed_at: string | null
          provider: string
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_type: string
          external_id: string
          id?: string
          lead_id?: string | null
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          provider: string
          status?: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_type?: string
          external_id?: string
          id?: string
          lead_id?: string | null
          organization_id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_inbound_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_inbound_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
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
          organization_id?: string
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
      consent_events: {
        Row: {
          actor_id: string | null
          channel: string
          contact_point_id: string | null
          created_at: string
          event: string
          id: string
          lead_id: string | null
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          {
            foreignKeyName: "consent_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          {
            foreignKeyName: "contact_points_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_suppressions: {
        Row: {
          channel: string
          contact: string | null
          contact_hash: string
          created_at: string | null
          id: string
          lead_id: string | null
          organization_id: string
          reason: string | null
        }
        Insert: {
          channel: string
          contact?: string | null
          contact_hash: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          reason?: string | null
        }
        Update: {
          channel?: string
          contact?: string | null
          contact_hash?: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          organization_id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_suppressions_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_suppressions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          active: boolean
          color: string
          created_at: string
          description: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          content_text: string | null
          created_at: string | null
          id: string
          name: string
          organization_id: string
          size: string | null
          status: string | null
          storage_path: string | null
          type: string | null
        }
        Insert: {
          content_text?: string | null
          created_at?: string | null
          id?: string
          name: string
          organization_id?: string
          size?: string | null
          status?: string | null
          storage_path?: string | null
          type?: string | null
        }
        Update: {
          content_text?: string | null
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
          size?: string | null
          status?: string | null
          storage_path?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          connected: boolean | null
          id: string
          key: string
          label: string
          organization_id: string
          updated_at: string | null
        }
        Insert: {
          connected?: boolean | null
          id?: string
          key: string
          label: string
          organization_id?: string
          updated_at?: string | null
        }
        Update: {
          connected?: boolean | null
          id?: string
          key?: string
          label?: string
          organization_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string | null
          document_id: string
          embedding: string | null
          id: string
          metadata: Json
          organization_id: string | null
          status: string | null
          tokens: number | null
          version: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id: string
          embedding?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          status?: string | null
          tokens?: number | null
          version?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          organization_id?: string | null
          status?: string | null
          tokens?: number | null
          version?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "knowledge_chunks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          {
            foreignKeyName: "lead_assignments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_handoffs: {
        Row: {
          created_at: string | null
          from_user_id: string
          id: string
          lead_id: string
          organization_id: string
          sla_expires_at: string | null
          status: string | null
          to_user_id: string | null
        }
        Insert: {
          created_at?: string | null
          from_user_id: string
          id?: string
          lead_id: string
          organization_id?: string
          sla_expires_at?: string | null
          status?: string | null
          to_user_id?: string | null
        }
        Update: {
          created_at?: string | null
          from_user_id?: string
          id?: string
          lead_id?: string
          organization_id?: string
          sla_expires_at?: string | null
          status?: string | null
          to_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_handoffs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_handoffs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_messages: {
        Row: {
          created_at: string | null
          id: string
          lead_id: string
          organization_id: string
          provider_message_id: string | null
          sender: string
          sender_name: string
          sent_at: string | null
          text: string
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          lead_id: string
          organization_id?: string
          provider_message_id?: string | null
          sender: string
          sender_name: string
          sent_at?: string | null
          text: string
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          provider_message_id?: string | null
          sender?: string
          sender_name?: string
          sent_at?: string | null
          text?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_messages_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
          updated_at: string
          visibility: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          lead_id: string
          organization_id?: string
          updated_at?: string
          visibility?: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          lead_id?: string
          organization_id?: string
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
          {
            foreignKeyName: "lead_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_outreach: {
        Row: {
          actor_type: string
          attempt: number
          channel: string
          content: string | null
          created_at: string
          delivered_at: string | null
          error: string | null
          failed_at: string | null
          id: string
          lead_id: string
          metadata: Json
          organization_id: string
          owner_id: string | null
          provider: string | null
          provider_message_id: string | null
          read_at: string | null
          replied_at: string | null
          scheduled_for: string | null
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          actor_type?: string
          attempt?: number
          channel: string
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          failed_at?: string | null
          id?: string
          lead_id: string
          metadata?: Json
          organization_id?: string
          owner_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          actor_type?: string
          attempt?: number
          channel?: string
          content?: string | null
          created_at?: string
          delivered_at?: string | null
          error?: string | null
          failed_at?: string | null
          id?: string
          lead_id?: string
          metadata?: Json
          organization_id?: string
          owner_id?: string | null
          provider?: string | null
          provider_message_id?: string | null
          read_at?: string | null
          replied_at?: string | null
          scheduled_for?: string | null
          sent_at?: string | null
          status?: string
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
          {
            foreignKeyName: "lead_outreach_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          {
            foreignKeyName: "lead_qualifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sequence_enrollments: {
        Row: {
          completed_at: string | null
          created_at: string | null
          current_step_id: string | null
          current_step_index: number
          id: string
          last_error: string | null
          last_step_at: string | null
          lead_id: string
          next_run_at: string | null
          nurture_cycles: number
          organization_id: string
          pause_reason: string | null
          sequence_id: string
          started_at: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          current_step_id?: string | null
          current_step_index?: number
          id?: string
          last_error?: string | null
          last_step_at?: string | null
          lead_id: string
          next_run_at?: string | null
          nurture_cycles?: number
          organization_id?: string
          pause_reason?: string | null
          sequence_id: string
          started_at?: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          current_step_id?: string | null
          current_step_index?: number
          id?: string
          last_error?: string | null
          last_step_at?: string | null
          lead_id?: string
          next_run_at?: string | null
          nurture_cycles?: number
          organization_id?: string
          pause_reason?: string | null
          sequence_id?: string
          started_at?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_sequence_enrollments_current_step_id_fkey"
            columns: ["current_step_id"]
            isOneToOne: false
            referencedRelation: "outreach_sequence_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sequence_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_sequence_enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string
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
          organization_id?: string
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
          organization_id?: string
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
          {
            foreignKeyName: "lead_stage_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_tasks: {
        Row: {
          completed: boolean | null
          created_at: string | null
          due_at: string | null
          id: string
          lead_id: string
          organization_id: string
          owner_id: string | null
          owner_label: string | null
          text: string
          updated_at: string | null
        }
        Insert: {
          completed?: boolean | null
          created_at?: string | null
          due_at?: string | null
          id?: string
          lead_id: string
          organization_id?: string
          owner_id?: string | null
          owner_label?: string | null
          text: string
          updated_at?: string | null
        }
        Update: {
          completed?: boolean | null
          created_at?: string | null
          due_at?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          owner_id?: string | null
          owner_label?: string | null
          text?: string
          updated_at?: string | null
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
            foreignKeyName: "lead_tasks_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          active_channel: string | null
          ai_paused: boolean | null
          annual_revenue: string | null
          assigned_to: string | null
          company: string
          contact: string | null
          contact_approval_reason: string | null
          contact_approval_status: string | null
          contact_channels: Json | null
          created_at: string | null
          distance: number | null
          email: string | null
          escalated: boolean | null
          escalation_reason: string | null
          id: string
          instagram_user_id: string | null
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
          active_channel?: string | null
          ai_paused?: boolean | null
          annual_revenue?: string | null
          assigned_to?: string | null
          company: string
          contact?: string | null
          contact_approval_reason?: string | null
          contact_approval_status?: string | null
          contact_channels?: Json | null
          created_at?: string | null
          distance?: number | null
          email?: string | null
          escalated?: boolean | null
          escalation_reason?: string | null
          id?: string
          instagram_user_id?: string | null
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
        Update: {
          active_channel?: string | null
          ai_paused?: boolean | null
          annual_revenue?: string | null
          assigned_to?: string | null
          company?: string
          contact?: string | null
          contact_approval_reason?: string | null
          contact_approval_status?: string | null
          contact_channels?: Json | null
          created_at?: string | null
          distance?: number | null
          email?: string | null
          escalated?: boolean | null
          escalation_reason?: string | null
          id?: string
          instagram_user_id?: string | null
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
      message_attachments: {
        Row: {
          ai_processed_at: string | null
          created_at: string
          external_url: string | null
          extracted_text: string | null
          file_name: string | null
          id: string
          lead_id: string
          media_type: string
          message_id: string | null
          mime_type: string | null
          organization_id: string
          storage_path: string | null
          transcript: string | null
        }
        Insert: {
          ai_processed_at?: string | null
          created_at?: string
          external_url?: string | null
          extracted_text?: string | null
          file_name?: string | null
          id?: string
          lead_id: string
          media_type: string
          message_id?: string | null
          mime_type?: string | null
          organization_id?: string
          storage_path?: string | null
          transcript?: string | null
        }
        Update: {
          ai_processed_at?: string | null
          created_at?: string
          external_url?: string | null
          extracted_text?: string | null
          file_name?: string | null
          id?: string
          lead_id?: string
          media_type?: string
          message_id?: string | null
          mime_type?: string | null
          organization_id?: string
          storage_path?: string | null
          transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_attachments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "lead_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          link: string | null
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          link?: string | null
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          link?: string | null
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
          organization_id: string
          response: string
          trigger: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id?: string
          response: string
          trigger: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          response?: string
          trigger?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "objections_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          company: string
          contract_status: string | null
          created_at: string | null
          id: string
          items: Json | null
          lead_id: string | null
          number: string
          order_date: string | null
          organization_id: string
          owner_id: string | null
          payment: string | null
          proposal_id: string | null
          seller_name: string | null
          seller_type: string | null
          status: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          company: string
          contract_status?: string | null
          created_at?: string | null
          id?: string
          items?: Json | null
          lead_id?: string | null
          number: string
          order_date?: string | null
          organization_id?: string
          owner_id?: string | null
          payment?: string | null
          proposal_id?: string | null
          seller_name?: string | null
          seller_type?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          company?: string
          contract_status?: string | null
          created_at?: string | null
          id?: string
          items?: Json | null
          lead_id?: string | null
          number?: string
          order_date?: string | null
          organization_id?: string
          owner_id?: string | null
          payment?: string | null
          proposal_id?: string | null
          seller_name?: string | null
          seller_type?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
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
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      organization_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
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
      outreach_jobs: {
        Row: {
          attempt: number | null
          channel: string
          error: string | null
          id: string
          idempotency_key: string | null
          lead_id: string
          locked_at: string | null
          locked_by: string | null
          organization_id: string
          payload: Json | null
          processed_at: string | null
          run_at: string
          status: string | null
        }
        Insert: {
          attempt?: number | null
          channel: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id: string
          locked_at?: string | null
          locked_by?: string | null
          organization_id?: string
          payload?: Json | null
          processed_at?: string | null
          run_at: string
          status?: string | null
        }
        Update: {
          attempt?: number | null
          channel?: string
          error?: string | null
          id?: string
          idempotency_key?: string | null
          lead_id?: string
          locked_at?: string | null
          locked_by?: string | null
          organization_id?: string
          payload?: Json | null
          processed_at?: string | null
          run_at?: string
          status?: string | null
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
            foreignKeyName: "outreach_jobs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_sequence_steps: {
        Row: {
          active: boolean
          channel: string
          content: string | null
          continue_on: Json | null
          created_at: string
          delay_minutes: number
          id: string
          max_attempts: number | null
          order_index: number
          organization_id: string
          sequence_id: string
          template: string | null
          type: string
          updated_at: string
          wait_hours: number | null
        }
        Insert: {
          active?: boolean
          channel: string
          content?: string | null
          continue_on?: Json | null
          created_at?: string
          delay_minutes?: number
          id?: string
          max_attempts?: number | null
          order_index: number
          organization_id?: string
          sequence_id: string
          template?: string | null
          type: string
          updated_at?: string
          wait_hours?: number | null
        }
        Update: {
          active?: boolean
          channel?: string
          content?: string | null
          continue_on?: Json | null
          created_at?: string
          delay_minutes?: number
          id?: string
          max_attempts?: number | null
          order_index?: number
          organization_id?: string
          sequence_id?: string
          template?: string | null
          type?: string
          updated_at?: string
          wait_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequence_steps_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "outreach_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      privacy_requests: {
        Row: {
          fulfilled_at: string | null
          handled_by: string | null
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string
          received_at: string
          request_type: string
          requester_hash: string
          status: string
        }
        Insert: {
          fulfilled_at?: string | null
          handled_by?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string
          received_at?: string
          request_type: string
          requester_hash: string
          status?: string
        }
        Update: {
          fulfilled_at?: string | null
          handled_by?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string
          received_at?: string
          request_type?: string
          requester_hash?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "privacy_requests_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "privacy_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean | null
          active_organization_id: string | null
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
          active_organization_id?: string | null
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
          active_organization_id?: string | null
          avatar?: string | null
          can_use_ia?: boolean | null
          created_at?: string | null
          email?: string
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_active_organization_id_fkey"
            columns: ["active_organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      proposals: {
        Row: {
          client: string
          created_at: string | null
          creator: string
          creator_name: string | null
          discount: string | null
          id: string
          items: Json | null
          lead_id: string | null
          need_approval: boolean | null
          number: string
          organization_id: string
          owner_id: string | null
          status: string | null
          updated_at: string | null
          value: number | null
        }
        Insert: {
          client: string
          created_at?: string | null
          creator: string
          creator_name?: string | null
          discount?: string | null
          id?: string
          items?: Json | null
          lead_id?: string | null
          need_approval?: boolean | null
          number: string
          organization_id?: string
          owner_id?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
        }
        Update: {
          client?: string
          created_at?: string | null
          creator?: string
          creator_name?: string | null
          discount?: string | null
          id?: string
          items?: Json | null
          lead_id?: string | null
          need_approval?: boolean | null
          number?: string
          organization_id?: string
          owner_id?: string | null
          status?: string | null
          updated_at?: string | null
          value?: number | null
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
            foreignKeyName: "proposals_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_cache: {
        Row: {
          created_at: string | null
          data: Json
          external_id: string
          id: string
          organization_id: string | null
          source: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          external_id: string
          id?: string
          organization_id?: string | null
          source: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          external_id?: string
          id?: string
          organization_id?: string | null
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_cache_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_schedule_runs: {
        Row: {
          created_at: string | null
          error_message: string | null
          id: string
          imported_count: number | null
          organization_id: string
          schedule_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          imported_count?: number | null
          organization_id?: string
          schedule_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          error_message?: string | null
          id?: string
          imported_count?: number | null
          organization_id?: string
          schedule_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_schedule_runs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_schedule_runs_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "prospecting_schedules"
            referencedColumns: ["id"]
          },
        ]
      }
      prospecting_schedules: {
        Row: {
          active: boolean | null
          assignment_strategy: string | null
          auto_approve_min_score: number | null
          created_at: string | null
          daily_cap: number | null
          filters: Json
          id: string
          monthly_cap: number | null
          organization_id: string
          owner_id: string | null
          quantity: number | null
          sequence_id: string | null
        }
        Insert: {
          active?: boolean | null
          assignment_strategy?: string | null
          auto_approve_min_score?: number | null
          created_at?: string | null
          daily_cap?: number | null
          filters: Json
          id?: string
          monthly_cap?: number | null
          organization_id?: string
          owner_id?: string | null
          quantity?: number | null
          sequence_id?: string | null
        }
        Update: {
          active?: boolean | null
          assignment_strategy?: string | null
          auto_approve_min_score?: number | null
          created_at?: string | null
          daily_cap?: number | null
          filters?: Json
          id?: string
          monthly_cap?: number | null
          organization_id?: string
          owner_id?: string | null
          quantity?: number | null
          sequence_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prospecting_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prospecting_schedules_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "outreach_sequences"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_replies: {
        Row: {
          active: boolean
          body: string
          channel: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          shortcut: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          body: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          shortcut: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          shortcut?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quick_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      score_weights: {
        Row: {
          google: number | null
          id: string
          organization_id: string
          porte: number | null
          regiao: number | null
          segment: number | null
          site: number | null
          updated_at: string | null
          whatsapp: number | null
        }
        Insert: {
          google?: number | null
          id?: string
          organization_id?: string
          porte?: number | null
          regiao?: number | null
          segment?: number | null
          site?: number | null
          updated_at?: string | null
          whatsapp?: number | null
        }
        Update: {
          google?: number | null
          id?: string
          organization_id?: string
          porte?: number | null
          regiao?: number | null
          segment?: number | null
          site?: number | null
          updated_at?: string | null
          whatsapp?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "score_weights_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      service_queues: {
        Row: {
          active: boolean
          assignment_strategy: string
          channel: string
          created_at: string
          department_id: string | null
          id: string
          name: string
          organization_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          assignment_strategy?: string
          channel?: string
          created_at?: string
          department_id?: string | null
          id?: string
          name: string
          organization_id?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          assignment_strategy?: string
          channel?: string
          created_at?: string
          department_id?: string | null
          id?: string
          name?: string
          organization_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_queues_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_queues_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          category: string | null
          created_at: string
          description: string | null
          id: string
          max_discount: number | null
          name: string
          organization_id: string
          price: number | null
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
          max_discount?: number | null
          name: string
          organization_id?: string
          price?: number | null
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
          max_discount?: number | null
          name?: string
          organization_id?: string
          price?: number | null
          term?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          name: string
          organization_id?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_notes: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          organization_id: string
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          organization_id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          organization_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_notes_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_tags: {
        Row: {
          created_at: string
          organization_id: string
          tag_id: string
          ticket_id: string
        }
        Insert: {
          created_at?: string
          organization_id?: string
          tag_id: string
          ticket_id: string
        }
        Update: {
          created_at?: string
          organization_id?: string
          tag_id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_tags_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          assigned_to: string | null
          closed_at: string | null
          created_at: string
          department_id: string | null
          first_response_at: string | null
          first_response_due_at: string | null
          id: string
          lead_id: string
          organization_id: string
          priority: string
          protocol: string
          queue_id: string | null
          resolution_due_at: string | null
          resolved_at: string | null
          source_channel: string
          status: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          department_id?: string | null
          first_response_at?: string | null
          first_response_due_at?: string | null
          id?: string
          lead_id: string
          organization_id?: string
          priority?: string
          protocol?: string
          queue_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          source_channel?: string
          status?: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          closed_at?: string | null
          created_at?: string
          department_id?: string | null
          first_response_at?: string | null
          first_response_due_at?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          priority?: string
          protocol?: string
          queue_id?: string | null
          resolution_due_at?: string | null
          resolved_at?: string | null
          source_channel?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tickets_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tickets_queue_id_fkey"
            columns: ["queue_id"]
            isOneToOne: false
            referencedRelation: "service_queues"
            referencedColumns: ["id"]
          },
        ]
      }
      unanswered_questions: {
        Row: {
          count: number | null
          created_at: string | null
          id: string
          organization_id: string
          resolved: boolean | null
          text: string
        }
        Insert: {
          count?: number | null
          created_at?: string | null
          id?: string
          organization_id?: string
          resolved?: boolean | null
          text: string
        }
        Update: {
          count?: number | null
          created_at?: string | null
          id?: string
          organization_id?: string
          resolved?: boolean | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "unanswered_questions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_type: string | null
          external_id: string | null
          id: string
          lead_id: string | null
          organization_id: string | null
          outreach_id: string | null
          payload: Json | null
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
          organization_id?: string | null
          outreach_id?: string | null
          payload?: Json | null
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
          organization_id?: string | null
          outreach_id?: string | null
          payload?: Json | null
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
            foreignKeyName: "webhook_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      anonymize_lead_lgpd: {
        Args: { _lead_id: string; _reason?: string }
        Returns: undefined
      }
      clear_contact_suppressions: {
        Args: { _hashes: string[]; _lead_id: string }
        Returns: undefined
      }
      current_org_id: { Args: never; Returns: string }
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
      set_active_organization: {
        Args: { _organization_id: string }
        Returns: string
      }
    }
    Enums: {
      app_role: "administrador" | "vendedor" | "ia" | "sdr" | "cx"
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
      app_role: ["administrador", "vendedor", "ia", "sdr", "cx"],
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
