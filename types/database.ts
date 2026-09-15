/**
 * Database schema types for the Phase 1 and Phase 2 tables.
 *
 * This file is hand-written but deliberately mirrors the exact shape that
 * `supabase gen types typescript` produces, so it can be replaced wholesale
 * once the Supabase CLI is wired into the workflow:
 *
 *   npx supabase gen types typescript --local > types/database.ts
 *   # or, against a linked hosted project:
 *   npx supabase gen types typescript --linked > types/database.ts
 *
 * Keep the generated output at this path so nothing else has to change.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          first_name: string | null
          last_name: string | null
          email: string
          role: Database['public']['Enums']['user_role']
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          first_name?: string | null
          last_name?: string | null
          email: string
          role?: Database['public']['Enums']['user_role']
          created_at?: string
          updated_at?: string
        }
        /**
         * Only `first_name` and `last_name` are actually writable by a signed
         * in user — the database grants no UPDATE privilege on the other
         * columns to the `authenticated` role. The wider type mirrors the
         * generated output; the narrow runtime rule is enforced in SQL.
         */
        Update: {
          first_name?: string | null
          last_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'profiles_id_fkey'
            columns: ['id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      courses: {
        Row: {
          id: string
          title: string
          slug: string
          description: string | null
          status: Database['public']['Enums']['course_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          title: string
          slug: string
          description?: string | null
          status?: Database['public']['Enums']['course_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          title?: string
          slug?: string
          description?: string | null
          status?: Database['public']['Enums']['course_status']
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          id: string
          student_id: string
          course_id: string
          status: Database['public']['Enums']['enrollment_status']
          enrolled_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          student_id: string
          course_id: string
          status?: Database['public']['Enums']['enrollment_status']
          enrolled_at?: string
          expires_at?: string | null
        }
        Update: {
          status?: Database['public']['Enums']['enrollment_status']
          expires_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'enrollments_student_id_fkey'
            columns: ['student_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'enrollments_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
        ]
      }
      modules: {
        Row: {
          id: string
          course_id: string
          title: string
          description: string | null
          position: number
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          description?: string | null
          position: number
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          position?: number
          status?: Database['public']['Enums']['content_status']
        }
        Relationships: [
          {
            foreignKeyName: 'modules_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
        ]
      }
      lessons: {
        Row: {
          id: string
          module_id: string
          course_id: string
          title: string
          slug: string
          summary: string | null
          position: number
          status: Database['public']['Enums']['content_status']
          estimated_minutes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          module_id: string
          /**
           * Required, and must match the module's own course. The composite
           * foreign key lessons_module_fkey rejects any other value, so this
           * is not a field a caller may choose freely.
           */
          course_id: string
          title: string
          slug: string
          summary?: string | null
          position: number
          status?: Database['public']['Enums']['content_status']
          estimated_minutes?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          title?: string
          slug?: string
          summary?: string | null
          position?: number
          status?: Database['public']['Enums']['content_status']
          estimated_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: 'lessons_module_fkey'
            columns: ['module_id', 'course_id']
            isOneToOne: false
            referencedRelation: 'modules'
            referencedColumns: ['id', 'course_id']
          },
        ]
      }
      lesson_contents: {
        Row: {
          lesson_id: string
          course_id: string
          body: string
          created_at: string
          updated_at: string
        }
        Insert: {
          lesson_id: string
          course_id: string
          body: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          body?: string
        }
        Relationships: [
          {
            foreignKeyName: 'lesson_contents_lesson_fkey'
            columns: ['lesson_id', 'course_id']
            isOneToOne: true
            referencedRelation: 'lessons'
            referencedColumns: ['id', 'course_id']
          },
        ]
      }
      topics: {
        Row: {
          id: string
          course_id: string
          parent_topic_id: string | null
          code: string
          name: string
          question_count: number | null
          blueprint_weight: number | null
          position: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          parent_topic_id?: string | null
          code: string
          name: string
          question_count?: number | null
          blueprint_weight?: number | null
          position: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          parent_topic_id?: string | null
          code?: string
          name?: string
          question_count?: number | null
          blueprint_weight?: number | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: 'topics_course_id_fkey'
            columns: ['course_id']
            isOneToOne: false
            referencedRelation: 'courses'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'topics_parent_topic_id_fkey'
            columns: ['parent_topic_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id']
          },
        ]
      }
      lesson_topics: {
        Row: {
          lesson_id: string
          topic_id: string
          course_id: string
          created_at: string
        }
        Insert: {
          lesson_id: string
          topic_id: string
          course_id: string
          created_at?: string
        }
        Update: Record<never, never>
        Relationships: [
          {
            foreignKeyName: 'lesson_topics_lesson_fkey'
            columns: ['lesson_id', 'course_id']
            isOneToOne: false
            referencedRelation: 'lessons'
            referencedColumns: ['id', 'course_id']
          },
          {
            foreignKeyName: 'lesson_topics_topic_fkey'
            columns: ['topic_id', 'course_id']
            isOneToOne: false
            referencedRelation: 'topics'
            referencedColumns: ['id', 'course_id']
          },
        ]
      }
    }
    Views: Record<never, never>
    Functions: {
      is_admin: {
        Args: { uid?: string }
        Returns: boolean
      }
      is_enrolled_in_course: {
        Args: { p_course_id: string }
        Returns: boolean
      }
      lesson_is_published: {
        Args: { p_lesson_id: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: 'student' | 'instructor' | 'admin'
      course_status: 'draft' | 'active' | 'archived'
      enrollment_status: 'active' | 'completed' | 'expired' | 'cancelled'
      content_status: 'draft' | 'active' | 'archived'
    }
    CompositeTypes: Record<never, never>
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Row']

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']

export type Enums<T extends keyof PublicSchema['Enums']> =
  PublicSchema['Enums'][T]
