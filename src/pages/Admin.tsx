import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagementTable } from "@/components/admin/UserManagementTable";
import { PhasePermissionsMatrix } from "@/components/admin/PhasePermissionsMatrix";
import { PermissionAuditLog } from "@/components/admin/PermissionAuditLog";
import { Shield, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const Admin = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <div className="w-full max-w-[98%] mx-auto py-8 px-6">
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">Gerenciamento de Usuários</h1>
          </div>
          <p className="text-muted-foreground">
            Controle de acesso, aprovações e permissões do sistema
          </p>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="users">Usuários</TabsTrigger>
            <TabsTrigger value="permissions">Permissões</TabsTrigger>
            <TabsTrigger value="audit">Auditoria</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <UserManagementTable />
          </TabsContent>

          <TabsContent value="permissions" className="space-y-4">
            <PhasePermissionsMatrix />
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
