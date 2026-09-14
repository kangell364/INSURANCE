/**
 * Database schema types for the Phase 1 tables.
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
    }
    Views: Record<never, never>
    Functions: {
      is_admin: {
        Args: { uid?: string }
        Returns: boolean
      }
    }
    Enums: {
      user_role: 'student' | 'instructor' | 'admin'
      course_status: 'draft' | 'active' | 'archived'
      enrollment_status: 'active' | 'completed' | 'expired' | 'cancelled'
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
