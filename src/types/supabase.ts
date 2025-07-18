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
      ai_feedback_logs: {
        Row: {
          ai_response: string | null
          created_at: string
          feedback: string
          fix_embedding: number[] | null
          id: string
          module_id: string
          session_token: string
          step_index: number
          user_fix_text: string | null
          user_prompt: string | null
        }
        Insert: {
          ai_response?: string | null
          created_at?: string
          feedback: string
          fix_embedding?: number[] | null
          id?: string
          module_id: string
          session_token: string
          step_index: number
          user_fix_text?: string | null
          user_prompt?: string | null
        }
        Update: {
          ai_response?: string | null
          created_at?: string
          feedback?: string
          fix_embedding?: number[] | null
          id?: string
          module_id?: string
          session_token?: string
          step_index?: number
          user_fix_text?: string | null
          user_prompt?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_feedback_logs_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "modules"
            referencedColumns: ["slug"]
          }
        ]
      }
      chat_messages: {
        Row: {
          citations: Json | null
          created_at: string
          feedback: string | null
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
          feedback?: string | null
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
          feedback?: string | null
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
      checkpoint_responses: {
        Row: {
          answer: string
          checkpoint_text: string
          comment: string | null
          created_at: string
          id: string
          module_id: string
          step_index: number
          user_id: string
        }
        Insert: {
          answer: string
          checkpoint_text: string
          comment?: string | null
          created_at?: string
          id?: string
          module_id: string
          step_index: number
          user_id: string
        }
        Update: {
          answer?: string
          checkpoint_text?: string
          comment?: string | null
          created_at?: string
          id?: string
          module_id?: string
          step_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkpoint_responses_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "modules"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "checkpoint_responses_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      flagged_questions: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          module_id: string
          step_index: number
          tutor_log_id: string | null
          tutor_response: string | null
          user_id: string | null
          user_question: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          module_id: string
          step_index: number
          tutor_log_id?: string | null
          tutor_response?: string | null
          user_id?: string | null
          user_question: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          module_id?: string
          step_index?: number
          tutor_log_id?: string | null
          tutor_response?: string | null
          user_id?: string | null
          user_question?: string
        }
        Relationships: [
          {
            foreignKeyName: "flagged_questions_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "modules"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "flagged_questions_tutor_log_id_fkey"
            columns: ["tutor_log_id"]
            referencedRelation: "tutor_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flagged_questions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
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
      suggested_fixes: {
        Row: {
          created_at: string
          id: string
          module_id: string
          original_instruction: string | null
          source_questions: string[] | null
          step_index: number
          suggestion: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          module_id: string
          original_instruction?: string | null
          source_questions?: string[] | null
          step_index: number
          suggestion?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          module_id?: string
          original_instruction?: string | null
          source_questions?: string[] | null
          step_index?: number
          suggestion?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggested_fixes_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "modules"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "suggested_fixes_user_id_fkey"
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
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          module_id: string
          status?: string
          step_index: number
          text?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          module_id?: string
          status?: string
          step_index?: number
          text?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suggestions_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "modules"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "suggestions_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
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
          score: number | null
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
          score?: number | null
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
          score?: number | null
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
      tutor_logs: {
        Row: {
          created_at: string | null
          id: string
          module_id: string
          question_embedding: unknown | null
          step_index: number | null
          tutor_response: string
          user_question: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          module_id: string
          question_embedding?: unknown | null
          step_index?: number | null
          tutor_response: string
          user_question: string
        }
        Update: {
          created_at?: string | null
          id?: string
          module_id?: string
          question_embedding?: unknown | null
          step_index?: number | null
          tutor_response?: string
          user_question?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_logs_module_id_fkey"
            columns: ["module_id"]
            referencedRelation: "modules"
            referencedColumns: ["slug"]
          }
        ]
      }
    }
    Views: {
      modules_with_session_stats: {
        Row: {
          created_at: string | null
          is_ai_generated: boolean | null
          last_used_at: string | null
          metadata: Json | null
          session_count: number | null
          slug: string | null
          steps: Json | null
          title: string | null
          transcript: Json | null
          user_id: string | null
          video_url: string | null
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
    }
    Functions: {
      match_ai_feedback_fixes: {
        Args: {
          query_embedding: number[]
          p_module_id: string
          p_step_index: number
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          user_fix_text: string
          similarity: number
        }[]
      }
      match_tutor_logs: {
        Args: {
          query_embedding: number[]
          p_module_id: string
          match_threshold: number
          match_count: number
        }
        Returns: {
          id: string
          user_question: string
          tutor_response: string
          similarity: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}