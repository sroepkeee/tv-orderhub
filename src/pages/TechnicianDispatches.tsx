import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, RotateCcw, Users, BarChart3, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import MainLayout from '@/layouts/MainLayout';
import { TechnicianDispatchesTable } from '@/components/technicians/TechnicianDispatchesTable';
import { TechnicianManagementTab } from '@/components/technicians/TechnicianManagementTab';
import { ReturnRequestsQueue } from '@/components/technicians/ReturnRequestsQueue';
import { DispatchMetricsCards } from '@/components/technicians/DispatchMetricsCards';
import { useTechnicianDispatches } from '@/hooks/useTechnicianDispatches';
import { useReturnRequests } from '@/hooks/useReturnRequests';
import { DispatchMetrics } from '@/types/technicians';

const defaultMetrics: DispatchMetrics = {
  total_dispatches: 0,
  total_items_sent: 0,
  total_items_pending: 0,
  total_items_returned: 0,
  overdue_dispatches: 0,
  pending_return_requests: 0,
};

export default function TechnicianDispatches() {
  const [activeTab, setActiveTab] = useState('dispatches');
  const { dispatches, metrics, loading: dispatchesLoading, fetchDispatches } = useTechnicianDispatches();
  const { requests: pendingRequests, loading: requestsLoading } = useReturnRequests({ status: 'pending' });
  
  const safeMetrics = metrics || defaultMetrics;

  return (
    <MainLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Controle de Remessas para Técnicos</h1>
            <p className="text-muted-foreground">
              Gerencie envios, retornos e transferências de materiais
            </p>
          </div>
        </div>

        {/* Métricas */}
        <DispatchMetricsCards 
          metrics={safeMetrics} 
          pendingReturns={pendingRequests.length} 
          loading={dispatchesLoading} 
        />

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
            <TabsTrigger value="dispatches" className="gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Envios</span>
            </TabsTrigger>
            <TabsTrigger value="returns" className="gap-2">
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Retornos</span>
              {pendingRequests.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs text-white">
                  {pendingRequests.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="technicians" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Técnicos</span>
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Métricas</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dispatches" className="mt-6">
            <TechnicianDispatchesTable 
              dispatches={dispatches} 
              loading={dispatchesLoading}
              onRefresh={fetchDispatches}
            />
          </TabsContent>

          <TabsContent value="returns" className="mt-6">
            <ReturnRequestsQueue />
          </TabsContent>

          <TabsContent value="technicians" className="mt-6">
            <TechnicianManagementTab />
          </TabsContent>

          <TabsContent value="metrics" className="mt-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Taxa de Retorno</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {safeMetrics.total_items_sent > 0 
                      ? Math.round((safeMetrics.total_items_returned / safeMetrics.total_items_sent) * 100)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {safeMetrics.total_items_returned} de {safeMetrics.total_items_sent} itens retornados
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Envios Atrasados</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-red-500">
                    {safeMetrics.overdue_dispatches}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Aguardando retorno há mais de 30 dias
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Tempo Médio em Campo</CardTitle>
                  <Clock className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    -- dias
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Média de permanência com técnicos
                  </p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
