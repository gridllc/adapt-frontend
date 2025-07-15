export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      chat_messages: {
        Row: {
          citations: Json | null
          created_at: string
          id: string
          imageUrl: string | null
          is_fallback: boolean | null
          isLoading: boolean | null
          module_id: string
          role: string
          session_token: string
          text: string | null
        }
        Insert: {
          citations?: Json | null
          created_at?: string
          id: string
          imageUrl?: string | null
          is_fallback?: boolean | null
          isLoading?: boolean | null
          module_id: string
          role: string
          session_token: string
          text?: string | null
        }
        Update: {
          citations?: Json | null
          created_at?: string
          id?: string
          imageUrl?: string | null
          is_fallback?: boolean | null
          isLoading?: boolean | null
          module_id?: string
          role?: string
          session_token?: string
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "modules"
            referencedColumns: ["slug"]
          }
        ]
      }
      modules: {
        Row: {
          created_at: string
          metadata: Json | null
          slug: string
          steps: Json | null
          title: string
          transcript: Json | null
          user_id: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          metadata?: Json | null
          slug: string
          steps?: Json | null
          title: string
          transcript?: Json | null
          user_id?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          metadata?: Json | null
          slug?: string
          steps?: Json | null
          title?: string
          transcript?: Json | null
          user_id?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "modules_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      suggestions: {
        Row: {
          created_at: string
          id: number
          module_id: string
          status: string
          step_index: number
          text: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          module_id: string
          status?: string
          step_index: number
          text?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          module_id?: string
          status?: string
          step_index?: number
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "modules"
            referencedColumns: ["slug"]
          }
        ]
      }
      training_sessions: {
        Row: {
          created_at: string
          current_step_index: number
          id: number
          is_completed: boolean
          live_coach_events: Json | null
          module_id: string
          session_token: string
          updated_at: string
          user_actions: Json | null
        }
        Insert: {
          created_at?: string
          current_step_index?: number
          id?: number
          is_completed?: boolean
          live_coach_events?: Json | null
          module_id: string
          session_token: string
          updated_at?: string
          user_actions?: Json | null
        }
        Update: {
          created_at?: string
          current_step_index?: number
          id?: number
          is_completed?: boolean
          live_coach_events?: Json | null
          module_id?: string
          session_token?: string
          updated_at?: string
          user_actions?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "modules"
            referencedColumns: ["slug"]
          }
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
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
