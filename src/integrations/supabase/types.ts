export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]
export type Database = {
  public: {
    Tables: {
      organizations: { Row: { id: string; name: string; slug: string; created_at: string; updated_at: string }; Insert: any; Update: any }
      organization_members: { Row: { organization_id: string; user_id: string; role: string; created_at: string }; Insert: any; Update: any }
      leads: { Row: { id: string; organization_id: string; company: string; contact: string | null; score: number; stage: string; temp: string; value: number; owner: string; last_contact: string | null; created_at: string; updated_at: string }; Insert: any; Update: any }
      profiles: { Row: { id: string; name: string; email: string; phone: string | null; active: boolean; can_use_ia: boolean; created_at: string; updated_at: string }; Insert: any; Update: any }
      notifications: { Row: { id: string; organization_id: string; owner_id: string; kind: string; title: string; description: string | null; read: boolean; created_at: string }; Insert: any; Update: any }
      audit_logs: { Row: { id: string; organization_id: string; actor_id: string | null; actor_name: string; actor_type: string; action: string; created_at: string }; Insert: any; Update: any }
      lead_messages: { Row: { id: string; organization_id: string; lead_id: string; sender: string; text: string; created_at: string }; Insert: any; Update: any }
      lead_tasks: { Row: { id: string; organization_id: string; lead_id: string; text: string; completed: boolean; created_at: string }; Insert: any; Update: any }
      proposals: { Row: { id: string; organization_id: string; lead_id: string | null; client: string; value: number; status: string; created_at: string }; Insert: any; Update: any }
      orders: { Row: { id: string; organization_id: string; lead_id: string | null; value: number; status: string; created_at: string }; Insert: any; Update: any }
      company_settings: { Row: { id: string; organization_id: string; name: string; active: boolean; can_use_ia: boolean }; Insert: any; Update: any }
      outreach_sequences: { Row: { id: string; organization_id: string; name: string }; Insert: any; Update: any }
      outreach_sequence_steps: { Row: { id: string; organization_id: string; type: string; content: string; order_index: number }; Insert: any; Update: any }
      lead_sequence_enrollments: { Row: { id: string; organization_id: string; lead_id: string; status: string }; Insert: any; Update: any }
      user_roles: { Row: { id: string; organization_id: string; user_id: string; role: string }; Insert: any; Update: any }
      documents: { Row: { id: string; organization_id: string; name: string; content_text: string | null }; Insert: any; Update: any }
    }
    Views: { [_ in never]: never }
    Functions: {
      has_role: { Args: { _user_id: string; _role: string }; Returns: boolean }
      current_org_id: { Args: Record<PropertyKey, never>; Returns: string }
    }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
