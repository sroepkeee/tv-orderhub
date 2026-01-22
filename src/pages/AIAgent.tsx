import { useState, useEffect } from "react";
import { useAIAgentAdmin } from "@/hooks/useAIAgentAdmin";
import { cn } from "@/lib/utils";
import { Loader2, Bot, ShieldAlert, BarChart3, MessageSquare, CalendarDays, Shield, Users, Link2, Book, ChevronLeft, ChevronRight, Settings, FileText, Brain, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/sidebar/AppSidebar";
import { AIAgentDashboardTab } from "@/components/ai-agent/AIAgentDashboardTab";
import { AIAgentKnowledgeTab } from "@/components/ai-agent/AIAgentKnowledgeTab";
import { AIAgentQuoteTab } from "@/components/ai-agent/AIAgentQuoteTab";
import { AIAgentConnectionsTab } from "@/components/ai-agent/AIAgentConnectionsTab";
import { AIAgentLogsTab } from "@/components/ai-agent/AIAgentLogsTab";
import { AIAgentContactsTab } from "@/components/ai-agent/AIAgentContactsTab";
import { AIAgentMessagesTab } from "@/components/ai-agent/AIAgentMessagesTab";

import { AIAgentComplianceTab } from "@/components/ai-agent/AIAgentComplianceTab";
import { AIAgentConfigTab } from "@/components/ai-agent/AIAgentConfigTab";
import { AIAgentPoliciesTab } from "@/components/ai-agent/AIAgentPoliciesTab";
import AIAgentInstancesTab from "@/components/ai-agent/AIAgentInstancesTab";
import AIAgentLearningTab from "@/components/ai-agent/AIAgentLearningTab";
import { AIAgentManagerTriggersTab } from "@/components/ai-agent/AIAgentManagerTriggersTab";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'manager-triggers', label: 'Gatilhos Gerenciais', icon: <Bell className="h-5 w-5" />, description: 'Ações rápidas e notificações' },
  { id: 'dashboard', label: 'Dashboard', icon: <BarChart3 className="h-5 w-5" />, description: 'Visão geral e métricas' },
  { id: 'instances', label: 'Agentes', icon: <Bot className="h-5 w-5" />, description: 'Gerenciar agentes de IA' },
  { id: 'config', label: 'Config. Globais', icon: <Settings className="h-5 w-5" />, description: 'Configurações compartilhadas' },
  { id: 'learning', label: 'Aprendizado', icon: <Brain className="h-5 w-5" />, description: 'Evolução e retroalimentação' },
  { id: 'knowledge', label: 'Base de Conhecimento', icon: <Book className="h-5 w-5" />, description: 'RAG e documentos' },
  { id: 'messages', label: 'Mensagens', icon: <MessageSquare className="h-5 w-5" />, description: 'Conversas dos agentes' },
  { id: 'logs', label: 'Eventos', icon: <CalendarDays className="h-5 w-5" />, description: 'Log de eventos' },
  { id: 'rules', label: 'Regras', icon: <Shield className="h-5 w-5" />, description: 'Regras de compliance' },
  { id: 'policies', label: 'Políticas', icon: <FileText className="h-5 w-5" />, description: 'Políticas de negócio' },
  { id: 'contacts', label: 'Contatos', icon: <Users className="h-5 w-5" />, description: 'Gerenciar contatos' },
  { id: 'connections', label: 'Conexões', icon: <Link2 className="h-5 w-5" />, description: 'WhatsApp e API' },
];

export default function AIAgent() {
  const {
    isAuthorized,
    loading,
    config,
    knowledgeBase,
    getKnowledgeForAgent,
    contacts,
    logs,
    updateConfig,
    addKnowledge,
    updateKnowledge,
    deleteKnowledge,
    addContact,
    updateContact,
    deleteContact,
    loadLogs,
  } = useAIAgentAdmin();

  const [activeTab, setActiveTab] = useState('manager-triggers');
  const [internalSidebarCollapsed, setInternalSidebarCollapsed] = useState(false);

  // Listen for navigation events from child components
  useEffect(() => {
    const handleNavigate = (event: CustomEvent) => {
      setActiveTab(event.detail);
    };
    
    window.addEventListener('navigate-to-tab', handleNavigate as EventListener);
    return () => {
      window.removeEventListener('navigate-to-tab', handleNavigate as EventListener);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-2xl font-bold">Acesso Restrito</h1>
        <p className="text-muted-foreground">
          Esta página é restrita aos Super Administradores do Agente de IA.
        </p>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AIAgentDashboardTab />;
      case 'instances':
        return <AIAgentInstancesTab />;
      case 'manager-triggers':
        return <AIAgentManagerTriggersTab />;
      case 'learning':
        return <AIAgentLearningTab />;
      case 'config':
        return <AIAgentConfigTab config={config} onUpdate={updateConfig} />;
      case 'messages':
        return <AIAgentMessagesTab />;
      case 'quote':
        return <AIAgentQuoteTab />;
      case 'logs':
        return <AIAgentLogsTab logs={logs} onRefresh={loadLogs} />;
      case 'rules':
        return <AIAgentComplianceTab />;
      case 'policies':
        return <AIAgentPoliciesTab />;
      case 'contacts':
        return (
          <AIAgentContactsTab 
            contacts={contacts}
            onAdd={addContact}
            onUpdate={updateContact}
            onDelete={deleteContact}
          />
        );
      case 'connections':
        return <AIAgentConnectionsTab />;
      case 'knowledge':
        return (
          <AIAgentKnowledgeTab 
            items={getKnowledgeForAgent('carrier')}
            allItems={knowledgeBase}
            selectedAgentType="carrier"
            onAdd={addKnowledge}
            onUpdate={updateKnowledge}
            onDelete={deleteKnowledge}
          />
        );
      default:
        return <AIAgentDashboardTab />;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        {/* Global AppSidebar */}
        <AppSidebar orders={[]} />

        <SidebarInset>
          <TooltipProvider>
            <div className="flex h-screen">
              {/* Internal AI Agent Sidebar */}
              <aside 
                className={cn(
                  "h-full border-r bg-card flex flex-col transition-all duration-300 flex-shrink-0",
                  internalSidebarCollapsed ? "w-16" : "w-56"
                )}
              >
                {/* Sidebar Header with Global Trigger */}
                <div className="p-3 border-b flex items-center gap-2">
                  <SidebarTrigger className="flex-shrink-0" />
                  <div className="p-1.5 bg-primary/10 rounded-lg flex-shrink-0">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  {!internalSidebarCollapsed && (
                    <div className="flex-1 min-w-0">
                      <h1 className="font-semibold text-sm truncate">Agentes IA</h1>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                <ScrollArea className="flex-1 py-2">
                  <nav className="px-2 space-y-0.5">
                    {NAV_ITEMS.map((item) => (
                      <Tooltip key={item.id} delayDuration={0}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setActiveTab(item.id)}
                            className={cn(
                              "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-colors text-left",
                              activeTab === item.id
                                ? "bg-primary text-primary-foreground"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <span className="flex-shrink-0">{item.icon}</span>
                            {!internalSidebarCollapsed && (
                              <span className="truncate text-sm">{item.label}</span>
                            )}
                          </button>
                        </TooltipTrigger>
                        {internalSidebarCollapsed && (
                          <TooltipContent side="right">
                            <p>{item.label}</p>
                            {item.description && (
                              <p className="text-xs text-muted-foreground">{item.description}</p>
                            )}
                          </TooltipContent>
                        )}
                      </Tooltip>
                    ))}
                  </nav>
                </ScrollArea>

                {/* Collapse Button */}
                <div className="p-2 border-t">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setInternalSidebarCollapsed(!internalSidebarCollapsed)}
                  >
                    {internalSidebarCollapsed ? (
                      <ChevronRight className="h-4 w-4" />
                    ) : (
                      <>
                        <ChevronLeft className="h-4 w-4 mr-2" />
                        <span className="text-xs">Recolher</span>
                      </>
                    )}
                  </Button>
                </div>
              </aside>

              {/* Main Content */}
              <main className="flex-1 overflow-auto">
                <div className="p-6">
                  {/* Page Header */}
                  <div className="mb-6">
                    <h2 className="text-2xl font-bold">
                      {NAV_ITEMS.find(i => i.id === activeTab)?.label}
                    </h2>
                    <p className="text-muted-foreground">
                      {NAV_ITEMS.find(i => i.id === activeTab)?.description}
                    </p>
                  </div>

                  {/* Content */}
                  {renderContent()}
                </div>
              </main>
            </div>
          </TooltipProvider>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}