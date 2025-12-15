import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface AgentConfig {
  id: string;
  agent_name: string;
  personality: string;
  tone_of_voice: string;
  language: string;
  is_active: boolean;
  whatsapp_enabled: boolean;
  email_enabled: boolean;
  working_hours_start: string;
  working_hours_end: string;
  respect_working_hours: boolean;
  max_notifications_per_day: number;
  min_interval_minutes: number;
  signature: string;
  custom_instructions: string | null;
}

interface KnowledgeBase {
  id: string;
  title: string;
  category: string;
  content: string;
  keywords: string[];
  priority: number;
  is_active: boolean;
  created_at: string;
}

interface NotificationRule {
  id: string;
  name: string;
  description: string | null;
  trigger_type: string;
  trigger_status: string | null;
  trigger_conditions: Record<string, any>;
  channels: string[];
  priority: number;
  delay_minutes: number;
  is_active: boolean;
  template_id: string | null;
}

interface NotificationTemplate {
  id: string;
  name: string;
  channel: string;
  subject: string | null;
  content: string;
  variables: string[];
  category: string;
  is_active: boolean;
}

interface CustomerContact {
  id: string;
  customer_name: string;
  customer_document: string | null;
  email: string | null;
  whatsapp: string | null;
  preferred_channel: string;
  opt_in_whatsapp: boolean;
  opt_in_email: boolean;
  notes: string | null;
}

interface NotificationLog {
  id: string;
  order_id: string | null;
  channel: string;
  recipient: string;
  subject: string | null;
  message_content: string;
  status: string;
  error_message: string | null;
  sent_at: string | null;
  created_at: string;
}

export function useAIAgentAdmin() {
  const { user } = useAuth();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<AgentConfig | null>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<KnowledgeBase[]>([]);
  const [rules, setRules] = useState<NotificationRule[]>([]);
  const [templates, setTemplates] = useState<NotificationTemplate[]>([]);
  const [contacts, setContacts] = useState<CustomerContact[]>([]);
  const [logs, setLogs] = useState<NotificationLog[]>([]);

  // Verificar se usuário é Super Admin do AI Agent
  const checkAuthorization = useCallback(async () => {
    if (!user?.email) {
      setIsAuthorized(false);
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('ai_agent_admins')
        .select('*')
        .eq('email', user.email)
        .eq('is_active', true)
        .maybeSingle();

      setIsAuthorized(!!data && !error);
    } catch (err) {
      console.error('Error checking AI Agent admin authorization:', err);
      setIsAuthorized(false);
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  // Carregar configuração do agente
  const loadConfig = useCallback(async () => {
    const { data } = await supabase
      .from('ai_agent_config')
      .select('*')
      .limit(1)
      .single();
    
    if (data) setConfig(data as AgentConfig);
  }, []);

  // Carregar base de conhecimento
  const loadKnowledgeBase = useCallback(async () => {
    const { data } = await supabase
      .from('ai_knowledge_base')
      .select('*')
      .order('priority', { ascending: false });
    
    if (data) setKnowledgeBase(data as KnowledgeBase[]);
  }, []);

  // Carregar regras
  const loadRules = useCallback(async () => {
    const { data } = await supabase
      .from('ai_notification_rules')
      .select('*')
      .order('priority', { ascending: false });
    
    if (data) setRules(data as NotificationRule[]);
  }, []);

  // Carregar templates
  const loadTemplates = useCallback(async () => {
    const { data } = await supabase
      .from('ai_notification_templates')
      .select('*')
      .order('name');
    
    if (data) setTemplates(data as NotificationTemplate[]);
  }, []);

  // Carregar contatos
  const loadContacts = useCallback(async () => {
    const { data } = await supabase
      .from('customer_contacts')
      .select('*')
      .order('customer_name');
    
    if (data) setContacts(data as CustomerContact[]);
  }, []);

  // Carregar logs
  const loadLogs = useCallback(async (limit = 100) => {
    const { data } = await supabase
      .from('ai_notification_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    
    if (data) setLogs(data as NotificationLog[]);
  }, []);

  // Carregar todos os dados
  const loadAllData = useCallback(async () => {
    if (!isAuthorized) return;
    
    await Promise.all([
      loadConfig(),
      loadKnowledgeBase(),
      loadRules(),
      loadTemplates(),
      loadContacts(),
      loadLogs(),
    ]);
  }, [isAuthorized, loadConfig, loadKnowledgeBase, loadRules, loadTemplates, loadContacts, loadLogs]);

  // Atualizar configuração
  const updateConfig = async (updates: Partial<AgentConfig>) => {
    if (!config?.id) return;
    
    const { error } = await supabase
      .from('ai_agent_config')
      .update(updates)
      .eq('id', config.id);
    
    if (!error) {
      setConfig({ ...config, ...updates });
    }
    return { error };
  };

  // CRUD Knowledge Base
  const addKnowledge = async (item: Omit<KnowledgeBase, 'id' | 'created_at'>) => {
    const { data, error } = await supabase
      .from('ai_knowledge_base')
      .insert({ ...item, created_by: user?.id })
      .select()
      .single();
    
    if (data) setKnowledgeBase([data as KnowledgeBase, ...knowledgeBase]);
    return { data, error };
  };

  const updateKnowledge = async (id: string, updates: Partial<KnowledgeBase>) => {
    const { error } = await supabase
      .from('ai_knowledge_base')
      .update(updates)
      .eq('id', id);
    
    if (!error) {
      setKnowledgeBase(knowledgeBase.map(k => k.id === id ? { ...k, ...updates } : k));
    }
    return { error };
  };

  const deleteKnowledge = async (id: string) => {
    const { error } = await supabase
      .from('ai_knowledge_base')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setKnowledgeBase(knowledgeBase.filter(k => k.id !== id));
    }
    return { error };
  };

  // CRUD Rules
  const addRule = async (rule: Omit<NotificationRule, 'id'>) => {
    const { data, error } = await supabase
      .from('ai_notification_rules')
      .insert(rule)
      .select()
      .single();
    
    if (data) setRules([data as NotificationRule, ...rules]);
    return { data, error };
  };

  const updateRule = async (id: string, updates: Partial<NotificationRule>) => {
    const { error } = await supabase
      .from('ai_notification_rules')
      .update(updates)
      .eq('id', id);
    
    if (!error) {
      setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
    }
    return { error };
  };

  const deleteRule = async (id: string) => {
    const { error } = await supabase
      .from('ai_notification_rules')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setRules(rules.filter(r => r.id !== id));
    }
    return { error };
  };

  // CRUD Templates
  const addTemplate = async (template: Omit<NotificationTemplate, 'id'>) => {
    const { data, error } = await supabase
      .from('ai_notification_templates')
      .insert(template)
      .select()
      .single();
    
    if (data) setTemplates([...templates, data as NotificationTemplate]);
    return { data, error };
  };

  const updateTemplate = async (id: string, updates: Partial<NotificationTemplate>) => {
    const { error } = await supabase
      .from('ai_notification_templates')
      .update(updates)
      .eq('id', id);
    
    if (!error) {
      setTemplates(templates.map(t => t.id === id ? { ...t, ...updates } : t));
    }
    return { error };
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase
      .from('ai_notification_templates')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setTemplates(templates.filter(t => t.id !== id));
    }
    return { error };
  };

  // CRUD Contacts
  const addContact = async (contact: Omit<CustomerContact, 'id'>) => {
    const { data, error } = await supabase
      .from('customer_contacts')
      .insert(contact)
      .select()
      .single();
    
    if (data) setContacts([...contacts, data as CustomerContact]);
    return { data, error };
  };

  const updateContact = async (id: string, updates: Partial<CustomerContact>) => {
    const { error } = await supabase
      .from('customer_contacts')
      .update(updates)
      .eq('id', id);
    
    if (!error) {
      setContacts(contacts.map(c => c.id === id ? { ...c, ...updates } : c));
    }
    return { error };
  };

  const deleteContact = async (id: string) => {
    const { error } = await supabase
      .from('customer_contacts')
      .delete()
      .eq('id', id);
    
    if (!error) {
      setContacts(contacts.filter(c => c.id !== id));
    }
    return { error };
  };

  // Testar envio de notificação
  const testNotification = async (orderId: string, channel: 'whatsapp' | 'email') => {
    const { data, error } = await supabase.functions.invoke('ai-agent-notify', {
      body: {
        order_id: orderId,
        trigger_type: 'manual',
        channel,
      },
    });
    
    return { data, error };
  };

  useEffect(() => {
    checkAuthorization();
  }, [checkAuthorization]);

  useEffect(() => {
    if (isAuthorized) {
      loadAllData();
    }
  }, [isAuthorized, loadAllData]);

  return {
    isAuthorized,
    loading,
    config,
    knowledgeBase,
    rules,
    templates,
    contacts,
    logs,
    updateConfig,
    addKnowledge,
    updateKnowledge,
    deleteKnowledge,
    addRule,
    updateRule,
    deleteRule,
    addTemplate,
    updateTemplate,
    deleteTemplate,
    addContact,
    updateContact,
    deleteContact,
    testNotification,
    loadLogs,
    refresh: loadAllData,
  };
}
