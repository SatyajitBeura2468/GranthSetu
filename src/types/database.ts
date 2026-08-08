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
      academic_sessions: {
        Row: {
          created_at: string
          display_label: string
          ends_on: string
          id: string
          session_code: string
          starts_on: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_label: string
          ends_on: string
          id?: string
          session_code: string
          starts_on: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_label?: string
          ends_on?: string
          id?: string
          session_code?: string
          starts_on?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      audit_events: {
        Row: {
          action: string
          actor_profile_id: string | null
          after_data: Json | null
          before_data: Json | null
          id: string
          metadata: Json
          occurred_at: string
          request_id: string | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          id?: string
          metadata?: Json
          occurred_at?: string
          request_id?: string | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          after_data?: Json | null
          before_data?: Json | null
          id?: string
          metadata?: Json
          occurred_at?: string
          request_id?: string | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      authors: {
        Row: {
          created_at: string
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      book_authors: {
        Row: {
          author_id: string
          author_order: number
          book_id: string
        }
        Insert: {
          author_id: string
          author_order?: number
          book_id: string
        }
        Update: {
          author_id?: string
          author_order?: number
          book_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_authors_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "authors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_authors_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_categories: {
        Row: {
          book_id: string
          category_id: string
        }
        Insert: {
          book_id: string
          category_id: string
        }
        Update: {
          book_id?: string
          category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_categories_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      book_copies: {
        Row: {
          accession_number: string
          acquired_on: string | null
          acquisition_source: string | null
          barcode: string | null
          book_id: string
          condition_status: string
          created_at: string
          currency_code: string
          id: string
          location_id: string | null
          operational_state: string
          replacement_cost_minor: number | null
          updated_at: string
        }
        Insert: {
          accession_number: string
          acquired_on?: string | null
          acquisition_source?: string | null
          barcode?: string | null
          book_id: string
          condition_status?: string
          created_at?: string
          currency_code?: string
          id?: string
          location_id?: string | null
          operational_state?: string
          replacement_cost_minor?: number | null
          updated_at?: string
        }
        Update: {
          accession_number?: string
          acquired_on?: string | null
          acquisition_source?: string | null
          barcode?: string | null
          book_id?: string
          condition_status?: string
          created_at?: string
          currency_code?: string
          id?: string
          location_id?: string | null
          operational_state?: string
          replacement_cost_minor?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_copies_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_copies_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id"]
          },
        ]
      }
      book_subjects: {
        Row: {
          book_id: string
          subject_id: string
        }
        Insert: {
          book_id: string
          subject_id: string
        }
        Update: {
          book_id?: string
          subject_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_subjects_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_subjects_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          created_at: string
          cover_storage_path: string | null
          description: string | null
          edition: string | null
          id: string
          isbn: string | null
          isbn_normalized: string | null
          language_code: string | null
          publication_year: number | null
          publisher_id: string | null
          status: string
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cover_storage_path?: string | null
          description?: string | null
          edition?: string | null
          id?: string
          isbn?: string | null
          isbn_normalized?: string | null
          language_code?: string | null
          publication_year?: number | null
          publisher_id?: string | null
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cover_storage_path?: string | null
          description?: string | null
          edition?: string | null
          id?: string
          isbn?: string | null
          isbn_normalized?: string | null
          language_code?: string | null
          publication_year?: number | null
          publisher_id?: string | null
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "books_publisher_id_fkey"
            columns: ["publisher_id"]
            isOneToOne: false
            referencedRelation: "publishers"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      fines: {
        Row: {
          assessed_amount_minor: number
          assessed_by_profile_id: string
          created_at: string
          currency_code: string
          fine_kind: string
          id: string
          loan_id: string
          reason: string | null
          settled_amount_minor: number
          updated_at: string
          waived_amount_minor: number
        }
        Insert: {
          assessed_amount_minor: number
          assessed_by_profile_id: string
          created_at?: string
          currency_code?: string
          fine_kind?: string
          id?: string
          loan_id: string
          reason?: string | null
          settled_amount_minor?: number
          updated_at?: string
          waived_amount_minor?: number
        }
        Update: {
          assessed_amount_minor?: number
          assessed_by_profile_id?: string
          created_at?: string
          currency_code?: string
          fine_kind?: string
          id?: string
          loan_id?: string
          reason?: string | null
          settled_amount_minor?: number
          updated_at?: string
          waived_amount_minor?: number
        }
        Relationships: [
          {
            foreignKeyName: "fines_assessed_by_profile_id_fkey"
            columns: ["assessed_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fines_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      grade_levels: {
        Row: {
          created_at: string
          display_name: string
          grade_code: string
          id: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          display_name: string
          grade_code: string
          id?: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          grade_code?: string
          id?: string
          sort_order?: number
        }
        Relationships: []
      }
      library_settings: {
        Row: {
          boolean_value: boolean | null
          created_at: string
          currency_code: string | null
          integer_value: number | null
          money_minor_value: number | null
          setting_key: string
          updated_at: string
          updated_by_profile_id: string | null
          value_kind: string
        }
        Insert: {
          boolean_value?: boolean | null
          created_at?: string
          currency_code?: string | null
          integer_value?: number | null
          money_minor_value?: number | null
          setting_key: string
          updated_at?: string
          updated_by_profile_id?: string | null
          value_kind: string
        }
        Update: {
          boolean_value?: boolean | null
          created_at?: string
          currency_code?: string | null
          integer_value?: number | null
          money_minor_value?: number | null
          setting_key?: string
          updated_at?: string
          updated_by_profile_id?: string | null
          value_kind?: string
        }
        Relationships: [
          {
            foreignKeyName: "library_settings_updated_by_profile_id_fkey"
            columns: ["updated_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loan_renewals: {
        Row: {
          approved_by_profile_id: string
          id: string
          loan_id: string
          new_due_at: string
          previous_due_at: string
          renewed_at: string
        }
        Insert: {
          approved_by_profile_id: string
          id?: string
          loan_id: string
          new_due_at: string
          previous_due_at: string
          renewed_at?: string
        }
        Update: {
          approved_by_profile_id?: string
          id?: string
          loan_id?: string
          new_due_at?: string
          previous_due_at?: string
          renewed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_renewals_approved_by_profile_id_fkey"
            columns: ["approved_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loan_renewals_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          book_copy_id: string
          due_at: string
          id: string
          issued_at: string
          issued_by_profile_id: string
          member_id: string
          notes: string | null
          returned_at: string | null
          returned_by_profile_id: string | null
          status: string
        }
        Insert: {
          book_copy_id: string
          due_at: string
          id?: string
          issued_at?: string
          issued_by_profile_id: string
          member_id: string
          notes?: string | null
          returned_at?: string | null
          returned_by_profile_id?: string | null
          status?: string
        }
        Update: {
          book_copy_id?: string
          due_at?: string
          id?: string
          issued_at?: string
          issued_by_profile_id?: string
          member_id?: string
          notes?: string | null
          returned_at?: string | null
          returned_by_profile_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_book_copy_id_fkey"
            columns: ["book_copy_id"]
            isOneToOne: false
            referencedRelation: "book_copies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_issued_by_profile_id_fkey"
            columns: ["issued_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loans_returned_by_profile_id_fkey"
            columns: ["returned_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          display_name: string
          id: string
          location_code: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          location_code: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          location_code?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          created_at: string
          display_name: string
          id: string
          member_identifier: string
          member_kind: string
          profile_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          member_identifier: string
          member_kind: string
          profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          member_identifier?: string
          member_kind?: string
          profile_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_roles: {
        Row: {
          assigned_at: string
          assigned_by_profile_id: string | null
          profile_id: string
          role_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_profile_id?: string | null
          profile_id: string
          role_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by_profile_id?: string | null
          profile_id?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_roles_assigned_by_profile_id_fkey"
            columns: ["assigned_by_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_roles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_user_id: string | null
          created_at: string
          display_name: string
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          auth_user_id?: string | null
          created_at?: string
          display_name: string
          id?: string
          status?: string
          updated_at?: string
        }
        Update: {
          auth_user_id?: string | null
          created_at?: string
          display_name?: string
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      publishers: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      roles: {
        Row: {
          created_at: string
          description: string | null
          display_name: string
          id: string
          role_key: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_name: string
          id?: string
          role_key: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_name?: string
          id?: string
          role_key?: string
        }
        Relationships: []
      }
      sections: {
        Row: {
          created_at: string
          display_name: string
          id: string
          section_code: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          display_name: string
          id?: string
          section_code: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          display_name?: string
          id?: string
          section_code?: string
          sort_order?: number
        }
        Relationships: []
      }
      student_enrollments: {
        Row: {
          academic_session_id: string
          created_at: string
          grade_level_id: string
          id: string
          member_id: string
          section_id: string
          status: string
          updated_at: string
        }
        Insert: {
          academic_session_id: string
          created_at?: string
          grade_level_id: string
          id?: string
          member_id: string
          section_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          academic_session_id?: string
          created_at?: string
          grade_level_id?: string
          id?: string
          member_id?: string
          section_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_enrollments_academic_session_id_fkey"
            columns: ["academic_session_id"]
            isOneToOne: false
            referencedRelation: "academic_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_grade_level_id_fkey"
            columns: ["grade_level_id"]
            isOneToOne: false
            referencedRelation: "grade_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_enrollments_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "sections"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          created_at: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_assign_role: {
        Args: { p_role_key: string; p_target_profile_id: string }
        Returns: boolean
      }
      admin_provision_operator_profile: {
        Args: {
          p_display_name: string
          p_role_key: string
          p_target_auth_user_id: string
        }
        Returns: string
      }
      admin_revoke_role: {
        Args: { p_role_key: string; p_target_profile_id: string }
        Returns: boolean
      }
      admin_set_profile_status: {
        Args: { p_status: string; p_target_profile_id: string }
        Returns: boolean
      }
      bootstrap_first_administrator: {
        Args: { p_display_name: string; p_target_auth_user_id: string }
        Returns: string
      }
      circulation_assess_overdue_fine: {
        Args: { p_loan_id: string; p_request_id: string }
        Returns: Json
      }
      circulation_issue_loan: {
        Args: {
          p_book_copy_id: string
          p_member_id: string
          p_notes?: string
          p_request_id: string
        }
        Returns: Json
      }
      circulation_renew_loan: {
        Args: { p_loan_id: string; p_request_id: string }
        Returns: Json
      }
      circulation_return_loan: {
        Args: { p_loan_id: string; p_request_id: string }
        Returns: Json
      }
      circulation_settle_fine: {
        Args: {
          p_amount_minor: number
          p_fine_id: string
          p_note?: string
          p_request_id: string
        }
        Returns: Json
      }
      circulation_waive_fine: {
        Args: {
          p_amount_minor: number
          p_fine_id: string
          p_reason: string
          p_request_id: string
        }
        Returns: Json
      }
      current_operator_context: {
        Args: never
        Returns: {
          display_name: string
          profile_id: string
          roles: string[]
          status: string
          user_id: string
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
    Enums: {},
  },
} as const
