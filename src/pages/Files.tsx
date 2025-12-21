import { AIAgentFilesTab } from "@/components/ai-agent/AIAgentFilesTab";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/sidebar/AppSidebar";

const Files = () => {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar orders={[]} />
        <SidebarInset>
          <div className="flex flex-col h-screen">
            <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
              <SidebarTrigger />
              <div>
                <h1 className="text-lg font-semibold">Arquivos</h1>
                <p className="text-sm text-muted-foreground">Arquivos enviados e recebidos</p>
              </div>
            </header>
            <main className="flex-1 overflow-auto p-6">
              <AIAgentFilesTab />
            </main>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default Files;
