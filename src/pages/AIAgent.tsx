import { useState } from "react";
import { useAIAgentAdmin } from "@/hooks/useAIAgentAdmin";
import { cn } from "@/lib/utils";
import { Loader2, Bot, ShieldAlert, BarChart3, MessageSquare, CalendarDays, FolderOpen, Shield, Users, Link2, Book, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AIAgentDashboardTab } from "@/components/ai-agent/AIAgentDashboardTab";
import { AIAgentKnowledgeTab } from "@/components/ai-agent/AIAgentKnowledgeTab";
import { AIAgentQuoteTab } from "@/components/ai-agent/AIAgentQuoteTab";
import { AIAgentConnectionsTab } from "@/components/ai-agent/AIAgentConnectionsTab";
import { AIAgentLogsTab } from "@/components/ai-agent/AIAgentLogsTab";
import { AIAgentContactsTab } from "@/components/ai-agent/AIAgentContactsTab";
import { AIAgentMessagesTab } from "@/components/ai-agent/AIAgentMessagesTab";
import { AIAgentFilesTab } from "@/components/ai-agent/AIAgentFilesTab";
import { AIAgentComplianceTab } from "@/components/ai-agent/AIAgentComplianceTab";

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  description?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Indicadores', icon: <BarChart3 className="h-5 w-5" />, description: 'Visão geral e métricas' },
  { id: 'messages', label: 'Mensagens', icon: <MessageSquare className="h-5 w-5" />, description: 'Conversas dos agentes' },
  { id: 'logs', label: 'Eventos', icon: <CalendarDays className="h-5 w-5" />, description: 'Log de eventos' },
  { id: 'files', label: 'Arquivos', icon: <FolderOpen className="h-5 w-5" />, description: 'Arquivos enviados' },
  { id: 'rules', label: 'Regras', icon: <Shield className="h-5 w-5" />, description: 'Políticas de compliance' },
  { id: 'contacts', label: 'Contatos', icon: <Users className="h-5 w-5" />, description: 'Gerenciar contatos' },
  { id: 'connections', label: 'Conexões', icon: <Link2 className="h-5 w-5" />, description: 'WhatsApp e API' },
  { id: 'knowledge', label: 'Conhecimento', icon: <Book className="h-5 w-5" />, description: 'Base de conhecimento' },
];

export default function AIAgent() {
  const {
    isAuthorized,
    loading,
    config,
    knowledgeBase,
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

  const [activeTab, setActiveTab] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  const handleToggleActive = async (active: boolean) => {
    await updateConfig({ is_active: active });
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <AIAgentDashboardTab config={config} onToggleActive={handleToggleActive} />;
      case 'messages':
        return <AIAgentMessagesTab />;
      case 'quote':
        return <AIAgentQuoteTab />;
      case 'logs':
        return <AIAgentLogsTab logs={logs} onRefresh={loadLogs} />;
      case 'files':
        return <AIAgentFilesTab />;
      case 'rules':
        return <AIAgentComplianceTab />;
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
            items={knowledgeBase} 
            onAdd={addKnowledge}
            onUpdate={updateKnowledge}
            onDelete={deleteKnowledge}
          />
        );
      default:
        return <AIAgentDashboardTab config={config} onToggleActive={handleToggleActive} />;
    }
  };

  return (
    <TooltipProvider>
      <div className="flex h-screen bg-background">
        {/* Sidebar */}
        <aside 
          className={cn(
            "h-full border-r bg-card flex flex-col transition-all duration-300",
            sidebarCollapsed ? "w-16" : "w-64"
          )}
        >
          {/* Sidebar Header */}
          <div className="p-4 border-b flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
              <Bot className="h-6 w-6 text-primary" />
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <h1 className="font-semibold truncate">Agentes de IA</h1>
                <p className="text-xs text-muted-foreground truncate">
                  Gestão centralizada
                </p>
              </div>
            )}
          </div>

          {/* Status Badge */}
          {!sidebarCollapsed && config && (
            <div className="px-4 py-2 border-b">
              <div className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium",
                config.is_active 
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                  : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
              )}>
                <span className={cn(
                  "w-2 h-2 rounded-full",
                  config.is_active ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'
                )} />
                {config.is_active ? 'Sistema Ativo' : 'Sistema Inativo'}
              </div>
            </div>
          )}

          {/* Navigation */}
          <ScrollArea className="flex-1 py-2">
            <nav className="px-2 space-y-1">
              {NAV_ITEMS.map((item) => (
                <Tooltip key={item.id} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setActiveTab(item.id)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left",
                        activeTab === item.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <span className="flex-shrink-0">{item.icon}</span>
                      {!sidebarCollapsed && (
                        <span className="truncate text-sm font-medium">{item.label}</span>
                      )}
                    </button>
                  </TooltipTrigger>
                  {sidebarCollapsed && (
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
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              {sidebarCollapsed ? (
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
  );
}
