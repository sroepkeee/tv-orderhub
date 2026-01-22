import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagementTable } from "@/components/admin/UserManagementTable";
import { PermissionAuditLog } from "@/components/admin/PermissionAuditLog";
import { UserAccessMetrics } from "@/components/admin/UserAccessMetrics";
import { UserPresenceDashboard } from "@/components/admin/UserPresenceDashboard";
import { RecentActivityFeed } from "@/components/admin/RecentActivityFeed";
import { UserSessionsTable } from "@/components/admin/UserSessionsTable";
import { LoginAuditTable } from "@/components/admin/LoginAuditTable";
import { ManagementReportSettings } from "@/components/admin/ManagementReportSettings";
import { MessageQueueDashboard } from "@/components/admin/MessageQueueDashboard";
import { PhaseManagersConfig } from "@/components/admin/PhaseManagersConfig";
import { UserMenuPermissionsMatrix } from "@/components/admin/UserMenuPermissionsMatrix";
import { ChangeRequestsQueue } from "@/components/admin/ChangeRequestsQueue";
import { PhaseConfigSection } from "@/components/phases/PhaseConfigSection";
import { UserPhasePermissionsMatrix } from "@/components/admin/UserPhasePermissionsMatrix";
import { DiscordWebhooksConfig } from "@/components/admin/DiscordWebhooksConfig";
import { CronJobsDashboard } from "@/components/admin/CronJobsDashboard";
import { Shield, ArrowLeft, BarChart3, MessageSquare, Settings2, UserCog, Menu, ClipboardEdit, Users, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
const Admin = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-[99%] mx-auto py-6 px-4">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-3"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-7 w-7 text-primary" />
            <h1 className="text-3xl font-bold">Gerenciamento de Usuários</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Controle de acesso, aprovações e permissões do sistema
          </p>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="flex flex-wrap w-full gap-1 mb-4 h-auto p-1">
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="managers" className="flex items-center gap-1">
              <UserCog className="h-3 w-3" />
              Gestores
            </TabsTrigger>
            <TabsTrigger value="menus" className="flex items-center gap-1">
              <Menu className="h-3 w-3" />
              Menus
            </TabsTrigger>
            <TabsTrigger value="change-requests" className="flex items-center gap-1">
              <ClipboardEdit className="h-3 w-3" />
              Alterações
            </TabsTrigger>
            <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              Relatórios
            </TabsTrigger>
            <TabsTrigger value="queue" className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              Fila de Msgs
            </TabsTrigger>
            <TabsTrigger value="discord" className="flex items-center gap-1">
              <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
              </svg>
              Discord
            </TabsTrigger>
            <TabsTrigger value="phases" className="flex items-center gap-1">
              <Settings2 className="h-3 w-3" />
              Fases
            </TabsTrigger>
            <TabsTrigger value="cron-jobs" className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Cron Jobs
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <UserManagementTable />
          </TabsContent>

          <TabsContent value="managers" className="space-y-4">
            <PhaseManagersConfig />
          </TabsContent>

          <TabsContent value="menus" className="space-y-4">
            <UserMenuPermissionsMatrix />
          </TabsContent>

          <TabsContent value="change-requests" className="space-y-4">
            <ChangeRequestsQueue />
          </TabsContent>

          <TabsContent value="monitoring" className="space-y-4">
            <UserAccessMetrics />
            <div className="grid md:grid-cols-2 gap-4">
              <UserPresenceDashboard />
              <RecentActivityFeed />
            </div>
            <LoginAuditTable />
            <UserSessionsTable />
          </TabsContent>

          <TabsContent value="audit" className="space-y-4">
            <PermissionAuditLog />
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <ManagementReportSettings />
          </TabsContent>

          <TabsContent value="queue" className="space-y-4">
            <MessageQueueDashboard />
          </TabsContent>

          <TabsContent value="discord" className="space-y-4">
            <DiscordWebhooksConfig />
          </TabsContent>

          <TabsContent value="phases" className="space-y-4">
            <Tabs defaultValue="workflow" className="space-y-4">
              <TabsList>
                <TabsTrigger value="workflow" className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  Fases do Workflow
                </TabsTrigger>
                <TabsTrigger value="user-permissions" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Permissões por Usuário
                </TabsTrigger>
              </TabsList>

              <TabsContent value="workflow">
                <PhaseConfigSection />
              </TabsContent>

              <TabsContent value="user-permissions">
                <UserPhasePermissionsMatrix />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="cron-jobs" className="space-y-4">
            <CronJobsDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
