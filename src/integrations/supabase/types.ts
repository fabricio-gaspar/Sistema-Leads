export type Database = {
  public: {
    Tables: {
      leads: { Row: { id: string; company: string; organization_id: string; [k: string]: any }; Insert: any; Update: any }
      profiles: { Row: { id: string; email: string; active: boolean; [k: string]: any }; Insert: any; Update: any }
      audit_logs: { Row: { id: string; organization_id: string; [k: string]: any }; Insert: any; Update: any }
      notifications: { Row: { id: string; organization_id: string; kind: string; title: string; read: boolean; created_at: string; [k: string]: any }; Insert: any; Update: any }
      [k: string]: any
    }
    Views: { [k: string]: any }
    Functions: { [k: string]: any }
    Enums: { [k: string]: any }
    CompositeTypes: { [k: string]: any }
  }
}
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
