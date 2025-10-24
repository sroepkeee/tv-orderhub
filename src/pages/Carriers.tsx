import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Truck, Plus, Upload, TrendingUp, CheckCircle } from 'lucide-react';
import { useCarriers } from '@/hooks/useCarriers';
import { CarriersList } from '@/components/carriers/CarriersList';
import { CarrierManagementDialog } from '@/components/carriers/CarrierManagementDialog';
import { ImportCarriersDialog } from '@/components/carriers/ImportCarriersDialog';
import type { Carrier } from '@/types/carriers';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export default function Carriers() {
  const { carriers, loading, loadCarriers } = useCarriers();
  const [filteredState, setFilteredState] = useState<string>('');
  const [filteredCarriers, setFilteredCarriers] = useState<Carrier[]>([]);
  const [isManagementDialogOpen, setIsManagementDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [carrierToEdit, setCarrierToEdit] = useState<Carrier | undefined>();

  useEffect(() => {
    if (filteredState) {
      const filtered = carriers.filter(c => c.service_states.includes(filteredState));
      setFilteredCarriers(filtered);
    } else {
      setFilteredCarriers(carriers);
    }
  }, [filteredState, carriers]);

  const handleNewCarrier = () => {
    setCarrierToEdit(undefined);
    setIsManagementDialogOpen(true);
  };

  const handleEditCarrier = (carrier: Carrier) => {
    setCarrierToEdit(carrier);
    setIsManagementDialogOpen(true);
  };

  const handleCarriersChanged = () => {
    loadCarriers();
    setIsManagementDialogOpen(false);
    setIsImportDialogOpen(false);
  };

  const activeCarriers = carriers.filter(c => c.is_active);
  const coverageCount = filteredState 
    ? activeCarriers.filter(c => c.service_states.includes(filteredState)).length
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando transportadoras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Truck className="h-8 w-8 text-primary" />
              Gestão de Transportadoras
            </h1>
            <p className="text-muted-foreground mt-1">
              Gerencie o cadastro de transportadoras e suas áreas de cobertura
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleNewCarrier} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Transportadora
            </Button>
            <Button 
              onClick={() => setIsImportDialogOpen(true)}
              variant="outline"
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Importar Excel
            </Button>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-lg">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Cadastradas</p>
                <p className="text-2xl font-bold">{carriers.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-green-500/10 rounded-lg">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Ativas</p>
                <p className="text-2xl font-bold">{activeCarriers.length}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500/10 rounded-lg">
                <TrendingUp className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">
                  {filteredState ? `Cobertura ${filteredState}` : 'Cobertura Total'}
                </p>
                <p className="text-2xl font-bold">
                  {filteredState ? coverageCount : activeCarriers.length}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Filters */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium whitespace-nowrap">
              Filtrar por UF:
            </label>
            <Select value={filteredState} onValueChange={setFilteredState}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos os estados" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Todos os estados</SelectItem>
                {BRAZILIAN_STATES.map(state => (
                  <SelectItem key={state} value={state}>
                    {state}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {filteredState && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilteredState('')}
              >
                Limpar filtro
              </Button>
            )}
            <div className="text-sm text-muted-foreground ml-auto">
              Mostrando {filteredCarriers.length} de {carriers.length} transportadora(s)
            </div>
          </div>
        </Card>

        {/* List */}
        <Card className="p-6">
          <CarriersList
            carriers={filteredCarriers}
            filteredState={filteredState}
            onEdit={handleEditCarrier}
            onCarriersChanged={handleCarriersChanged}
          />
        </Card>
      </div>

      <CarrierManagementDialog
        open={isManagementDialogOpen}
        onOpenChange={setIsManagementDialogOpen}
        carrier={carrierToEdit}
      />

      <ImportCarriersDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onImportSuccess={handleCarriersChanged}
      />
    </div>
  );
}
