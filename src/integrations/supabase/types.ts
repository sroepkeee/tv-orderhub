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
          avoid_repetition: boolean | null
          closing_style: string | null
          conversation_style: string | null
          created_at: string | null
          custom_instructions: string | null
          email_enabled: boolean
          forbidden_phrases: string[] | null
          human_handoff_keywords: string[] | null
          id: string
          is_active: boolean
          language: string
          llm_model: string
          max_notifications_per_day: number | null
          max_response_time_seconds: number
          min_interval_minutes: number | null
          notification_phases: string[] | null
          organization_id: string | null
          personality: string
          respect_working_hours: boolean
          signature: string | null
          test_phone: string | null
          tone_of_voice: string
          updated_at: string | null
          use_signature: boolean | null
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
          avoid_repetition?: boolean | null
          closing_style?: string | null
          conversation_style?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          email_enabled?: boolean
          forbidden_phrases?: string[] | null
          human_handoff_keywords?: string[] | null
          id?: string
          is_active?: boolean
          language?: string
          llm_model?: string
          max_notifications_per_day?: number | null
          max_response_time_seconds?: number
          min_interval_minutes?: number | null
          notification_phases?: string[] | null
          organization_id?: string | null
          personality?: string
          respect_working_hours?: boolean
          signature?: string | null
          test_phone?: string | null
          tone_of_voice?: string
          updated_at?: string | null
          use_signature?: boolean | null
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
          avoid_repetition?: boolean | null
          closing_style?: string | null
          conversation_style?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          email_enabled?: boolean
          forbidden_phrases?: string[] | null
          human_handoff_keywords?: string[] | null
          id?: string
          is_active?: boolean
          language?: string
          llm_model?: string
          max_notifications_per_day?: number | null
          max_response_time_seconds?: number
          min_interval_minutes?: number | null
          notification_phases?: string[] | null
          organization_id?: string | null
          personality?: string
          respect_working_hours?: boolean
          signature?: string | null
          test_phone?: string | null
          tone_of_voice?: string
          updated_at?: string | null
          use_signature?: boolean | null
          whatsapp_enabled?: boolean
          working_hours_end?: string | null
          working_hours_start?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_instances: {
        Row: {
          agent_type: string
          auto_reply_delay_ms: number | null
          auto_reply_enabled: boolean | null
          avoid_repetition: boolean | null
          closing_style: string | null
          conversation_style: string | null
          created_at: string | null
          custom_instructions: string | null
          description: string | null
          domain_type: string | null
          emoji_library: string[] | null
          forbidden_phrases: string[] | null
          id: string
          instance_name: string
          is_active: boolean
          language: string | null
          llm_model: string | null
          max_message_length: number | null
          organization_id: string | null
          personality: string | null
          personality_traits: Json | null
          response_style: Json | null
          search_orders: boolean | null
          signature: string | null
          specializations: string[] | null
          system_prompt: string | null
          tone_of_voice: string | null
          updated_at: string | null
          use_signature: boolean | null
          whatsapp_instance_id: string | null
          whatsapp_number: string | null
        }
        Insert: {
          agent_type?: string
          auto_reply_delay_ms?: number | null
          auto_reply_enabled?: boolean | null
          avoid_repetition?: boolean | null
          closing_style?: string | null
          conversation_style?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          description?: string | null
          domain_type?: string | null
          emoji_library?: string[] | null
          forbidden_phrases?: string[] | null
          id?: string
          instance_name: string
          is_active?: boolean
          language?: string | null
          llm_model?: string | null
          max_message_length?: number | null
          organization_id?: string | null
          personality?: string | null
          personality_traits?: Json | null
          response_style?: Json | null
          search_orders?: boolean | null
          signature?: string | null
          specializations?: string[] | null
          system_prompt?: string | null
          tone_of_voice?: string | null
          updated_at?: string | null
          use_signature?: boolean | null
          whatsapp_instance_id?: string | null
          whatsapp_number?: string | null
        }
        Update: {
          agent_type?: string
          auto_reply_delay_ms?: number | null
          auto_reply_enabled?: boolean | null
          avoid_repetition?: boolean | null
          closing_style?: string | null
          conversation_style?: string | null
          created_at?: string | null
          custom_instructions?: string | null
          description?: string | null
          domain_type?: string | null
          emoji_library?: string[] | null
          forbidden_phrases?: string[] | null
          id?: string
          instance_name?: string
          is_active?: boolean
          language?: string | null
          llm_model?: string | null
          max_message_length?: number | null
          organization_id?: string | null
          personality?: string | null
          personality_traits?: Json | null
          response_style?: Json | null
          search_orders?: boolean | null
          signature?: string | null
          specializations?: string[] | null
          system_prompt?: string | null
          tone_of_voice?: string | null
          updated_at?: string | null
          use_signature?: boolean | null
          whatsapp_instance_id?: string | null
          whatsapp_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_agent_metrics: {
        Row: {
          agent_instance_id: string | null
          avg_confidence_score: number | null
          avg_response_time_ms: number | null
          created_at: string | null
          escalation_rate: number | null
          id: string
          knowledge_gaps_count: number | null
          metric_date: string
          negative_sentiment_rate: number | null
          positive_sentiment_rate: number | null
          resolution_rate: number | null
          suggestions_approved: number | null
          suggestions_generated: number | null
          tokens_consumed: number | null
          total_conversations: number | null
          total_messages: number | null
        }
        Insert: {
          agent_instance_id?: string | null
          avg_confidence_score?: number | null
          avg_response_time_ms?: number | null
          created_at?: string | null
          escalation_rate?: number | null
          id?: string
          knowledge_gaps_count?: number | null
          metric_date?: string
          negative_sentiment_rate?: number | null
          positive_sentiment_rate?: number | null
          resolution_rate?: number | null
          suggestions_approved?: number | null
          suggestions_generated?: number | null
          tokens_consumed?: number | null
          total_conversations?: number | null
          total_messages?: number | null
        }
        Update: {
          agent_instance_id?: string | null
          avg_confidence_score?: number | null
          avg_response_time_ms?: number | null
          created_at?: string | null
          escalation_rate?: number | null
          id?: string
          knowledge_gaps_count?: number | null
          metric_date?: string
          negative_sentiment_rate?: number | null
          positive_sentiment_rate?: number | null
          resolution_rate?: number | null
          suggestions_approved?: number | null
          suggestions_generated?: number | null
          tokens_consumed?: number | null
          total_conversations?: number | null
          total_messages?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_agent_metrics_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_instances"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "ai_knowledge_base_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_knowledge_suggestions: {
        Row: {
          agent_instance_id: string | null
          approved_at: string | null
          approved_by: string | null
          confidence_score: number | null
          conversation_id: string | null
          created_at: string | null
          created_knowledge_id: string | null
          detection_reason: string | null
          id: string
          rejection_reason: string | null
          source_question: string | null
          status: string | null
          suggested_category: string | null
          suggested_content: string
          suggested_keywords: string[] | null
          suggested_title: string
          suggestion_type: string
          updated_at: string | null
        }
        Insert: {
          agent_instance_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string | null
          created_knowledge_id?: string | null
          detection_reason?: string | null
          id?: string
          rejection_reason?: string | null
          source_question?: string | null
          status?: string | null
          suggested_category?: string | null
          suggested_content: string
          suggested_keywords?: string[] | null
          suggested_title: string
          suggestion_type?: string
          updated_at?: string | null
        }
        Update: {
          agent_instance_id?: string | null
          approved_at?: string | null
          approved_by?: string | null
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string | null
          created_knowledge_id?: string | null
          detection_reason?: string | null
          id?: string
          rejection_reason?: string | null
          source_question?: string | null
          status?: string | null
          suggested_category?: string | null
          suggested_content?: string
          suggested_keywords?: string[] | null
          suggested_title?: string
          suggestion_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_knowledge_suggestions_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_suggestions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "carrier_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_knowledge_suggestions_created_knowledge_id_fkey"
            columns: ["created_knowledge_id"]
            isOneToOne: false
            referencedRelation: "ai_knowledge_base"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_learning_feedback: {
        Row: {
          agent_instance_id: string | null
          confidence_score: number | null
          conversation_id: string | null
          created_at: string | null
          customer_sentiment: string | null
          feedback_notes: string | null
          feedback_source: string | null
          id: string
          knowledge_gaps_detected: string[] | null
          message_content: string
          required_human_intervention: boolean | null
          resolution_status: string | null
          response_content: string
          response_time_ms: number | null
          tokens_used: number | null
        }
        Insert: {
          agent_instance_id?: string | null
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string | null
          customer_sentiment?: string | null
          feedback_notes?: string | null
          feedback_source?: string | null
          id?: string
          knowledge_gaps_detected?: string[] | null
          message_content: string
          required_human_intervention?: boolean | null
          resolution_status?: string | null
          response_content: string
          response_time_ms?: number | null
          tokens_used?: number | null
        }
        Update: {
          agent_instance_id?: string | null
          confidence_score?: number | null
          conversation_id?: string | null
          created_at?: string | null
          customer_sentiment?: string | null
          feedback_notes?: string | null
          feedback_source?: string | null
          id?: string
          knowledge_gaps_detected?: string[] | null
          message_content?: string
          required_human_intervention?: boolean | null
          resolution_status?: string | null
          response_content?: string
          response_time_ms?: number | null
          tokens_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_learning_feedback_agent_instance_id_fkey"
            columns: ["agent_instance_id"]
            isOneToOne: false
            referencedRelation: "ai_agent_instances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_learning_feedback_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "carrier_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_manager_trigger_config: {
        Row: {
          channels: string[] | null
          created_at: string | null
          custom_template: string | null
          delay_minutes: number | null
          filter_purchase_items: boolean | null
          id: string
          include_customer_name: boolean | null
          include_days_until_delivery: boolean | null
          include_delivery_date: boolean | null
          include_item_count: boolean | null
          include_item_list: boolean | null
          include_order_number: boolean | null
          include_phase_info: boolean | null
          include_priority: boolean | null
          include_status: boolean | null
          include_total_value: boolean | null
          is_active: boolean | null
          organization_id: string | null
          priority: number | null
          trigger_name: string
          trigger_status: string[] | null
          trigger_type: string
          updated_at: string | null
        }
        Insert: {
          channels?: string[] | null
          created_at?: string | null
          custom_template?: string | null
          delay_minutes?: number | null
          filter_purchase_items?: boolean | null
          id?: string
          include_customer_name?: boolean | null
          include_days_until_delivery?: boolean | null
          include_delivery_date?: boolean | null
          include_item_count?: boolean | null
          include_item_list?: boolean | null
          include_order_number?: boolean | null
          include_phase_info?: boolean | null
          include_priority?: boolean | null
          include_status?: boolean | null
          include_total_value?: boolean | null
          is_active?: boolean | null
          organization_id?: string | null
          priority?: number | null
          trigger_name: string
          trigger_status?: string[] | null
          trigger_type?: string
          updated_at?: string | null
        }
        Update: {
          channels?: string[] | null
          created_at?: string | null
          custom_template?: string | null
          delay_minutes?: number | null
          filter_purchase_items?: boolean | null
          id?: string
          include_customer_name?: boolean | null
          include_days_until_delivery?: boolean | null
          include_delivery_date?: boolean | null
          include_item_count?: boolean | null
          include_item_list?: boolean | null
          include_order_number?: boolean | null
          include_phase_info?: boolean | null
          include_priority?: boolean | null
          include_status?: boolean | null
          include_total_value?: boolean | null
          is_active?: boolean | null
          organization_id?: string | null
          priority?: number | null
          trigger_name?: string
          trigger_status?: string[] | null
          trigger_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_manager_trigger_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      ai_rules: {
        Row: {
          action: string
          created_at: string
          id: string
          is_active: boolean
          policy: string
          rule: string
          rule_description: string
          rule_risk: string
          updated_at: string
        }
        Insert: {
          action?: string
          created_at?: string
          id?: string
          is_active?: boolean
          policy: string
          rule: string
          rule_description: string
          rule_risk: string
          updated_at?: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          is_active?: boolean
          policy?: string
          rule?: string
          rule_description?: string
          rule_risk?: string
          updated_at?: string
        }
        Relationships: []
      }
      carrier_conversations: {
        Row: {
          carrier_id: string
          compliance_flags: Json | null
          contact_type: string | null
          conversation_type: string
          created_at: string | null
          created_by: string | null
          delivered_at: string | null
          group_id: string | null
          group_name: string | null
          has_media: boolean | null
          id: string
          is_group_message: boolean | null
          media_type: string | null
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
          compliance_flags?: Json | null
          contact_type?: string | null
          conversation_type: string
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          group_id?: string | null
          group_name?: string | null
          has_media?: boolean | null
          id?: string
          is_group_message?: boolean | null
          media_type?: string | null
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
          compliance_flags?: Json | null
          contact_type?: string | null
          conversation_type?: string
          created_at?: string | null
          created_by?: string | null
          delivered_at?: string | null
          group_id?: string | null
          group_name?: string | null
          has_media?: boolean | null
          id?: string
          is_group_message?: boolean | null
          media_type?: string | null
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          phone?: string | null
          quote_email?: string | null
          service_states?: string[] | null
          updated_at?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carriers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      chart_configs: {
        Row: {
          background_color: string | null
          chart_type: string
          colors: Json
          created_at: string
          data_source: string
          height: number
          id: string
          is_active: boolean
          name: string
          options: Json
          organization_id: string | null
          updated_at: string
          width: number
        }
        Insert: {
          background_color?: string | null
          chart_type?: string
          colors?: Json
          created_at?: string
          data_source: string
          height?: number
          id?: string
          is_active?: boolean
          name: string
          options?: Json
          organization_id?: string | null
          updated_at?: string
          width?: number
        }
        Update: {
          background_color?: string | null
          chart_type?: string
          colors?: Json
          created_at?: string
          data_source?: string
          height?: number
          id?: string
          is_active?: boolean
          name?: string
          options?: Json
          organization_id?: string | null
          updated_at?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "chart_configs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_sentiment_cache: {
        Row: {
          carrier_id: string
          contact_name: string | null
          created_at: string | null
          handoff_detected_at: string | null
          handoff_reason: string | null
          id: string
          last_analyzed_at: string | null
          last_message_at: string | null
          message_count: number | null
          pending_actions: string[] | null
          requires_human_handoff: boolean | null
          score: number | null
          sentiment: string | null
          summary: string | null
          topics: string[] | null
          updated_at: string | null
        }
        Insert: {
          carrier_id: string
          contact_name?: string | null
          created_at?: string | null
          handoff_detected_at?: string | null
          handoff_reason?: string | null
          id?: string
          last_analyzed_at?: string | null
          last_message_at?: string | null
          message_count?: number | null
          pending_actions?: string[] | null
          requires_human_handoff?: boolean | null
          score?: number | null
          sentiment?: string | null
          summary?: string | null
          topics?: string[] | null
          updated_at?: string | null
        }
        Update: {
          carrier_id?: string
          contact_name?: string | null
          created_at?: string | null
          handoff_detected_at?: string | null
          handoff_reason?: string | null
          id?: string
          last_analyzed_at?: string | null
          last_message_at?: string | null
          message_count?: number | null
          pending_actions?: string[] | null
          requires_human_handoff?: boolean | null
          score?: number | null
          sentiment?: string | null
          summary?: string | null
          topics?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversation_sentiment_cache_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: true
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_change_requests: {
        Row: {
          change_type: Database["public"]["Enums"]["change_request_type"]
          conversation_id: string | null
          created_at: string | null
          customer_contact_id: string | null
          description: string
          id: string
          message_id: string | null
          order_id: string
          organization_id: string | null
          original_value: string | null
          requested_by_name: string | null
          requested_by_phone: string
          requested_value: string | null
          review_notes: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["change_request_status"] | null
          updated_at: string | null
        }
        Insert: {
          change_type: Database["public"]["Enums"]["change_request_type"]
          conversation_id?: string | null
          created_at?: string | null
          customer_contact_id?: string | null
          description: string
          id?: string
          message_id?: string | null
          order_id: string
          organization_id?: string | null
          original_value?: string | null
          requested_by_name?: string | null
          requested_by_phone: string
          requested_value?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_request_status"] | null
          updated_at?: string | null
        }
        Update: {
          change_type?: Database["public"]["Enums"]["change_request_type"]
          conversation_id?: string | null
          created_at?: string | null
          customer_contact_id?: string | null
          description?: string
          id?: string
          message_id?: string | null
          order_id?: string
          organization_id?: string | null
          original_value?: string | null
          requested_by_name?: string | null
          requested_by_phone?: string
          requested_value?: string | null
          review_notes?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["change_request_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_change_requests_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "carrier_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_change_requests_customer_contact_id_fkey"
            columns: ["customer_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_change_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_change_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "customer_contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "delivery_date_changes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          quote_id?: string
          received_at?: string | null
          responded_by?: string | null
          response_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "freight_quote_responses_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "freight_quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "lab_item_work_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      management_report_log: {
        Row: {
          chart_sent: boolean | null
          error_message: string | null
          id: string
          message_content: string | null
          metrics_snapshot: Json | null
          recipient_id: string | null
          recipient_whatsapp: string
          report_type: string
          sent_at: string | null
          status: string
        }
        Insert: {
          chart_sent?: boolean | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          metrics_snapshot?: Json | null
          recipient_id?: string | null
          recipient_whatsapp: string
          report_type?: string
          sent_at?: string | null
          status?: string
        }
        Update: {
          chart_sent?: boolean | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          metrics_snapshot?: Json | null
          recipient_id?: string | null
          recipient_whatsapp?: string
          report_type?: string
          sent_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "management_report_log_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "management_report_recipients"
            referencedColumns: ["id"]
          },
        ]
      }
      management_report_recipients: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean
          last_report_sent_at: string | null
          preferred_time: string | null
          report_types: string[]
          updated_at: string | null
          user_id: string
          whatsapp: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          last_report_sent_at?: string | null
          preferred_time?: string | null
          report_types?: string[]
          updated_at?: string | null
          user_id: string
          whatsapp: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean
          last_report_sent_at?: string | null
          preferred_time?: string | null
          report_types?: string[]
          updated_at?: string | null
          user_id?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_user"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
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
          organization_id: string | null
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          id?: string
          mentioned_by: string
          mentioned_user_id: string
          notification_id?: string | null
          order_id: string
          organization_id?: string | null
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          id?: string
          mentioned_by?: string
          mentioned_user_id?: string
          notification_id?: string | null
          order_id?: string
          organization_id?: string | null
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
          {
            foreignKeyName: "mention_tags_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_permissions: {
        Row: {
          can_view: boolean | null
          created_at: string | null
          granted_by: string | null
          id: string
          menu_key: string
          organization_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_view?: boolean | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          menu_key: string
          organization_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_view?: boolean | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          menu_key?: string
          organization_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue: {
        Row: {
          attempts: number
          created_at: string
          error_message: string | null
          id: string
          last_attempt_at: string | null
          max_attempts: number
          media_base64: string | null
          media_caption: string | null
          media_filename: string | null
          message_content: string
          message_type: string
          metadata: Json | null
          organization_id: string | null
          priority: number
          recipient_name: string | null
          recipient_whatsapp: string
          scheduled_for: string
          sent_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          media_base64?: string | null
          media_caption?: string | null
          media_filename?: string | null
          message_content: string
          message_type?: string
          metadata?: Json | null
          organization_id?: string | null
          priority?: number
          recipient_name?: string | null
          recipient_whatsapp: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          error_message?: string | null
          id?: string
          last_attempt_at?: string | null
          max_attempts?: number
          media_base64?: string | null
          media_caption?: string | null
          media_filename?: string | null
          message_content?: string
          message_type?: string
          metadata?: Json | null
          organization_id?: string | null
          priority?: number
          recipient_name?: string | null
          recipient_whatsapp?: string
          scheduled_for?: string
          sent_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_queue_stats: {
        Row: {
          avg_send_time_ms: number | null
          created_at: string
          id: string
          messages_per_hour: Json | null
          organization_id: string | null
          stat_date: string
          total_failed: number | null
          total_queued: number | null
          total_sent: number | null
          updated_at: string
        }
        Insert: {
          avg_send_time_ms?: number | null
          created_at?: string
          id?: string
          messages_per_hour?: Json | null
          organization_id?: string | null
          stat_date?: string
          total_failed?: number | null
          total_queued?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Update: {
          avg_send_time_ms?: number | null
          created_at?: string
          id?: string
          messages_per_hour?: Json | null
          organization_id?: string | null
          stat_date?: string
          total_failed?: number | null
          total_queued?: number | null
          total_sent?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_queue_stats_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "notifications_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "order_attachments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_changes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_changes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          comment: string
          created_at?: string
          id?: string
          order_id: string
          organization_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          comment?: string
          created_at?: string
          id?: string
          order_id?: string
          organization_id?: string | null
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
          {
            foreignKeyName: "order_comments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
          pending_items: Json | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          note: string
          order_id: string
          organization_id?: string | null
          pending_items?: Json | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          note?: string
          order_id?: string
          organization_id?: string | null
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
          {
            foreignKeyName: "order_completion_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          id?: string
          new_status: string
          old_status: string
          order_id: string
          organization_id?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          id?: string
          new_status?: string
          old_status?: string
          order_id?: string
          organization_id?: string | null
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
          {
            foreignKeyName: "order_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "order_item_history_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          material_type: string | null
          ncm_code: string | null
          order_id: string
          organization_id: string | null
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
          material_type?: string | null
          ncm_code?: string | null
          order_id: string
          organization_id?: string | null
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
          material_type?: string | null
          ncm_code?: string | null
          order_id?: string
          organization_id?: string | null
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
          {
            foreignKeyName: "order_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
            foreignKeyName: "order_occurrences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
          responsible_department?: string | null
          stock_operation?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_type_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "order_volumes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
          customer_contact_name: string | null
          customer_document: string | null
          customer_name: string
          customer_whatsapp: string | null
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
          organization_id: string | null
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
          customer_contact_name?: string | null
          customer_document?: string | null
          customer_name: string
          customer_whatsapp?: string | null
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
          organization_id?: string | null
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
          customer_contact_name?: string | null
          customer_document?: string | null
          customer_name?: string
          customer_whatsapp?: string | null
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
          organization_id?: string | null
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
        Relationships: [
          {
            foreignKeyName: "orders_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invites: {
        Row: {
          created_at: string | null
          email: string
          expires_at: string | null
          id: string
          invite_token: string
          invited_by: string | null
          name: string | null
          organization_id: string
          role: string
          sent_at: string | null
          sent_via_email: boolean | null
          sent_via_whatsapp: boolean | null
          status: string | null
          used_at: string | null
          used_by: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          expires_at?: string | null
          id?: string
          invite_token?: string
          invited_by?: string | null
          name?: string | null
          organization_id: string
          role?: string
          sent_at?: string | null
          sent_via_email?: boolean | null
          sent_via_whatsapp?: boolean | null
          status?: string | null
          used_at?: string | null
          used_by?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          expires_at?: string | null
          id?: string
          invite_token?: string
          invited_by?: string | null
          name?: string | null
          organization_id?: string
          role?: string
          sent_at?: string | null
          sent_via_email?: boolean | null
          sent_via_whatsapp?: boolean | null
          status?: string | null
          used_at?: string | null
          used_by?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "organization_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          id: string
          invited_at: string | null
          invited_by: string | null
          is_active: boolean | null
          joined_at: string | null
          organization_id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          organization_id: string
          role?: string
          user_id: string
        }
        Update: {
          id?: string
          invited_at?: string | null
          invited_by?: string | null
          is_active?: boolean | null
          joined_at?: string | null
          organization_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          plan: string
          plan_limits: Json | null
          settings: Json | null
          slug: string
          trial_ends_at: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          plan?: string
          plan_limits?: Json | null
          settings?: Json | null
          slug: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          plan?: string
          plan_limits?: Json | null
          settings?: Json | null
          slug?: string
          trial_ends_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      pending_ai_replies: {
        Row: {
          carrier_id: string
          contact_type: string | null
          conversation_ids: string[] | null
          created_at: string | null
          first_message_at: string
          id: string
          messages_buffer: Json
          organization_id: string | null
          processed_at: string | null
          receiver_phone: string | null
          scheduled_reply_at: string
          sender_phone: string
        }
        Insert: {
          carrier_id: string
          contact_type?: string | null
          conversation_ids?: string[] | null
          created_at?: string | null
          first_message_at?: string
          id?: string
          messages_buffer?: Json
          organization_id?: string | null
          processed_at?: string | null
          receiver_phone?: string | null
          scheduled_reply_at: string
          sender_phone: string
        }
        Update: {
          carrier_id?: string
          contact_type?: string | null
          conversation_ids?: string[] | null
          created_at?: string | null
          first_message_at?: string
          id?: string
          messages_buffer?: Json
          organization_id?: string | null
          processed_at?: string | null
          receiver_phone?: string | null
          scheduled_reply_at?: string
          sender_phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_ai_replies_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pending_ai_replies_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          manager_user_id: string | null
          max_days_allowed: number | null
          order_index: number | null
          organization_id: string | null
          phase_key: string
          responsible_role: Database["public"]["Enums"]["app_role"]
          stall_alerts_enabled: boolean | null
          warning_days: number | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_name: string
          icon?: string | null
          id?: string
          manager_user_id?: string | null
          max_days_allowed?: number | null
          order_index?: number | null
          organization_id?: string | null
          phase_key: string
          responsible_role: Database["public"]["Enums"]["app_role"]
          stall_alerts_enabled?: boolean | null
          warning_days?: number | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          display_name?: string
          icon?: string | null
          id?: string
          manager_user_id?: string | null
          max_days_allowed?: number | null
          order_index?: number | null
          organization_id?: string | null
          phase_key?: string
          responsible_role?: Database["public"]["Enums"]["app_role"]
          stall_alerts_enabled?: boolean | null
          warning_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "phase_config_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_config_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_manager_notifications: {
        Row: {
          created_at: string | null
          delivered_at: string | null
          error_message: string | null
          id: string
          message_content: string | null
          metadata: Json | null
          notification_type: string
          order_id: string | null
          phase_manager_id: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          metadata?: Json | null
          notification_type: string
          order_id?: string | null
          phase_manager_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          delivered_at?: string | null
          error_message?: string | null
          id?: string
          message_content?: string | null
          metadata?: Json | null
          notification_type?: string
          order_id?: string | null
          phase_manager_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phase_manager_notifications_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_manager_notifications_phase_manager_id_fkey"
            columns: ["phase_manager_id"]
            isOneToOne: false
            referencedRelation: "phase_managers"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_managers: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          notification_priority: number | null
          organization_id: string | null
          phase_key: string
          receive_daily_summary: boolean | null
          receive_new_orders: boolean | null
          receive_urgent_alerts: boolean | null
          updated_at: string | null
          user_id: string
          whatsapp: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notification_priority?: number | null
          organization_id?: string | null
          phase_key: string
          receive_daily_summary?: boolean | null
          receive_new_orders?: boolean | null
          receive_urgent_alerts?: boolean | null
          updated_at?: string | null
          user_id: string
          whatsapp: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          notification_priority?: number | null
          organization_id?: string | null
          phase_key?: string
          receive_daily_summary?: boolean | null
          receive_new_orders?: boolean | null
          receive_urgent_alerts?: boolean | null
          updated_at?: string | null
          user_id?: string
          whatsapp?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_managers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_managers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_permissions: {
        Row: {
          can_advance: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          id: string
          organization_id: string | null
          phase_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string | null
        }
        Insert: {
          can_advance?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          organization_id?: string | null
          phase_key: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Update: {
          can_advance?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          id?: string
          organization_id?: string | null
          phase_key?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phase_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      phase_stall_alerts: {
        Row: {
          alert_type: string
          alerted_at: string | null
          created_at: string | null
          days_stalled: number
          id: string
          manager_user_id: string | null
          notification_sent: boolean | null
          order_id: string
          organization_id: string | null
          phase_key: string
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          whatsapp_message_id: string | null
        }
        Insert: {
          alert_type?: string
          alerted_at?: string | null
          created_at?: string | null
          days_stalled: number
          id?: string
          manager_user_id?: string | null
          notification_sent?: boolean | null
          order_id: string
          organization_id?: string | null
          phase_key: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          whatsapp_message_id?: string | null
        }
        Update: {
          alert_type?: string
          alerted_at?: string | null
          created_at?: string | null
          days_stalled?: number
          id?: string
          manager_user_id?: string | null
          notification_sent?: boolean | null
          order_id?: string
          organization_id?: string | null
          phase_key?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          whatsapp_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "phase_stall_alerts_manager_user_id_fkey"
            columns: ["manager_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_stall_alerts_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_stall_alerts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phase_stall_alerts_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          document: string | null
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean | null
          is_manager: boolean | null
          last_login: string | null
          location: string | null
          organization_id: string | null
          test_as_customer_document: string | null
          updated_at: string
          user_type: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          document?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean | null
          is_manager?: boolean | null
          last_login?: string | null
          location?: string | null
          organization_id?: string | null
          test_as_customer_document?: string | null
          updated_at?: string
          user_type?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          document?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          is_manager?: boolean | null
          last_login?: string | null
          location?: string | null
          organization_id?: string | null
          test_as_customer_document?: string | null
          updated_at?: string
          user_type?: string | null
          whatsapp?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          notification_count: number | null
          notification_recipients: string[] | null
          notification_sent_at: string | null
          order_id: string | null
          organization_id: string | null
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
          notification_count?: number | null
          notification_recipients?: string[] | null
          notification_sent_at?: string | null
          order_id?: string | null
          organization_id?: string | null
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
          notification_count?: number | null
          notification_recipients?: string[] | null
          notification_sent_at?: string | null
          order_id?: string | null
          organization_id?: string | null
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
            foreignKeyName: "purchase_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      report_schedules: {
        Row: {
          chart_provider: string
          created_at: string
          created_by: string | null
          frequency: string
          id: string
          include_charts: boolean
          is_active: boolean
          last_sent_at: string | null
          name: string
          next_send_at: string | null
          organization_id: string | null
          recipients: Json
          send_days: number[] | null
          send_time: string
          template_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          chart_provider?: string
          created_at?: string
          created_by?: string | null
          frequency?: string
          id?: string
          include_charts?: boolean
          is_active?: boolean
          last_sent_at?: string | null
          name: string
          next_send_at?: string | null
          organization_id?: string | null
          recipients?: Json
          send_days?: number[] | null
          send_time?: string
          template_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          chart_provider?: string
          created_at?: string
          created_by?: string | null
          frequency?: string
          id?: string
          include_charts?: boolean
          is_active?: boolean
          last_sent_at?: string | null
          name?: string
          next_send_at?: string | null
          organization_id?: string | null
          recipients?: Json
          send_days?: number[] | null
          send_time?: string
          template_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_schedules_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_send_log: {
        Row: {
          charts_sent: number | null
          created_at: string
          error_message: string | null
          id: string
          message_content: string | null
          metrics_snapshot: Json | null
          organization_id: string | null
          recipient_name: string | null
          recipient_whatsapp: string
          schedule_id: string | null
          sent_at: string | null
          status: string
          template_id: string | null
        }
        Insert: {
          charts_sent?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_content?: string | null
          metrics_snapshot?: Json | null
          organization_id?: string | null
          recipient_name?: string | null
          recipient_whatsapp: string
          schedule_id?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Update: {
          charts_sent?: number | null
          created_at?: string
          error_message?: string | null
          id?: string
          message_content?: string | null
          metrics_snapshot?: Json | null
          organization_id?: string | null
          recipient_name?: string | null
          recipient_whatsapp?: string
          schedule_id?: string | null
          sent_at?: string | null
          status?: string
          template_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "report_send_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_send_log_schedule_id_fkey"
            columns: ["schedule_id"]
            isOneToOne: false
            referencedRelation: "report_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "report_send_log_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "report_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      report_templates: {
        Row: {
          charts: Json
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_active: boolean
          is_system: boolean
          message_template: string | null
          metrics: Json
          name: string
          organization_id: string | null
          report_type: string
          sections: Json
          updated_at: string
        }
        Insert: {
          charts?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          message_template?: string | null
          metrics?: Json
          name: string
          organization_id?: string | null
          report_type?: string
          sections?: Json
          updated_at?: string
        }
        Update: {
          charts?: Json
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_active?: boolean
          is_system?: boolean
          message_template?: string | null
          metrics?: Json
          name?: string
          organization_id?: string | null
          report_type?: string
          sections?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "report_templates_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      return_request_items: {
        Row: {
          condition: string
          created_at: string
          dispatch_item_id: string | null
          id: string
          notes: string | null
          order_item_id: string | null
          quantity_returning: number
          return_request_id: string
        }
        Insert: {
          condition?: string
          created_at?: string
          dispatch_item_id?: string | null
          id?: string
          notes?: string | null
          order_item_id?: string | null
          quantity_returning?: number
          return_request_id: string
        }
        Update: {
          condition?: string
          created_at?: string
          dispatch_item_id?: string | null
          id?: string
          notes?: string | null
          order_item_id?: string | null
          quantity_returning?: number
          return_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_request_items_dispatch_item_id_fkey"
            columns: ["dispatch_item_id"]
            isOneToOne: false
            referencedRelation: "technician_dispatch_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_request_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_request_items_return_request_id_fkey"
            columns: ["return_request_id"]
            isOneToOne: false
            referencedRelation: "return_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      return_requests: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          carrier_id: string | null
          created_at: string
          customer_document: string | null
          customer_name: string | null
          destination_technician_id: string | null
          destination_type: string | null
          destination_warehouse: string
          dispatch_id: string | null
          freight_value: number | null
          id: string
          notes: string | null
          order_id: string | null
          order_ids: string[] | null
          organization_id: string | null
          photo_urls: string[] | null
          pickup_address: string | null
          pickup_city: string | null
          pickup_contact: string | null
          pickup_phone: string | null
          pickup_state: string | null
          pickup_zip_code: string | null
          received_at: string | null
          received_by: string | null
          rejection_reason: string | null
          requested_at: string
          requested_by: string | null
          requester_profile_id: string | null
          scheduled_pickup_date: string | null
          status: string
          technician_id: string | null
          total_volumes: number | null
          total_weight_kg: number | null
          tracking_code: string | null
          updated_at: string
          volume_details: Json | null
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          carrier_id?: string | null
          created_at?: string
          customer_document?: string | null
          customer_name?: string | null
          destination_technician_id?: string | null
          destination_type?: string | null
          destination_warehouse: string
          dispatch_id?: string | null
          freight_value?: number | null
          id?: string
          notes?: string | null
          order_id?: string | null
          order_ids?: string[] | null
          organization_id?: string | null
          photo_urls?: string[] | null
          pickup_address?: string | null
          pickup_city?: string | null
          pickup_contact?: string | null
          pickup_phone?: string | null
          pickup_state?: string | null
          pickup_zip_code?: string | null
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          requester_profile_id?: string | null
          scheduled_pickup_date?: string | null
          status?: string
          technician_id?: string | null
          total_volumes?: number | null
          total_weight_kg?: number | null
          tracking_code?: string | null
          updated_at?: string
          volume_details?: Json | null
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          carrier_id?: string | null
          created_at?: string
          customer_document?: string | null
          customer_name?: string | null
          destination_technician_id?: string | null
          destination_type?: string | null
          destination_warehouse?: string
          dispatch_id?: string | null
          freight_value?: number | null
          id?: string
          notes?: string | null
          order_id?: string | null
          order_ids?: string[] | null
          organization_id?: string | null
          photo_urls?: string[] | null
          pickup_address?: string | null
          pickup_city?: string | null
          pickup_contact?: string | null
          pickup_phone?: string | null
          pickup_state?: string | null
          pickup_zip_code?: string | null
          received_at?: string | null
          received_by?: string | null
          rejection_reason?: string | null
          requested_at?: string
          requested_by?: string | null
          requester_profile_id?: string | null
          scheduled_pickup_date?: string | null
          status?: string
          technician_id?: string | null
          total_volumes?: number | null
          total_weight_kg?: number | null
          tracking_code?: string | null
          updated_at?: string
          volume_details?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "return_requests_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "carriers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_destination_technician_id_fkey"
            columns: ["destination_technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "technician_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_requester_profile_id_fkey"
            columns: ["requester_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_requests_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      saas_leads: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string | null
          email: string
          id: string
          monthly_volume: string | null
          notes: string | null
          segment: string | null
          source: string | null
          status: string | null
          updated_at: string | null
          whatsapp: string
        }
        Insert: {
          company_name: string
          contact_name: string
          created_at?: string | null
          email: string
          id?: string
          monthly_volume?: string | null
          notes?: string | null
          segment?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string | null
          email?: string
          id?: string
          monthly_volume?: string | null
          notes?: string | null
          segment?: string | null
          source?: string | null
          status?: string | null
          updated_at?: string | null
          whatsapp?: string
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
          organization_id: string | null
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
          organization_id?: string | null
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
          organization_id?: string | null
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
          {
            foreignKeyName: "stock_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_dispatch_items: {
        Row: {
          created_at: string
          dispatch_id: string
          id: string
          item_code: string
          item_description: string
          notes: string | null
          order_item_id: string | null
          quantity_returned: number
          quantity_sent: number
          return_status: string
          returned_at: string | null
          returned_by: string | null
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dispatch_id: string
          id?: string
          item_code: string
          item_description: string
          notes?: string | null
          order_item_id?: string | null
          quantity_returned?: number
          quantity_sent?: number
          return_status?: string
          returned_at?: string | null
          returned_by?: string | null
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dispatch_id?: string
          id?: string
          item_code?: string
          item_description?: string
          notes?: string | null
          order_item_id?: string | null
          quantity_returned?: number
          quantity_sent?: number
          return_status?: string
          returned_at?: string | null
          returned_by?: string | null
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_dispatch_items_dispatch_id_fkey"
            columns: ["dispatch_id"]
            isOneToOne: false
            referencedRelation: "technician_dispatches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_dispatch_items_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_dispatches: {
        Row: {
          created_at: string
          created_by: string | null
          dispatch_date: string
          expected_return_date: string | null
          id: string
          notes: string | null
          order_id: string
          organization_id: string | null
          origin_warehouse: string
          status: string
          technician_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          order_id: string
          organization_id?: string | null
          origin_warehouse: string
          status?: string
          technician_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          dispatch_date?: string
          expected_return_date?: string | null
          id?: string
          notes?: string | null
          order_id?: string
          organization_id?: string | null
          origin_warehouse?: string
          status?: string
          technician_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technician_dispatches_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_dispatches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technician_dispatches_technician_id_fkey"
            columns: ["technician_id"]
            isOneToOne: false
            referencedRelation: "technicians"
            referencedColumns: ["id"]
          },
        ]
      }
      technician_invites: {
        Row: {
          created_at: string | null
          customer_document: string | null
          customer_name: string
          email: string
          id: string
          invite_token: string | null
          organization_id: string | null
          registered_at: string | null
          registered_user_id: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
        }
        Insert: {
          created_at?: string | null
          customer_document?: string | null
          customer_name: string
          email: string
          id?: string
          invite_token?: string | null
          organization_id?: string | null
          registered_at?: string | null
          registered_user_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
        }
        Update: {
          created_at?: string | null
          customer_document?: string | null
          customer_name?: string
          email?: string
          id?: string
          invite_token?: string | null
          organization_id?: string | null
          registered_at?: string | null
          registered_user_id?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technician_invites_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      technicians: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          document: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          organization_id: string | null
          phone: string | null
          specialty: string | null
          state: string | null
          updated_at: string
          user_id: string | null
          whatsapp: string | null
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          specialty?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          document?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          organization_id?: string | null
          phone?: string | null
          specialty?: string | null
          state?: string | null
          updated_at?: string
          user_id?: string | null
          whatsapp?: string | null
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "technicians_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
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
      user_phase_permissions: {
        Row: {
          can_advance: boolean | null
          can_delete: boolean | null
          can_edit: boolean | null
          can_view: boolean | null
          created_at: string | null
          granted_by: string | null
          id: string
          organization_id: string | null
          phase_key: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          can_advance?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          organization_id?: string | null
          phase_key: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          can_advance?: boolean | null
          can_delete?: boolean | null
          can_edit?: boolean | null
          can_view?: boolean | null
          created_at?: string | null
          granted_by?: string | null
          id?: string
          organization_id?: string | null
          phase_key?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_phase_permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_phase_permissions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_phase_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          organization_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          organization_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
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
          is_active: boolean | null
          name: string | null
          organization_id: string | null
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
          is_active?: boolean | null
          name?: string | null
          organization_id?: string | null
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
          is_active?: boolean | null
          name?: string | null
          organization_id?: string | null
          phone_number?: string | null
          qrcode?: string | null
          qrcode_updated_at?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_instances_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_media: {
        Row: {
          ai_analysis: Json | null
          base64_data: string | null
          caption: string | null
          compliance_check: Json | null
          conversation_id: string | null
          created_at: string | null
          direct_path: string | null
          duration_seconds: number | null
          file_name: string | null
          file_sha256: string | null
          file_size_bytes: number | null
          id: string
          media_key: string | null
          media_type: string
          mime_type: string | null
          organization_id: string | null
          storage_path: string | null
          thumbnail_base64: string | null
          updated_at: string | null
        }
        Insert: {
          ai_analysis?: Json | null
          base64_data?: string | null
          caption?: string | null
          compliance_check?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          direct_path?: string | null
          duration_seconds?: number | null
          file_name?: string | null
          file_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          media_key?: string | null
          media_type: string
          mime_type?: string | null
          organization_id?: string | null
          storage_path?: string | null
          thumbnail_base64?: string | null
          updated_at?: string | null
        }
        Update: {
          ai_analysis?: Json | null
          base64_data?: string | null
          caption?: string | null
          compliance_check?: Json | null
          conversation_id?: string | null
          created_at?: string | null
          direct_path?: string | null
          duration_seconds?: number | null
          file_name?: string | null
          file_sha256?: string | null
          file_size_bytes?: number | null
          id?: string
          media_key?: string | null
          media_type?: string
          mime_type?: string | null
          organization_id?: string | null
          storage_path?: string | null
          thumbnail_base64?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_media_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "carrier_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_media_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_message_log: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          error_message: string | null
          id: string
          mega_message_id: string | null
          organization_id: string | null
          status: string | null
          updated_at: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          mega_message_id?: string | null
          organization_id?: string | null
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          error_message?: string | null
          id?: string
          mega_message_id?: string | null
          organization_id?: string | null
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
          {
            foreignKeyName: "whatsapp_message_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_carrier_conversation: {
        Args: { p_carrier_id: string }
        Returns: boolean
      }
      can_access_order: { Args: { _order_id: string }; Returns: boolean }
      can_edit_phase: {
        Args: { _phase: string; _user_id: string }
        Returns: boolean
      }
      can_view_phase: {
        Args: { _phase_key: string; _user_id: string }
        Returns: boolean
      }
      cleanup_old_activity_logs: { Args: never; Returns: undefined }
      create_organization_with_defaults: {
        Args: {
          _org_name: string
          _owner_user_id: string
          _plan?: string
          _slug: string
        }
        Returns: string
      }
      generate_purchase_order_number: { Args: never; Returns: string }
      get_app_roles: {
        Args: never
        Returns: {
          role: string
        }[]
      }
      get_cron_job_status: {
        Args: { job_name_pattern?: string }
        Returns: {
          is_active: boolean
          job_id: number
          job_name: string
          last_run: string
          next_run: string
          schedule: string
        }[]
      }
      get_order_organization_id: {
        Args: { _order_id: string }
        Returns: string
      }
      get_phase_from_order: { Args: { _order_id: string }; Returns: string }
      get_phase_from_status: { Args: { _status: string }; Returns: string }
      get_phase_manager: {
        Args: { _org_id?: string; _phase_key: string }
        Returns: {
          full_name: string
          receive_new_orders: boolean
          receive_urgent_alerts: boolean
          user_id: string
          whatsapp: string
        }[]
      }
      get_user_org_role: { Args: { _user_id?: string }; Returns: string }
      get_user_organization_id: { Args: { _user_id?: string }; Returns: string }
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
      is_org_admin: { Args: { _user_id?: string }; Returns: boolean }
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
      normalize_brazil_phone: { Args: { phone: string }; Returns: string }
      subtract_business_days: {
        Args: { business_days: number; start_date: string }
        Returns: string
      }
      user_belongs_to_org: {
        Args: { _org_id: string; _user_id?: string }
        Returns: boolean
      }
      user_can_modify_order: { Args: { order_uuid: string }; Returns: boolean }
      user_has_phase_permission: {
        Args: { _permission?: string; _phase_key: string; _user_id: string }
        Returns: boolean
      }
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
      change_request_status: "pending" | "approved" | "rejected" | "applied"
      change_request_type:
        | "delivery_address"
        | "delivery_date"
        | "add_item"
        | "remove_item"
        | "change_quantity"
        | "cancel_order"
        | "change_contact"
        | "other"
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
      change_request_status: ["pending", "approved", "rejected", "applied"],
      change_request_type: [
        "delivery_address",
        "delivery_date",
        "add_item",
        "remove_item",
        "change_quantity",
        "cancel_order",
        "change_contact",
        "other",
      ],
    },
  },
} as const
