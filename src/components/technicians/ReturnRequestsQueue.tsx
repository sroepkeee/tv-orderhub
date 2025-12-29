import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, X, Truck, Eye, Package, MapPin, Scale, Image } from 'lucide-react';
import { useReturnRequests } from '@/hooks/useReturnRequests';
import { useCarriers } from '@/hooks/useCarriers';
import { returnRequestStatusLabels, returnRequestStatusColors, WAREHOUSE_DESTINATIONS } from '@/types/technicians';
import type { ReturnRequest, ReturnRequestStatus } from '@/types/technicians';

export function ReturnRequestsQueue() {
  const [activeTab, setActiveTab] = useState<ReturnRequestStatus | 'all'>('pending');
  const { requests, loading, approveRequest, rejectRequest, schedulePickup, confirmReceipt } = useReturnRequests({ 
    status: activeTab === 'all' ? undefined : activeTab 
  });
  const { carriers } = useCarriers();
  
  const [selectedRequest, setSelectedRequest] = useState<ReturnRequest | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [scheduleData, setScheduleData] = useState({ date: '', carrierId: '' });

  const handleApprove = async (request: ReturnRequest) => {
    await approveRequest(request.id);
  };

  const handleReject = async () => {
    if (selectedRequest && rejectReason) {
      await rejectRequest(selectedRequest.id, rejectReason);
      setShowRejectDialog(false);
      setRejectReason('');
      setSelectedRequest(null);
    }
  };

  const handleSchedule = async () => {
    if (selectedRequest && scheduleData.date) {
      await schedulePickup(selectedRequest.id, scheduleData.date, scheduleData.carrierId || undefined);
      setShowScheduleDialog(false);
      setScheduleData({ date: '', carrierId: '' });
      setSelectedRequest(null);
    }
  };

  const handleConfirmReceipt = async (request: ReturnRequest) => {
    await confirmReceipt(request.id);
  };

  const openDetailsDialog = (request: ReturnRequest) => {
    setSelectedRequest(request);
    setShowDetailsDialog(true);
  };

  const openRejectDialog = (request: ReturnRequest) => {
    setSelectedRequest(request);
    setShowRejectDialog(true);
  };

  const openScheduleDialog = (request: ReturnRequest) => {
    setSelectedRequest(request);
    setShowScheduleDialog(true);
  };

  const getDestinationLabel = (request: ReturnRequest) => {
    if (request.destination_type === 'technician') {
      return `→ ${request.destination_technician?.name || 'Técnico'}`;
    }
    const warehouse = WAREHOUSE_DESTINATIONS.find(w => w.id === request.destination_warehouse);
    return warehouse?.name || request.destination_warehouse;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fila de Solicitações de Retorno</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as ReturnRequestStatus | 'all')}>
          <TabsList>
            <TabsTrigger value="pending">Pendentes</TabsTrigger>
            <TabsTrigger value="approved">Aprovados</TabsTrigger>
            <TabsTrigger value="scheduled">Agendados</TabsTrigger>
            <TabsTrigger value="in_transit">Em Trânsito</TabsTrigger>
            <TabsTrigger value="received">Recebidos</TabsTrigger>
            <TabsTrigger value="all">Todos</TabsTrigger>
          </TabsList>

          <TabsContent value={activeTab} className="mt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Técnico</TableHead>
                    <TableHead>Destino</TableHead>
                    <TableHead>Data Solicitação</TableHead>
                    <TableHead>Volumes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Nenhuma solicitação encontrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((request) => (
                      <TableRow key={request.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{request.technician?.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {request.technician?.city}/{request.technician?.state}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={
                            request.destination_type === 'technician' 
                              ? 'bg-purple-500/10 text-purple-500 border-purple-500/20'
                              : ''
                          }>
                            {getDestinationLabel(request)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {format(new Date(request.requested_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          {request.total_volumes || 1} vol • {request.total_weight_kg?.toFixed(1) || '-'} kg
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={returnRequestStatusColors[request.status]}>
                            {returnRequestStatusLabels[request.status]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDetailsDialog(request)}
                              title="Ver detalhes"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            
                            {request.status === 'pending' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-emerald-500"
                                  onClick={() => handleApprove(request)}
                                  title="Aprovar"
                                >
                                  <Check className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="text-destructive"
                                  onClick={() => openRejectDialog(request)}
                                  title="Rejeitar"
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </>
                            )}

                            {request.status === 'approved' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-blue-500"
                                onClick={() => openScheduleDialog(request)}
                                title="Agendar coleta"
                              >
                                <Truck className="h-4 w-4" />
                              </Button>
                            )}

                            {request.status === 'in_transit' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleConfirmReceipt(request)}
                              >
                                Confirmar Recebimento
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>

      {/* Dialog de Detalhes */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Solicitação</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Técnico</Label>
                  <p className="font-medium">{selectedRequest.technician?.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedRequest.technician?.city}/{selectedRequest.technician?.state}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Destino</Label>
                  <p className="font-medium">{getDestinationLabel(selectedRequest)}</p>
                </div>
              </div>

              {selectedRequest.pickup_address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <Label className="text-muted-foreground">Endereço de Coleta</Label>
                    <p>{selectedRequest.pickup_address}</p>
                    <p className="text-sm text-muted-foreground">
                      {selectedRequest.pickup_city}/{selectedRequest.pickup_state} - {selectedRequest.pickup_zip_code}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-2">
                <Scale className="h-4 w-4 text-muted-foreground mt-1" />
                <div>
                  <Label className="text-muted-foreground">Volumes</Label>
                  <p>
                    {selectedRequest.total_volumes || 1} volume(s) • {selectedRequest.total_weight_kg?.toFixed(2) || '-'} kg
                  </p>
                </div>
              </div>

              {selectedRequest.photo_urls && selectedRequest.photo_urls.length > 0 && (
                <div className="flex items-start gap-2">
                  <Image className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <Label className="text-muted-foreground">Fotos Anexadas</Label>
                    <div className="flex gap-2 mt-2">
                      {selectedRequest.photo_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Foto ${i + 1}`} className="h-20 w-20 object-cover rounded border" />
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {selectedRequest.notes && (
                <div>
                  <Label className="text-muted-foreground">Observações</Label>
                  <p className="text-sm">{selectedRequest.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailsDialog(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Rejeição */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejeitar Solicitação</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Motivo da Rejeição *</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Informe o motivo..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={!rejectReason}>
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Agendamento */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agendar Coleta</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Data da Coleta *</Label>
              <Input
                type="date"
                value={scheduleData.date}
                onChange={(e) => setScheduleData({ ...scheduleData, date: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Transportadora</Label>
              <Select
                value={scheduleData.carrierId}
                onValueChange={(v) => setScheduleData({ ...scheduleData, carrierId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {carriers.map((carrier) => (
                    <SelectItem key={carrier.id} value={carrier.id}>
                      {carrier.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSchedule} disabled={!scheduleData.date}>
              Agendar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
