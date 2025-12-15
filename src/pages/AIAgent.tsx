import { useAIAgentAdmin } from "@/hooks/useAIAgentAdmin";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Bot, ShieldAlert, Settings, Book, Bell, FileText, Users, History } from "lucide-react";
import { AIAgentConfigTab } from "@/components/ai-agent/AIAgentConfigTab";
import { AIAgentKnowledgeTab } from "@/components/ai-agent/AIAgentKnowledgeTab";
import { AIAgentRulesTab } from "@/components/ai-agent/AIAgentRulesTab";
import { AIAgentTemplatesTab } from "@/components/ai-agent/AIAgentTemplatesTab";
import { AIAgentContactsTab } from "@/components/ai-agent/AIAgentContactsTab";
import { AIAgentLogsTab } from "@/components/ai-agent/AIAgentLogsTab";

export default function AIAgent() {
  const {
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
    refresh,
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="p-3 bg-primary/10 rounded-lg">
          <Bot className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Agente de IA - Notificações</h1>
          <p className="text-muted-foreground">
            Configure o comportamento e regras do agente de notificações automáticas
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
              {config.is_active ? 'Ativo' : 'Inativo'}
            </span>
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Base de Conhecimento</CardDescription>
            <CardTitle className="text-3xl">{knowledgeBase.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Regras Ativas</CardDescription>
            <CardTitle className="text-3xl">{rules.filter(r => r.is_active).length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Templates</CardDescription>
            <CardTitle className="text-3xl">{templates.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Contatos</CardDescription>
            <CardTitle className="text-3xl">{contacts.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="config" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configuração</span>
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="flex items-center gap-2">
            <Book className="h-4 w-4" />
            <span className="hidden sm:inline">Conhecimento</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            <span className="hidden sm:inline">Regras</span>
          </TabsTrigger>
          <TabsTrigger value="templates" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Templates</span>
          </TabsTrigger>
          <TabsTrigger value="contacts" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Contatos</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="flex items-center gap-2">
            <History className="h-4 w-4" />
            <span className="hidden sm:inline">Logs</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <AIAgentConfigTab config={config} onUpdate={updateConfig} />
        </TabsContent>

        <TabsContent value="knowledge">
          <AIAgentKnowledgeTab 
            items={knowledgeBase} 
            onAdd={addKnowledge}
            onUpdate={updateKnowledge}
            onDelete={deleteKnowledge}
          />
        </TabsContent>

        <TabsContent value="rules">
          <AIAgentRulesTab 
            rules={rules}
            templates={templates}
            onAdd={addRule}
            onUpdate={updateRule}
            onDelete={deleteRule}
          />
        </TabsContent>

        <TabsContent value="templates">
          <AIAgentTemplatesTab 
            templates={templates}
            onAdd={addTemplate}
            onUpdate={updateTemplate}
            onDelete={deleteTemplate}
          />
        </TabsContent>

        <TabsContent value="contacts">
          <AIAgentContactsTab 
            contacts={contacts}
            onAdd={addContact}
            onUpdate={updateContact}
            onDelete={deleteContact}
          />
        </TabsContent>

        <TabsContent value="logs">
          <AIAgentLogsTab logs={logs} onRefresh={loadLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
