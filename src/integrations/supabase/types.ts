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
          end_at: string
          id: string
          lead_id: string
          meeting_url: string | null
          organization_id: string
          start_at: string
          status: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          end_at: string
          id?: string
          lead_id: string
          meeting_url?: string | null
          organization_id: string
          start_at: string
          status?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          end_at?: string
          id?: string
          lead_id?: string
          meeting_url?: string | null
          organization_id?: string
          start_at?: string
          status?: string | null
          title?: string
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
          id?: string
          occurred_at?: string | null
          organization_id: string
          rule?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          actor_type?: string
          created_at?: string | null
          detail?: string | null
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
      contact_suppressions: {
        Row: {
          channel: string
          contact: string
          contact_hash: string
          created_at: string | null
          id: string
          lead_id: string | null
          organization_id: string
          reason: string | null
        }
        Insert: {
          channel: string
          contact: string
          contact_hash: string
          created_at?: string | null
          id?: string
          lead_id?: string | null
          organization_id: string
          reason?: string | null
        }
        Update: {
          channel?: string
          contact?: string
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
          organization_id: string
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
          organization_id: string
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
          id: string
          status: string | null
          tokens: number | null
          version: number | null
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string | null
          document_id: string
          id?: string
          status?: string | null
          tokens?: number | null
          version?: number | null
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string | null
          document_id?: string
          id?: string
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
          organization_id: string
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
          organization_id: string
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
      lead_sequence_enrollments: {
        Row: {
          created_at: string | null
          current_step_id: string | null
          id: string
          last_error: string | null
          lead_id: string
          next_run_at: string | null
          organization_id: string
          sequence_id: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_step_id?: string | null
          id?: string
          last_error?: string | null
          lead_id: string
          next_run_at?: string | null
          organization_id: string
          sequence_id: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_step_id?: string | null
          id?: string
          last_error?: string | null
          lead_id?: string
          next_run_at?: string | null
          organization_id?: string
          sequence_id?: string
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
          organization_id: string
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
          organization_id: string
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
          organization_id: string
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
          channel: string
          content: string | null
          continue_on: Json | null
          id: string
          max_attempts: number | null
          order_index: number
          organization_id: string
          sequence_id: string
          type: string
          wait_hours: number | null
        }
        Insert: {
          channel: string
          content?: string | null
          continue_on?: Json | null
          id?: string
          max_attempts?: number | null
          order_index: number
          organization_id: string
          sequence_id: string
          type: string
          wait_hours?: number | null
        }
        Update: {
          channel?: string
          content?: string | null
          continue_on?: Json | null
          id?: string
          max_attempts?: number | null
          order_index?: number
          organization_id?: string
          sequence_id?: string
          type?: string
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
          created_at: string | null
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          organization_id?: string
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
          organization_id: string
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
          source: string
        }
        Insert: {
          created_at?: string | null
          data: Json
          external_id: string
          id?: string
          source: string
        }
        Update: {
          created_at?: string | null
          data?: Json
          external_id?: string
          id?: string
          source?: string
        }
        Relationships: []
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
          organization_id: string
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
          organization_id: string
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
          organization_id: string
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
          organization_id: string
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
