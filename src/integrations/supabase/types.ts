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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      delivery_date_changes: {
        Row: {
          change_category: string | null
          change_source: string | null
          changed_at: string | null
          changed_by: string
          factory_contacted_at: string | null
          factory_followup_required: boolean | null
          factory_response: string | null
          id: string
          marked_as_stalling: boolean | null
          new_date: string
          notes: string | null
          old_date: string
          order_id: string
          order_item_id: string | null
          reason: string | null
        }
        Insert: {
          change_category?: string | null
          change_source?: string | null
          changed_at?: string | null
          changed_by: string
          factory_contacted_at?: string | null
          factory_followup_required?: boolean | null
          factory_response?: string | null
          id?: string
          marked_as_stalling?: boolean | null
          new_date: string
          notes?: string | null
          old_date: string
          order_id: string
          order_item_id?: string | null
          reason?: string | null
        }
        Update: {
          change_category?: string | null
          change_source?: string | null
          changed_at?: string | null
          changed_by?: string
          factory_contacted_at?: string | null
          factory_followup_required?: boolean | null
          factory_response?: string | null
          id?: string
          marked_as_stalling?: boolean | null
          new_date?: string
          notes?: string | null
          old_date?: string
          order_id?: string
          order_item_id?: string | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_date_changes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_date_changes_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          order_id: string
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          file_name: string
          file_path: string
          file_size: number
          file_type?: string
          id?: string
          order_id: string
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          order_id?: string
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_comments: {
        Row: {
          comment: string
          created_at: string
          id: string
          order_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          order_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          order_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_comments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_completion_notes: {
        Row: {
          created_at: string | null
          id: string
          note: string
          order_id: string
          pending_items: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          note: string
          order_id: string
          pending_items?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string
          order_id?: string
          pending_items?: Json | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_completion_notes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_history: {
        Row: {
          changed_at: string
          id: string
          new_status: string
          old_status: string
          order_id: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_status: string
          old_status: string
          order_id: string
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_status?: string
          old_status?: string
          order_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_item_history: {
        Row: {
          changed_at: string
          field_changed: string
          id: string
          new_value: string
          notes: string | null
          old_value: string | null
          order_id: string
          order_item_id: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          field_changed: string
          id?: string
          new_value: string
          notes?: string | null
          old_value?: string | null
          order_id: string
          order_item_id: string
          user_id: string
        }
        Update: {
          changed_at?: string
          field_changed?: string
          id?: string
          new_value?: string
          notes?: string | null
          old_value?: string | null
          order_id?: string
          order_item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_item_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_item_history_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          current_phase: string | null
          delivered_quantity: number
          delivery_date: string
          discount_percent: number | null
          icms_percent: number | null
          id: string
          import_lead_time_days: number | null
          ipi_percent: number | null
          is_imported: boolean | null
          item_code: string
          item_description: string
          item_source_type: string | null
          item_status: string | null
          order_id: string
          phase_started_at: string | null
          production_estimated_date: string | null
          received_status: string | null
          requested_quantity: number
          sla_days: number | null
          sla_deadline: string | null
          total_value: number | null
          unit: string
          unit_price: number | null
          updated_at: string
          user_id: string
          warehouse: string
        }
        Insert: {
          created_at?: string
          current_phase?: string | null
          delivered_quantity?: number
          delivery_date: string
          discount_percent?: number | null
          icms_percent?: number | null
          id?: string
          import_lead_time_days?: number | null
          ipi_percent?: number | null
          is_imported?: boolean | null
          item_code: string
          item_description: string
          item_source_type?: string | null
          item_status?: string | null
          order_id: string
          phase_started_at?: string | null
          production_estimated_date?: string | null
          received_status?: string | null
          requested_quantity?: number
          sla_days?: number | null
          sla_deadline?: string | null
          total_value?: number | null
          unit?: string
          unit_price?: number | null
          updated_at?: string
          user_id: string
          warehouse: string
        }
        Update: {
          created_at?: string
          current_phase?: string | null
          delivered_quantity?: number
          delivery_date?: string
          discount_percent?: number | null
          icms_percent?: number | null
          id?: string
          import_lead_time_days?: number | null
          ipi_percent?: number | null
          is_imported?: boolean | null
          item_code?: string
          item_description?: string
          item_source_type?: string | null
          item_status?: string | null
          order_id?: string
          phase_started_at?: string | null
          production_estimated_date?: string | null
          received_status?: string | null
          requested_quantity?: number
          sla_days?: number | null
          sla_deadline?: string | null
          total_value?: number | null
          unit?: string
          unit_price?: number | null
          updated_at?: string
          user_id?: string
          warehouse?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_type_config: {
        Row: {
          approval_required: boolean | null
          category: string
          cost_center: string | null
          created_at: string | null
          default_sla_days: number
          default_status: string
          default_warehouse: string | null
          description: string | null
          display_name: string
          icon: string | null
          id: string
          operation_nature: string
          order_type: string
          responsible_department: string | null
          stock_operation: string
          updated_at: string | null
        }
        Insert: {
          approval_required?: boolean | null
          category?: string
          cost_center?: string | null
          created_at?: string | null
          default_sla_days: number
          default_status: string
          default_warehouse?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          operation_nature: string
          order_type: string
          responsible_department?: string | null
          stock_operation: string
          updated_at?: string | null
        }
        Update: {
          approval_required?: boolean | null
          category?: string
          cost_center?: string | null
          created_at?: string | null
          default_sla_days?: number
          default_status?: string
          default_warehouse?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          operation_nature?: string
          order_type?: string
          responsible_department?: string | null
          stock_operation?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      orders: {
        Row: {
          carrier_name: string | null
          created_at: string
          customer_document: string | null
          customer_name: string
          delivery_address: string
          delivery_date: string
          driver_name: string | null
          executive_name: string | null
          firmware_project_name: string | null
          freight_type: string | null
          freight_value: number | null
          id: string
          image_project_name: string | null
          issue_date: string | null
          lab_completed_at: string | null
          lab_notes: string | null
          lab_requested_at: string | null
          lab_status: string | null
          lab_ticket_id: string | null
          municipality: string | null
          notes: string | null
          operation_code: string | null
          order_category: string | null
          order_number: string
          order_type: string
          priority: string
          requires_firmware: boolean | null
          requires_image: boolean | null
          shipping_date: string | null
          status: string
          totvs_order_number: string | null
          tracking_code: string | null
          updated_at: string
          user_id: string
          vehicle_plate: string | null
        }
        Insert: {
          carrier_name?: string | null
          created_at?: string
          customer_document?: string | null
          customer_name: string
          delivery_address: string
          delivery_date: string
          driver_name?: string | null
          executive_name?: string | null
          firmware_project_name?: string | null
          freight_type?: string | null
          freight_value?: number | null
          id?: string
          image_project_name?: string | null
          issue_date?: string | null
          lab_completed_at?: string | null
          lab_notes?: string | null
          lab_requested_at?: string | null
          lab_status?: string | null
          lab_ticket_id?: string | null
          municipality?: string | null
          notes?: string | null
          operation_code?: string | null
          order_category?: string | null
          order_number: string
          order_type: string
          priority: string
          requires_firmware?: boolean | null
          requires_image?: boolean | null
          shipping_date?: string | null
          status: string
          totvs_order_number?: string | null
          tracking_code?: string | null
          updated_at?: string
          user_id: string
          vehicle_plate?: string | null
        }
        Update: {
          carrier_name?: string | null
          created_at?: string
          customer_document?: string | null
          customer_name?: string
          delivery_address?: string
          delivery_date?: string
          driver_name?: string | null
          executive_name?: string | null
          firmware_project_name?: string | null
          freight_type?: string | null
          freight_value?: number | null
          id?: string
          image_project_name?: string | null
          issue_date?: string | null
          lab_completed_at?: string | null
          lab_notes?: string | null
          lab_requested_at?: string | null
          lab_status?: string | null
          lab_ticket_id?: string | null
          municipality?: string | null
          notes?: string | null
          operation_code?: string | null
          order_category?: string | null
          order_number?: string
          order_type?: string
          priority?: string
          requires_firmware?: boolean | null
          requires_image?: boolean | null
          shipping_date?: string | null
          status?: string
          totvs_order_number?: string | null
          tracking_code?: string | null
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      stock_movements: {
        Row: {
          created_at: string | null
          id: string
          item_code: string
          movement_date: string | null
          movement_type: string
          notes: string | null
          order_id: string
          order_item_id: string | null
          quantity: number
          user_id: string
          warehouse_from: string | null
          warehouse_to: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_code: string
          movement_date?: string | null
          movement_type: string
          notes?: string | null
          order_id: string
          order_item_id?: string | null
          quantity: number
          user_id: string
          warehouse_from?: string | null
          warehouse_to?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_code?: string
          movement_date?: string | null
          movement_type?: string
          notes?: string | null
          order_id?: string
          order_item_id?: string | null
          quantity?: number
          user_id?: string
          warehouse_from?: string | null
          warehouse_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      subtract_business_days: {
        Args: { business_days: number; start_date: string }
        Returns: string
      }
      user_can_modify_order: {
        Args: { order_uuid: string }
        Returns: boolean
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
