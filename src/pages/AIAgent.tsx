import { useAIAgentAdmin } from "@/hooks/useAIAgentAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Bot, ShieldAlert, LayoutDashboard, Truck, Users, Link2, Book, History } from "lucide-react";
import { AIAgentDashboardTab } from "@/components/ai-agent/AIAgentDashboardTab";
import { AIAgentConfigTab } from "@/components/ai-agent/AIAgentConfigTab";
import { AIAgentKnowledgeTab } from "@/components/ai-agent/AIAgentKnowledgeTab";
import { AIAgentQuoteTab } from "@/components/ai-agent/AIAgentQuoteTab";
import { AIAgentConnectionsTab } from "@/components/ai-agent/AIAgentConnectionsTab";
import { AIAgentLogsTab } from "@/components/ai-agent/AIAgentLogsTab";
import { AIAgentContactsTab } from "@/components/ai-agent/AIAgentContactsTab";

export default function AIAgent() {
  const {
    isAuthorized,
    loading,
    config,
    knowledgeBase,
    templates,
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Central de Agentes de IA</h1>
          <p className="text-muted-foreground">
            Gerencie os agentes de cotação e notificação de clientes
          </p>
        </div>
        {config && (
          <div className="ml-auto flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${
              config.is_active 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${config.is_active ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
              {config.is_active ? 'Sistema Ativo' : 'Sistema Inativo'}
            </span>
          </div>
        )}
      </div>

      {/* Main Tabs - Multi-Agent Structure */}
      <Tabs defaultValue="dashboard" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Visão Geral</span>
          </TabsTrigger>
          <TabsTrigger value="quote-agent" className="flex items-center gap-2">
            <Truck className="h-4 w-4" />
            <span className="hidden sm:inline">Agente Cotação</span>
          </TabsTrigger>
          <TabsTrigger value="customer-agent" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Agente Clientes</span>
          </TabsTrigger>
          <TabsTrigger value="connections" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            <span className="hidden sm:inline">Conexões</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            <span className="hidden sm:inline">Conhecimento</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
        </TabsList>

        {/* Dashboard - Unified View */}
        <TabsContent value="dashboard">
          <AIAgentDashboardTab 
            config={config} 
            onToggleActive={handleToggleActive} 
          />
        </TabsContent>

        {/* Quote Agent - Carriers */}
        <TabsContent value="quote-agent">
          <AIAgentQuoteTab />
        </TabsContent>

        {/* Customer Agent - Notifications */}
        <TabsContent value="customer-agent">
          <div className="space-y-6">
            <AIAgentConfigTab config={config} onUpdate={updateConfig} />
            <AIAgentContactsTab 
              contacts={contacts}
              onAdd={addContact}
              onUpdate={updateContact}
              onDelete={deleteContact}
            />
          </div>
        </TabsContent>

        {/* Connections - WhatsApp & API */}
        <TabsContent value="connections">
          <AIAgentConnectionsTab />
        </TabsContent>

        {/* Knowledge Base */}
        <TabsContent value="knowledge">
          <AIAgentKnowledgeTab 
            items={knowledgeBase} 
            onAdd={addKnowledge}
            onUpdate={updateKnowledge}
            onDelete={deleteKnowledge}
          />
        </TabsContent>

        {/* Logs */}
        <TabsContent value="logs">
          <AIAgentLogsTab logs={logs} onRefresh={loadLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
