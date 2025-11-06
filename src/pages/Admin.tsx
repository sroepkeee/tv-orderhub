import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserManagementTable } from "@/components/admin/UserManagementTable";
import { PhasePermissionsMatrix } from "@/components/admin/PhasePermissionsMatrix";
import { PermissionAuditLog } from "@/components/admin/PermissionAuditLog";
import { Shield } from "lucide-react";

const Admin = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
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
