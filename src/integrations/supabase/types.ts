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
      ai_agent_admins: {
        Row: {
          created_at: string | null
          email: string
          id: string
          is_active: boolean
        }
        Insert: {
          created_at?: string | null
          email: string
          id?: string
          is_active?: boolean
        }
        Update: {
          created_at?: string | null
          email?: string
          id?: string
          is_active?: boolean
        }
        Relationships: []
      }
      ai_agent_config: {
        Row: {
          agent_name: string
          agent_type: string
          auto_reply_contact_types: string[] | null
          auto_reply_delay_ms: number
          auto_reply_enabled: boolean
          created_at: string | null
          custom_instructions: string | null
          email_enabled: boolean
          human_handoff_keywords: string[] | null
          id: string
          is_active: boolean
          language: string
          llm_model: string
          max_notifications_per_day: number | null
          max_response_time_seconds: number
          min_interval_minutes: number | null
          notification_phases: string[] | null
          personality: string
          respect_working_hours: boolean
          signature: string | null
          tone_of_voice: string
          updated_at: string | null
          whatsapp_enabled: boolean
          working_hours_end: string | null
          working_hours_start: string | null
        }
        Insert: {
          agent_name?: string
          agent_type?: string
          auto_reply_contact_types?: string[] | null
          auto_reply_delay_ms?: number
          auto_reply_enabled?: boolean
          created_at?: string | null
          custom_instructions?: string | null
          email_enabled?: boolean
          human_handoff_keywords?: string[] | null
          id?: string
          is_active?: boolean
          language?: string
          llm_model?: string
          max_notifications_per_day?: number | null
          max_response_time_seconds?: number
          min_interval_minutes?: number | null
          notification_phases?: string[] | null
          personality?: string
          respect_working_hours?: boolean
          signature?: string | null
          tone_of_voice?: string
          updated_at?: string | null
          whatsapp_enabled?: boolean
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Update: {
          agent_name?: string
          agent_type?: string
          auto_reply_contact_types?: string[] | null
          auto_reply_delay_ms?: number
          auto_reply_enabled?: boolean
          created_at?: string | null
          custom_instructions?: string | null
          email_enabled?: boolean
          human_handoff_keywords?: string[] | null
          id?: string
          is_active?: boolean
          language?: string
          llm_model?: string
          max_notifications_per_day?: number | null
          max_response_time_seconds?: number
          min_interval_minutes?: number | null
          notification_phases?: string[] | null
          personality?: string
          respect_working_hours?: boolean
          signature?: string | null
          tone_of_voice?: string
          updated_at?: string | null
          whatsapp_enabled?: boolean
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: []
      }
      ai_compliance_policies: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_compliance_rules: {
        Row: {
          action_type: string | null
          created_at: string | null
          description: string | null
          id: string
          is_active: boolean | null
          name: string
          policy_id: string | null
          risk_level: string
          rule_pattern: string
          updated_at: string | null
        }
        Insert: {
          action_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          policy_id?: string | null
          risk_level?: string
          rule_pattern: string
          updated_at?: string | null
        }
        Update: {
          action_type?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          policy_id?: string | null
          risk_level?: string
          rule_pattern?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_compliance_rules_policy_id_fkey"
            columns: ["policy_id"]
            isOneToOne: false
            referencedRelation: "ai_compliance_policies"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_base: {
        Row: {
          agent_type: string
          carrier_name: string | null
          category: string
          content: string
          created_at: string | null
          created_by: string | null
          document_type: string | null
          id: string
          is_active: boolean
          keywords: string[] | null
          occurrence_type: string | null
          priority: number | null
          regions: string[] | null
          sla_category: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          agent_type?: string
          carrier_name?: string | null
          category?: string
          content: string
          created_at?: string | null
          created_by?: string | null
          document_type?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          occurrence_type?: string | null
          priority?: number | null
          regions?: string[] | null
          sla_category?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          agent_type?: string
          carrier_name?: string | null
          category?: string
          content?: string
          created_at?: string | null
          created_by?: string | null
          document_type?: string | null
          id?: string
          is_active?: boolean
          keywords?: string[] | null
          occurrence_type?: string | null
          priority?: number | null
          regions?: string[] | null
          sla_category?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_base_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_notification_log: {
        Row: {
          channel: string
          created_at: string | null
          customer_contact_id: string | null
          delivered_at: string | null
          error_message: string | null
          external_message_id: string | null
          id: string
          message_content: string
          metadata: Json | null
          order_id: string | null
          read_at: string | null
          recipient: string
          rule_id: string | null
          sent_at: string | null
          status: string
          subject: string | null
          template_id: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          customer_contact_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          message_content: string
          metadata?: Json | null
          order_id?: string | null
          read_at?: string | null
          recipient: string
          rule_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          customer_contact_id?: string | null
          delivered_at?: string | null
          error_message?: string | null
          external_message_id?: string | null
          id?: string
          message_content?: string
          metadata?: Json | null
          order_id?: string | null
          read_at?: string | null
          recipient?: string
          rule_id?: string | null
          sent_at?: string | null
          status?: string
          subject?: string | null
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_notification_log_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_notification_log_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_notification_log_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "ai_notification_rules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_notification_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "ai_notification_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_notification_rules: {
        Row: {
          channels: string[]
          created_at: string | null
          delay_minutes: number | null
          description: string | null
          id: string
          is_active: boolean
          name: string
          priority: number | null
          template_id: string | null
          trigger_conditions: Json | null
          trigger_status: string | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          channels?: string[]
          created_at?: string | null
          delay_minutes?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          priority?: number | null
          template_id?: string | null
          trigger_conditions?: Json | null
          trigger_status?: string | null
          trigger_type: string
          updated_at?: string | null
        }
        Update: {
          channels?: string[]
          created_at?: string | null
          delay_minutes?: number | null
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          priority?: number | null
          template_id?: string | null
          trigger_conditions?: Json | null
          trigger_status?: string | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_notification_templates: {
        Row: {
          category: string | null
          channel: string
          content: string
          created_at: string | null
          id: string
          is_active: boolean
          name: string
          subject: string | null
          updated_at: string | null
          variables: string[] | null
        }
        Insert: {
          category?: string | null
          channel: string
          content: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          subject?: string | null
          updated_at?: string | null
          variables?: string[] | null
        }
        Update: {
          category?: string | null
          channel?: string
          content?: string
          created_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          subject?: string | null
          updated_at?: string | null
          variables?: string[] | null
        }
        Relationships: []
      }
      carrier_conversations: {
        Row: {
          carrier_id: string
          contact_type: string | null
          conversation_type: string
          created_at: string | null
          created_by: string | null
          delivered_at: string | null
          id: string
          message_content: string
          message_direction: string
          message_metadata: Json | null
          n8n_message_id: string | null
          order_id: string | null
          quote_id: string | null
          read_at: string | null
          sent_at: string | null
        }
        Insert: {
          carrier_id: string
          contact_type?: string | null
          conversation_type: string
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          id?: string
          message_content: string
          message_direction: string
          message_metadata?: Json | null
          n8n_message_id?: string | null
          order_id?: string | null
          quote_id?: string | null
          read_at?: string | null
          sent_at?: string | null
        }
        Update: {
          carrier_id?: string
          contact_type?: string | null
          conversation_type?: string
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          id?: string
          message_content?: string
          message_direction?: string
          message_metadata?: Json | null
          n8n_message_id?: string | null
          order_id?: string | null
          quote_id?: string | null
          read_at?: string | null
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carrier_conversations_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_conversations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carrier_conversations_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "freight_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      carriers: {
        Row: {
          additional_contacts: Json | null
          cnpj: string | null
          collection_email: string | null
          contact_person: string | null
          contact_position: string | null
          coverage_notes: string | null
          created_at: string | null
          email: string | null
          id: string
          is_active: boolean | null
          name: string
          notes: string | null
          phone: string | null
          quote_email: string | null
          service_states: string[] | null
          updated_at: string | null
          whatsapp: string | null
        }
        Insert: {
          additional_contacts?: Json | null
          cnpj?: string | null
          collection_email?: string | null
          contact_person?: string | null
          contact_position?: string | null
          coverage_notes?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notes?: string | null
          phone?: string | null
          quote_email?: string | null
          service_states?: string[] | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Update: {
          additional_contacts?: Json | null
          cnpj?: string | null
          collection_email?: string | null
          contact_person?: string | null
          contact_position?: string | null
          coverage_notes?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notes?: string | null
          phone?: string | null
          quote_email?: string | null
          service_states?: string[] | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      customer_contacts: {
        Row: {
          address: string | null
          city: string | null
          contact_person: string | null
          created_at: string | null
          customer_document: string | null
          customer_name: string
          email: string | null
          id: string
          last_order_id: string | null
          neighborhood: string | null
          notes: string | null
          opt_in_email: boolean | null
          opt_in_whatsapp: boolean | null
          orders_count: number | null
          phone: string | null
          preferred_channel: string | null
          source: string | null
          state: string | null
          updated_at: string | null
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string | null
          customer_document?: string | null
          customer_name: string
          email?: string | null
          id?: string
          last_order_id?: string | null
          neighborhood?: string | null
          notes?: string | null
          opt_in_email?: boolean | null
          opt_in_whatsapp?: boolean | null
          orders_count?: number | null
          phone?: string | null
          preferred_channel?: string | null
          source?: string | null
          state?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          contact_person?: string | null
          created_at?: string | null
          customer_document?: string | null
          customer_name?: string
          email?: string | null
          id?: string
          last_order_id?: string | null
          neighborhood?: string | null
          notes?: string | null
          opt_in_email?: boolean | null
          opt_in_whatsapp?: boolean | null
          orders_count?: number | null
          phone?: string | null
          preferred_channel?: string | null
          source?: string | null
          state?: string | null
          updated_at?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contacts_last_order_id_fkey"
            columns: ["last_order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
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
      department_role_mapping: {
        Row: {
          created_at: string | null
          default_role: Database["public"]["Enums"]["app_role"]
          department: string
          id: string
        }
        Insert: {
          created_at?: string | null
          default_role: Database["public"]["Enums"]["app_role"]
          department: string
          id?: string
        }
        Update: {
          created_at?: string | null
          default_role?: Database["public"]["Enums"]["app_role"]
          department?: string
          id?: string
        }
        Relationships: []
      }
      freight_quote_responses: {
        Row: {
          additional_info: Json | null
          created_at: string | null
          delivery_time_days: number | null
          freight_value: number | null
          id: string
          is_selected: boolean | null
          quote_id: string
          received_at: string | null
          responded_by: string | null
          response_text: string
        }
        Insert: {
          additional_info?: Json | null
          created_at?: string | null
          delivery_time_days?: number | null
          freight_value?: number | null
          id?: string
          is_selected?: boolean | null
          quote_id: string
          received_at?: string | null
          responded_by?: string | null
          response_text: string
        }
        Update: {
          additional_info?: Json | null
          created_at?: string | null
          delivery_time_days?: number | null
          freight_value?: number | null
          id?: string
          is_selected?: boolean | null
          quote_id?: string
          received_at?: string | null
          responded_by?: string | null
          response_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_quote_responses_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "freight_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_quotes: {
        Row: {
          carrier_id: string
          created_at: string | null
          created_by: string | null
          expires_at: string | null
          id: string
          n8n_conversation_id: string | null
          order_id: string
          quote_request_data: Json
          requested_at: string | null
          response_received_at: string | null
          sent_at: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          carrier_id: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          n8n_conversation_id?: string | null
          order_id: string
          quote_request_data: Json
          requested_at?: string | null
          response_received_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          carrier_id?: string
          created_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          id?: string
          n8n_conversation_id?: string | null
          order_id?: string
          quote_request_data?: Json
          requested_at?: string | null
          response_received_at?: string | null
          sent_at?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "freight_quotes_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "freight_quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      item_consumption_metrics: {
        Row: {
          average_daily_consumption: number | null
          consumption_30_days: number | null
          consumption_60_days: number | null
          consumption_90_days: number | null
          id: string
          item_code: string
          last_calculated_at: string | null
        }
        Insert: {
          average_daily_consumption?: number | null
          consumption_30_days?: number | null
          consumption_60_days?: number | null
          consumption_90_days?: number | null
          id?: string
          item_code: string
          last_calculated_at?: string | null
        }
        Update: {
          average_daily_consumption?: number | null
          consumption_30_days?: number | null
          consumption_60_days?: number | null
          consumption_90_days?: number | null
          id?: string
          item_code?: string
          last_calculated_at?: string | null
        }
        Relationships: []
      }
      item_cost_allocation: {
        Row: {
          accounting_item: string | null
          allocated_quantity: number | null
          allocated_value: number | null
          allocation_percentage: number
          business_unit: string
          cost_center: string
          created_at: string | null
          id: string
          notes: string | null
          project: string | null
          purchase_request_item_id: string
          warehouse: string
        }
        Insert: {
          accounting_item?: string | null
          allocated_quantity?: number | null
          allocated_value?: number | null
          allocation_percentage: number
          business_unit: string
          cost_center: string
          created_at?: string | null
          id?: string
          notes?: string | null
          project?: string | null
          purchase_request_item_id: string
          warehouse: string
        }
        Update: {
          accounting_item?: string | null
          allocated_quantity?: number | null
          allocated_value?: number | null
          allocation_percentage?: number
          business_unit?: string
          cost_center?: string
          created_at?: string | null
          id?: string
          notes?: string | null
          project?: string | null
          purchase_request_item_id?: string
          warehouse?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_cost_allocation_purchase_request_item_id_fkey"
            columns: ["purchase_request_item_id"]
            isOneToOne: false
            referencedRelation: "purchase_request_items"
            referencedColumns: ["id"]
          },
        ]
      }
      item_purchase_history: {
        Row: {
          created_at: string | null
          id: string
          item_code: string
          notes: string | null
          purchase_date: string
          purchase_order_number: string | null
          quantity: number
          supplier: string | null
          unit_price: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          item_code: string
          notes?: string | null
          purchase_date: string
          purchase_order_number?: string | null
          quantity: number
          supplier?: string | null
          unit_price?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          item_code?: string
          notes?: string | null
          purchase_date?: string
          purchase_order_number?: string | null
          quantity?: number
          supplier?: string | null
          unit_price?: number | null
        }
        Relationships: []
      }
      item_stock_info: {
        Row: {
          current_stock_quantity: number | null
          id: string
          item_code: string
          last_purchase_date: string | null
          last_purchase_price: number | null
          last_purchase_quantity: number | null
          last_updated: string | null
          maximum_stock_level: number | null
          minimum_stock_level: number | null
          updated_by: string | null
          warehouse: string | null
        }
        Insert: {
          current_stock_quantity?: number | null
          id?: string
          item_code: string
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          last_purchase_quantity?: number | null
          last_updated?: string | null
          maximum_stock_level?: number | null
          minimum_stock_level?: number | null
          updated_by?: string | null
          warehouse?: string | null
        }
        Update: {
          current_stock_quantity?: number | null
          id?: string
          item_code?: string
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          last_purchase_quantity?: number | null
          last_updated?: string | null
          maximum_stock_level?: number | null
          minimum_stock_level?: number | null
          updated_by?: string | null
          warehouse?: string | null
        }
        Relationships: []
      }
      lab_item_work: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string | null
          firmware_notes: string | null
          firmware_updated: boolean | null
          firmware_version: string | null
          general_notes: string | null
          id: string
          image_installed: boolean | null
          image_notes: string | null
          image_version: string | null
          order_id: string
          order_item_id: string
          repair_parts: Json | null
          started_at: string | null
          tests_performed: Json | null
          updated_at: string | null
          work_status: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          firmware_notes?: string | null
          firmware_updated?: boolean | null
          firmware_version?: string | null
          general_notes?: string | null
          id?: string
          image_installed?: boolean | null
          image_notes?: string | null
          image_version?: string | null
          order_id: string
          order_item_id: string
          repair_parts?: Json | null
          started_at?: string | null
          tests_performed?: Json | null
          updated_at?: string | null
          work_status?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string | null
          firmware_notes?: string | null
          firmware_updated?: boolean | null
          firmware_version?: string | null
          general_notes?: string | null
          id?: string
          image_installed?: boolean | null
          image_notes?: string | null
          image_version?: string | null
          order_id?: string
          order_item_id?: string
          repair_parts?: Json | null
          started_at?: string | null
          tests_performed?: Json | null
          updated_at?: string | null
          work_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_item_work_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_item_work_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: true
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      mention_tags: {
        Row: {
          comment_id: string
          created_at: string | null
          id: string
          mentioned_by: string
          mentioned_user_id: string
          notification_id: string | null
          order_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          mentioned_by: string
          mentioned_user_id: string
          notification_id?: string | null
          order_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          mentioned_by?: string
          mentioned_user_id?: string
          notification_id?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mention_tags_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "order_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mention_tags_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mention_tags_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          comment_id: string | null
          created_at: string | null
          id: string
          is_read: boolean
          mentioned_by: string | null
          message: string
          metadata: Json | null
          order_id: string
          read_at: string | null
          title: string
          type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean
          mentioned_by?: string | null
          message: string
          metadata?: Json | null
          order_id: string
          read_at?: string | null
          title: string
          type?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          comment_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean
          mentioned_by?: string | null
          message?: string
          metadata?: Json | null
          order_id?: string
          read_at?: string | null
          title?: string
          type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "order_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          comment_id: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          order_id: string | null
          uploaded_at: string | null
          uploaded_by: string
        }
        Insert: {
          comment_id?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type?: string
          id?: string
          order_id?: string | null
          uploaded_at?: string | null
          uploaded_by: string
        }
        Update: {
          comment_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          order_id?: string | null
          uploaded_at?: string | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "order_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_changes: {
        Row: {
          change_category: string | null
          change_type: string
          changed_at: string
          changed_by: string
          field_name: string
          id: string
          new_value: string | null
          old_value: string | null
          order_id: string
        }
        Insert: {
          change_category?: string | null
          change_type?: string
          changed_at?: string
          changed_by: string
          field_name: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id: string
        }
        Update: {
          change_category?: string | null
          change_type?: string
          changed_at?: string
          changed_by?: string
          field_name?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_changes_order_id_fkey"
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
          production_order_number: string | null
          purchase_action_started: boolean | null
          purchase_action_started_at: string | null
          purchase_action_started_by: string | null
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
          production_order_number?: string | null
          purchase_action_started?: boolean | null
          purchase_action_started_at?: string | null
          purchase_action_started_by?: string | null
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
          production_order_number?: string | null
          purchase_action_started?: boolean | null
          purchase_action_started_at?: string | null
          purchase_action_started_by?: string | null
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
      order_occurrences: {
        Row: {
          carrier_response: string | null
          created_at: string | null
          description: string | null
          id: string
          occurrence_type: string
          order_id: string | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          sla_breached: boolean | null
          updated_at: string | null
        }
        Insert: {
          carrier_response?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          occurrence_type: string
          order_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          sla_breached?: boolean | null
          updated_at?: string | null
        }
        Update: {
          carrier_response?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          occurrence_type?: string
          order_id?: string | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          sla_breached?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_occurrences_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_occurrences_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_tracking_events: {
        Row: {
          carrier_code: string | null
          created_at: string | null
          event_code: string | null
          event_datetime: string | null
          event_description: string | null
          id: string
          location: string | null
          order_id: string | null
          raw_response: Json | null
          tracking_code: string | null
        }
        Insert: {
          carrier_code?: string | null
          created_at?: string | null
          event_code?: string | null
          event_datetime?: string | null
          event_description?: string | null
          id?: string
          location?: string | null
          order_id?: string | null
          raw_response?: Json | null
          tracking_code?: string | null
        }
        Update: {
          carrier_code?: string | null
          created_at?: string | null
          event_code?: string | null
          event_datetime?: string | null
          event_description?: string | null
          id?: string
          location?: string | null
          order_id?: string | null
          raw_response?: Json | null
          tracking_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_tracking_events_order_id_fkey"
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
      order_volumes: {
        Row: {
          created_at: string | null
          created_by: string | null
          description: string | null
          height_cm: number
          id: string
          length_cm: number
          order_id: string
          packaging_type: string | null
          quantity: number
          updated_at: string | null
          volume_number: number
          weight_kg: number
          width_cm: number
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          height_cm: number
          id?: string
          length_cm: number
          order_id: string
          packaging_type?: string | null
          quantity?: number
          updated_at?: string | null
          volume_number: number
          weight_kg: number
          width_cm: number
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          height_cm?: number
          id?: string
          length_cm?: number
          order_id?: string
          packaging_type?: string | null
          quantity?: number
          updated_at?: string | null
          volume_number?: number
          weight_kg?: number
          width_cm?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_volumes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          account_item: string | null
          business_area: string | null
          business_unit: string | null
          carrier_name: string | null
          contracted_sla_days: number | null
          cost_center: string | null
          created_at: string
          customer_document: string | null
          customer_name: string
          delivery_address: string
          delivery_date: string
          driver_name: string | null
          executive_name: string | null
          firmware_project_name: string | null
          freight_modality: string | null
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
          package_height_m: number | null
          package_length_m: number | null
          package_volumes: number | null
          package_weight_kg: number | null
          package_width_m: number | null
          priority: string
          production_released: boolean | null
          production_released_at: string | null
          production_released_by: string | null
          rateio_project_code: string | null
          requires_firmware: boolean | null
          requires_image: boolean | null
          sender_company: string | null
          shipping_date: string | null
          sla_deadline: string | null
          sla_status: string | null
          status: string
          totvs_order_number: string | null
          tracking_code: string | null
          updated_at: string
          user_id: string
          vehicle_plate: string | null
        }
        Insert: {
          account_item?: string | null
          business_area?: string | null
          business_unit?: string | null
          carrier_name?: string | null
          contracted_sla_days?: number | null
          cost_center?: string | null
          created_at?: string
          customer_document?: string | null
          customer_name: string
          delivery_address: string
          delivery_date: string
          driver_name?: string | null
          executive_name?: string | null
          firmware_project_name?: string | null
          freight_modality?: string | null
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
          package_height_m?: number | null
          package_length_m?: number | null
          package_volumes?: number | null
          package_weight_kg?: number | null
          package_width_m?: number | null
          priority: string
          production_released?: boolean | null
          production_released_at?: string | null
          production_released_by?: string | null
          rateio_project_code?: string | null
          requires_firmware?: boolean | null
          requires_image?: boolean | null
          sender_company?: string | null
          shipping_date?: string | null
          sla_deadline?: string | null
          sla_status?: string | null
          status: string
          totvs_order_number?: string | null
          tracking_code?: string | null
          updated_at?: string
          user_id: string
          vehicle_plate?: string | null
        }
        Update: {
          account_item?: string | null
          business_area?: string | null
          business_unit?: string | null
          carrier_name?: string | null
          contracted_sla_days?: number | null
          cost_center?: string | null
          created_at?: string
          customer_document?: string | null
          customer_name?: string
          delivery_address?: string
          delivery_date?: string
          driver_name?: string | null
          executive_name?: string | null
          firmware_project_name?: string | null
          freight_modality?: string | null
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
          package_height_m?: number | null
          package_length_m?: number | null
          package_volumes?: number | null
          package_weight_kg?: number | null
          package_width_m?: number | null
          priority?: string
          production_released?: boolean | null
          production_released_at?: string | null
          production_released_by?: string | null
          rateio_project_code?: string | null
          requires_firmware?: boolean | null
          requires_image?: boolean | null
          sender_company?: string | null
          shipping_date?: string | null
          sla_deadline?: string | null
          sla_status?: string | null
          status?: string
          totvs_order_number?: string | null
          tracking_code?: string | null
          updated_at?: string
          user_id?: string
          vehicle_plate?: string | null
        }
        Relationships: []
      }
      permission_audit_log: {
        Row: {
          action_type: string
          created_at: string | null
          details: Json | null
          id: string
          performed_by: string
          target_user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by: string
          target_user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string | null
          details?: Json | null
          id?: string
          performed_by?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      phase_config: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          display_name: string
          icon: string | null
          id: string
          order_index: number | null
          phase_key: string
          responsible_role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          order_index?: number | null
          phase_key: string
          responsible_role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          order_index?: number | null
          phase_key?: string
          responsible_role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      phase_permissions: {
        Row: {
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          phase_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          phase_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          phase_key?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          last_login: string | null
          location: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          last_login?: string | null
          location?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          last_login?: string | null
          location?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_request_items: {
        Row: {
          approved_quantity: number | null
          created_at: string | null
          id: string
          item_code: string
          item_description: string
          item_status: string | null
          notes: string | null
          order_item_id: string | null
          purchase_request_id: string
          rejection_reason: string | null
          requested_quantity: number
          total_price: number | null
          unit: string
          unit_price: number | null
          updated_at: string | null
          warehouse: string
        }
        Insert: {
          approved_quantity?: number | null
          created_at?: string | null
          id?: string
          item_code: string
          item_description: string
          item_status?: string | null
          notes?: string | null
          order_item_id?: string | null
          purchase_request_id: string
          rejection_reason?: string | null
          requested_quantity: number
          total_price?: number | null
          unit?: string
          unit_price?: number | null
          updated_at?: string | null
          warehouse: string
        }
        Update: {
          approved_quantity?: number | null
          created_at?: string | null
          id?: string
          item_code?: string
          item_description?: string
          item_status?: string | null
          notes?: string | null
          order_item_id?: string | null
          purchase_request_id?: string
          rejection_reason?: string | null
          requested_quantity?: number
          total_price?: number | null
          unit?: string
          unit_price?: number | null
          updated_at?: string | null
          warehouse?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_request_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_request_items_purchase_request_id_fkey"
            columns: ["purchase_request_id"]
            isOneToOne: false
            referencedRelation: "purchase_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          company: string | null
          created_at: string | null
          expected_delivery_date: string | null
          id: string
          notes: string | null
          purchase_order_number: string
          rejection_reason: string | null
          request_type: string
          requested_by: string
          status: string
          total_estimated_value: number | null
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          company?: string | null
          created_at?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          purchase_order_number: string
          rejection_reason?: string | null
          request_type?: string
          requested_by: string
          status?: string
          total_estimated_value?: number | null
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          company?: string | null
          created_at?: string | null
          expected_delivery_date?: string | null
          id?: string
          notes?: string | null
          purchase_order_number?: string
          rejection_reason?: string | null
          request_type?: string
          requested_by?: string
          status?: string
          total_estimated_value?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_requests_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rateio_projects: {
        Row: {
          business_area: string | null
          business_unit: string | null
          created_at: string | null
          description: string
          id: string
          is_active: boolean | null
          management: string | null
          project_code: string
          updated_at: string | null
        }
        Insert: {
          business_area?: string | null
          business_unit?: string | null
          created_at?: string | null
          description: string
          id?: string
          is_active?: boolean | null
          management?: string | null
          project_code: string
          updated_at?: string | null
        }
        Update: {
          business_area?: string | null
          business_unit?: string | null
          created_at?: string | null
          description?: string
          id?: string
          is_active?: boolean | null
          management?: string | null
          project_code?: string
          updated_at?: string | null
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
      user_activity_log: {
        Row: {
          action_type: string
          created_at: string
          description: string
          id: string
          ip_address: unknown
          metadata: Json | null
          record_id: string | null
          table_name: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          description: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          description?: string
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_approval_status: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          id: string
          rejection_reason: string | null
          status: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          id?: string
          rejection_reason?: string | null
          status?: string
          updated_at?: string | null
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
      whatsapp_authorized_users: {
        Row: {
          authorized_at: string | null
          authorized_by: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          user_id: string
        }
        Insert: {
          authorized_at?: string | null
          authorized_by?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id: string
        }
        Update: {
          authorized_at?: string | null
          authorized_by?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_authorized_users_authorized_by_fkey"
            columns: ["authorized_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_authorized_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_instances: {
        Row: {
          connected_at: string | null
          created_at: string | null
          id: string
          instance_key: string
          name: string | null
          phone_number: string | null
          qrcode: string | null
          qrcode_updated_at: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          connected_at?: string | null
          created_at?: string | null
          id?: string
          instance_key: string
          name?: string | null
          phone_number?: string | null
          qrcode?: string | null
          qrcode_updated_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          connected_at?: string | null
          created_at?: string | null
          id?: string
          instance_key?: string
          name?: string | null
          phone_number?: string | null
          qrcode?: string | null
          qrcode_updated_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      whatsapp_message_log: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          mega_message_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          mega_message_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          mega_message_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_message_log_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "carrier_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_edit_phase: {
        Args: { _phase: string; _user_id: string }
        Returns: boolean
      }
      can_view_phase: {
        Args: { _phase_key: string; _user_id: string }
        Returns: boolean
      }
      cleanup_old_activity_logs: { Args: never; Returns: undefined }
      generate_purchase_order_number: { Args: never; Returns: string }
      get_app_roles: {
        Args: never
        Returns: {
          role: string
        }[]
      }
      get_phase_from_order: { Args: { _order_id: string }; Returns: string }
      get_phase_from_status: { Args: { _status: string }; Returns: string }
      get_user_phases: {
        Args: { _user_id: string }
        Returns: {
          can_edit: boolean
          order_index: number
          phase_key: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_ai_agent_admin: { Args: { _user_id: string }; Returns: boolean }
      is_user_approved: { Args: { _user_id: string }; Returns: boolean }
      log_user_activity: {
        Args: {
          _action_type: string
          _description: string
          _metadata?: Json
          _record_id: string
          _table_name: string
          _user_id: string
        }
        Returns: undefined
      }
      subtract_business_days: {
        Args: { business_days: number; start_date: string }
        Returns: string
      }
      user_can_modify_order: { Args: { order_uuid: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "admin"
        | "almox_ssm"
        | "order_generation"
        | "almox_general"
        | "production"
        | "balance_generation"
        | "laboratory"
        | "packaging"
        | "freight_quote"
        | "invoicing"
        | "logistics"
        | "completion"
        | "ready_to_invoice"
        | "production_client"
        | "production_stock"
        | "in_transit"
        | "purchases"
        | "carriers_chat"
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
        "admin",
        "almox_ssm",
        "order_generation",
        "almox_general",
        "production",
        "balance_generation",
        "laboratory",
        "packaging",
        "freight_quote",
        "invoicing",
        "logistics",
        "completion",
        "ready_to_invoice",
        "production_client",
        "production_stock",
        "in_transit",
        "purchases",
        "carriers_chat",
      ],
    },
  },
} as const
