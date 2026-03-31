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
      books: {
        Row: {
          author: string | null
          cover_url: string | null
          created_at: string
          file_path: string
          file_size_bytes: number | null
          id: string
          page_count: number | null
          processing_error: string | null
          processing_progress: number | null
          processing_status: Database["public"]["Enums"]["processing_status"] | null
          raw_text: string | null
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          file_path: string
          file_size_bytes?: number | null
          id?: string
          page_count?: number | null
          processing_error?: string | null
          processing_progress?: number | null
          processing_status?: Database["public"]["Enums"]["processing_status"] | null
          raw_text?: string | null
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author?: string | null
          cover_url?: string | null
          created_at?: string
          file_path?: string
          file_size_bytes?: number | null
          id?: string
          page_count?: number | null
          processing_error?: string | null
          processing_progress?: number | null
          processing_status?: Database["public"]["Enums"]["processing_status"] | null
          raw_text?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          school_name: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          school_name?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          school_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
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
      cognitive_level: "locate" | "interpret" | "reflect"
      entity_type: "character" | "event" | "space" | "conflict" | "theme"
      processing_status:
        | "pending"
        | "extracting"
        | "chunking"
        | "embedding"
        | "analyzing"
        | "ready"
        | "failed"
      question_type: "multiple_choice" | "true_false" | "development"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
