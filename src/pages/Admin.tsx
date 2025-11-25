import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagementTable } from "@/components/admin/UserManagementTable";
import { PermissionAuditLog } from "@/components/admin/PermissionAuditLog";
import { UserAccessMetrics } from "@/components/admin/UserAccessMetrics";
import { UserPresenceDashboard } from "@/components/admin/UserPresenceDashboard";
import { RecentActivityFeed } from "@/components/admin/RecentActivityFeed";
import { UserSessionsTable } from "@/components/admin/UserSessionsTable";
import { LoginAuditTable } from "@/components/admin/LoginAuditTable";
import { Shield, ArrowLeft } from "lucide-react";
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
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="monitoring">Monitoramento</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <UserManagementTable />
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
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
