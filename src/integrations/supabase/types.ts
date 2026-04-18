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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_behavior_settings: {
        Row: {
          accuracy_strictness: number | null
          confidence_priority: boolean | null
          correction_mode: string | null
          id: string
          is_active: boolean | null
          max_corrections: number | null
          persona: string | null
          preview_prompt: string | null
          system_prompt: string | null
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          accuracy_strictness?: number | null
          confidence_priority?: boolean | null
          correction_mode?: string | null
          id?: string
          is_active?: boolean | null
          max_corrections?: number | null
          persona?: string | null
          preview_prompt?: string | null
          system_prompt?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          accuracy_strictness?: number | null
          confidence_priority?: boolean | null
          correction_mode?: string | null
          id?: string
          is_active?: boolean | null
          max_corrections?: number | null
          persona?: string | null
          preview_prompt?: string | null
          system_prompt?: string | null
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      app_versions: {
        Row: {
          deployed_at: string | null
          deployed_by: string | null
          environment: string | null
          id: string
          is_active: boolean | null
          release_notes: string | null
          version_name: string
        }
        Insert: {
          deployed_at?: string | null
          deployed_by?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          release_notes?: string | null
          version_name: string
        }
        Update: {
          deployed_at?: string | null
          deployed_by?: string | null
          environment?: string | null
          id?: string
          is_active?: boolean | null
          release_notes?: string | null
          version_name?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_role: string | null
          actor_user_id: string | null
          after_state: Json | null
          before_state: Json | null
          created_at: string | null
          id: string
          meta: Json | null
          module_key: string | null
          target_id: string | null
        }
        Insert: {
          action_type: string
          actor_role?: string | null
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          module_key?: string | null
          target_id?: string | null
        }
        Update: {
          action_type?: string
          actor_role?: string | null
          actor_user_id?: string | null
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string | null
          id?: string
          meta?: Json | null
          module_key?: string | null
          target_id?: string | null
        }
        Relationships: []
      }
      curriculum_day_parts: {
        Row: {
          activity_type: string | null
          content_json: Json | null
          created_at: string | null
          day_id: string | null
          duration_minutes: number | null
          id: string
          instructions: string | null
          media_json: Json | null
          part_number: number
          skill_focus: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          activity_type?: string | null
          content_json?: Json | null
          created_at?: string | null
          day_id?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          media_json?: Json | null
          part_number: number
          skill_focus?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          activity_type?: string | null
          content_json?: Json | null
          created_at?: string | null
          day_id?: string | null
          duration_minutes?: number | null
          id?: string
          instructions?: string | null
          media_json?: Json | null
          part_number?: number
          skill_focus?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_day_parts_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "curriculum_days"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_days: {
        Row: {
          badge_label: string | null
          created_at: string | null
          day_number: number
          id: string
          is_free: boolean | null
          is_published: boolean | null
          level_id: string | null
          objective: string | null
          theme: string | null
          title: string | null
          updated_at: string | null
          version_number: number | null
          week_id: string | null
          xp_reward: number | null
        }
        Insert: {
          badge_label?: string | null
          created_at?: string | null
          day_number: number
          id?: string
          is_free?: boolean | null
          is_published?: boolean | null
          level_id?: string | null
          objective?: string | null
          theme?: string | null
          title?: string | null
          updated_at?: string | null
          version_number?: number | null
          week_id?: string | null
          xp_reward?: number | null
        }
        Update: {
          badge_label?: string | null
          created_at?: string | null
          day_number?: number
          id?: string
          is_free?: boolean | null
          is_published?: boolean | null
          level_id?: string | null
          objective?: string | null
          theme?: string | null
          title?: string | null
          updated_at?: string | null
          version_number?: number | null
          week_id?: string | null
          xp_reward?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_days_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "curriculum_levels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curriculum_days_week_id_fkey"
            columns: ["week_id"]
            isOneToOne: false
            referencedRelation: "curriculum_weeks"
            referencedColumns: ["id"]
          },
        ]
      }
      curriculum_levels: {
        Row: {
          age_range: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          level_key: string
          title: string
        }
        Insert: {
          age_range?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          level_key: string
          title: string
        }
        Update: {
          age_range?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          level_key?: string
          title?: string
        }
        Relationships: []
      }
      curriculum_weeks: {
        Row: {
          created_at: string | null
          id: string
          is_published: boolean | null
          level_id: string | null
          objective: string | null
          reward_label: string | null
          title: string | null
          updated_at: string | null
          week_number: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          level_id?: string | null
          objective?: string | null
          reward_label?: string | null
          title?: string | null
          updated_at?: string | null
          week_number: number
        }
        Update: {
          created_at?: string | null
          id?: string
          is_published?: boolean | null
          level_id?: string | null
          objective?: string | null
          reward_label?: string | null
          title?: string | null
          updated_at?: string | null
          week_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "curriculum_weeks_level_id_fkey"
            columns: ["level_id"]
            isOneToOne: false
            referencedRelation: "curriculum_levels"
            referencedColumns: ["id"]
          },
        ]
      }
      exports_audit: {
        Row: {
          actor_user_id: string
          created_at: string | null
          destination: string | null
          export_type: string
          file_url: string | null
          filters: Json | null
          id: string
          row_count: number | null
        }
        Insert: {
          actor_user_id: string
          created_at?: string | null
          destination?: string | null
          export_type: string
          file_url?: string | null
          filters?: Json | null
          id?: string
          row_count?: number | null
        }
        Update: {
          actor_user_id?: string
          created_at?: string | null
          destination?: string | null
          export_type?: string
          file_url?: string | null
          filters?: Json | null
          id?: string
          row_count?: number | null
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          description: string | null
          flag_key: string
          flag_value: boolean | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          description?: string | null
          flag_key: string
          flag_value?: boolean | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          description?: string | null
          flag_key?: string
          flag_value?: boolean | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      lead_notes: {
        Row: {
          author_user_id: string | null
          created_at: string | null
          id: string
          note: string
          user_id: string
        }
        Insert: {
          author_user_id?: string | null
          created_at?: string | null
          id?: string
          note: string
          user_id: string
        }
        Update: {
          author_user_id?: string | null
          created_at?: string | null
          id?: string
          note?: string
          user_id?: string
        }
        Relationships: []
      }
      lead_pipeline: {
        Row: {
          created_at: string | null
          id: string
          last_activity_at: string | null
          next_follow_up_at: string | null
          owner_user_id: string | null
          payment_page_visited: boolean | null
          pricing_page_visited: boolean | null
          remarks: string | null
          stage: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_activity_at?: string | null
          next_follow_up_at?: string | null
          owner_user_id?: string | null
          payment_page_visited?: boolean | null
          pricing_page_visited?: boolean | null
          remarks?: string | null
          stage?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          last_activity_at?: string | null
          next_follow_up_at?: string | null
          owner_user_id?: string | null
          payment_page_visited?: boolean | null
          pricing_page_visited?: boolean | null
          remarks?: string | null
          stage?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      learner_parent_outputs: {
        Row: {
          ai_tone: string | null
          id: string
          student_user_id: string
          summary_json: Json | null
          updated_at: string | null
          visible_insights: Json | null
        }
        Insert: {
          ai_tone?: string | null
          id?: string
          student_user_id: string
          summary_json?: Json | null
          updated_at?: string | null
          visible_insights?: Json | null
        }
        Update: {
          ai_tone?: string | null
          id?: string
          student_user_id?: string
          summary_json?: Json | null
          updated_at?: string | null
          visible_insights?: Json | null
        }
        Relationships: []
      }
      parent_children: {
        Row: {
          created_at: string | null
          id: string
          parent_user_id: string
          relation_type: string | null
          status: string | null
          student_user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          parent_user_id: string
          relation_type?: string | null
          status?: string | null
          student_user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          parent_user_id?: string
          relation_type?: string | null
          status?: string | null
          student_user_id?: string
        }
        Relationships: []
      }
      parent_connect_settings: {
        Row: {
          ai_tone: string | null
          id: string
          intervention_enabled: boolean | null
          updated_at: string | null
          updated_by: string | null
          visibility_flags: Json | null
        }
        Insert: {
          ai_tone?: string | null
          id?: string
          intervention_enabled?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          visibility_flags?: Json | null
        }
        Update: {
          ai_tone?: string | null
          id?: string
          intervention_enabled?: boolean | null
          updated_at?: string | null
          updated_by?: string | null
          visibility_flags?: Json | null
        }
        Relationships: []
      }
      parent_profiles: {
        Row: {
          created_at: string | null
          id: string
          relationship_label: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          relationship_label?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          relationship_label?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_funnel_events: {
        Row: {
          amount: number | null
          created_at: string | null
          event_type: string
          failure_reason: string | null
          id: string
          meta: Json | null
          plan_name: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          event_type: string
          failure_reason?: string | null
          id?: string
          meta?: Json | null
          plan_name?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          event_type?: string
          failure_reason?: string | null
          id?: string
          meta?: Json | null
          plan_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_orders: {
        Row: {
          amount: number
          created_at: string | null
          currency: string | null
          id: string
          notes: Json | null
          order_id: string | null
          plan_name: string | null
          receipt: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: Json | null
          order_id?: string | null
          plan_name?: string | null
          receipt?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          currency?: string | null
          id?: string
          notes?: Json | null
          order_id?: string | null
          plan_name?: string | null
          receipt?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_transactions: {
        Row: {
          amount: number | null
          created_at: string | null
          failure_reason: string | null
          id: string
          invoice_url: string | null
          order_id: string | null
          payment_id: string | null
          payment_method: string | null
          signature: string | null
          status: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_url?: string | null
          order_id?: string | null
          payment_id?: string | null
          payment_method?: string | null
          signature?: string | null
          status?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string | null
          failure_reason?: string | null
          id?: string
          invoice_url?: string | null
          order_id?: string | null
          payment_id?: string | null
          payment_method?: string | null
          signature?: string | null
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          address: string | null
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          last_login_at: string | null
          location: string | null
          phone: string | null
          signup_source: string | null
          updated_at: string | null
          user_type: string | null
        }
        Insert: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          last_login_at?: string | null
          location?: string | null
          phone?: string | null
          signup_source?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Update: {
          address?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login_at?: string | null
          location?: string | null
          phone?: string | null
          signup_source?: string | null
          updated_at?: string | null
          user_type?: string | null
        }
        Relationships: []
      }
      role_permissions: {
        Row: {
          can_create: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_publish: boolean | null
          can_view: boolean | null
          id: string
          module_key: string
          role: string
        }
        Insert: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_publish?: boolean | null
          can_view?: boolean | null
          id?: string
          module_key: string
          role: string
        }
        Update: {
          can_create?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_publish?: boolean | null
          can_view?: boolean | null
          id?: string
          module_key?: string
          role?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          active_status: string | null
          created_at: string | null
          department: string | null
          id: string
          invited_by: string | null
          permissions: Json | null
          staff_role: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_status?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          invited_by?: string | null
          permissions?: Json | null
          staff_role?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_status?: string | null
          created_at?: string | null
          department?: string | null
          id?: string
          invited_by?: string | null
          permissions?: Json | null
          staff_role?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      student_profiles: {
        Row: {
          active_plan: string | null
          age: number | null
          created_at: string | null
          current_level: string | null
          grade: string | null
          id: string
          onboarding_completed: boolean | null
          school_board: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          active_plan?: string | null
          age?: number | null
          created_at?: string | null
          current_level?: string | null
          grade?: string | null
          id?: string
          onboarding_completed?: boolean | null
          school_board?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          active_plan?: string | null
          age?: number | null
          created_at?: string | null
          current_level?: string | null
          grade?: string | null
          id?: string
          onboarding_completed?: boolean | null
          school_board?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      student_progress: {
        Row: {
          accuracy_score: number | null
          completed_days: number | null
          confidence_score: number | null
          current_day: number | null
          current_level: string | null
          engagement_score: number | null
          fluency_score: number | null
          id: string
          streak_count: number | null
          student_user_id: string
          updated_at: string | null
        }
        Insert: {
          accuracy_score?: number | null
          completed_days?: number | null
          confidence_score?: number | null
          current_day?: number | null
          current_level?: string | null
          engagement_score?: number | null
          fluency_score?: number | null
          id?: string
          streak_count?: number | null
          student_user_id: string
          updated_at?: string | null
        }
        Update: {
          accuracy_score?: number | null
          completed_days?: number | null
          confidence_score?: number | null
          current_day?: number | null
          current_level?: string | null
          engagement_score?: number | null
          fluency_score?: number | null
          id?: string
          streak_count?: number | null
          student_user_id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      system_sync_logs: {
        Row: {
          created_at: string | null
          id: string
          payload: Json | null
          status: string | null
          sync_type: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
          sync_type?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          payload?: Json | null
          status?: string | null
          sync_type?: string | null
        }
        Relationships: []
      }
      ui_config: {
        Row: {
          config_key: string
          config_value: Json | null
          id: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          config_key: string
          config_value?: Json | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          config_key?: string
          config_value?: Json | null
          id?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      user_activity_logs: {
        Row: {
          activity_type: string
          created_at: string | null
          id: string
          meta: Json | null
          user_id: string
        }
        Insert: {
          activity_type: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          user_id: string
        }
        Update: {
          activity_type?: string
          created_at?: string | null
          id?: string
          meta?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      user_entitlements: {
        Row: {
          id: string
          is_active: boolean | null
          metadata: Json | null
          payment_status: string | null
          plan_duration_months: number | null
          plan_name: string | null
          updated_at: string | null
          user_id: string
          valid_from: string | null
          valid_until: string | null
        }
        Insert: {
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          payment_status?: string | null
          plan_duration_months?: number | null
          plan_name?: string | null
          updated_at?: string | null
          user_id: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Update: {
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          payment_status?: string | null
          plan_duration_months?: number | null
          plan_name?: string | null
          updated_at?: string | null
          user_id?: string
          valid_from?: string | null
          valid_until?: string | null
        }
        Relationships: []
      }
      user_login_events: {
        Row: {
          app_source: string | null
          browser: string | null
          device_type: string | null
          id: string
          ip_address: string | null
          logged_in_at: string | null
          platform: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          app_source?: string | null
          browser?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string | null
          platform?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          app_source?: string | null
          browser?: string | null
          device_type?: string | null
          id?: string
          ip_address?: string | null
          logged_in_at?: string | null
          platform?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_founder: { Args: { _user_id: string }; Returns: boolean }
      is_parent_of: {
        Args: { _child_id: string; _parent_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "student"
        | "parent"
        | "admin"
        | "founder"
        | "staff_support"
        | "staff_sales"
        | "staff_content"
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
      app_role: [
        "student",
        "parent",
        "admin",
        "founder",
        "staff_support",
        "staff_sales",
        "staff_content",
      ],
    },
  },
} as const
