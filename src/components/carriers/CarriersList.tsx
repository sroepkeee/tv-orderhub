import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pencil, Power, Mail, Phone, MessageSquare } from 'lucide-react';
import type { Carrier } from '@/types/carriers';
import { useCarriers } from '@/hooks/useCarriers';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CarriersListProps {
  carriers: Carrier[];
  filteredState?: string;
  onEdit: (carrier: Carrier) => void;
  onCarriersChanged: () => void;
}

export function CarriersList({ carriers, filteredState, onEdit, onCarriersChanged }: CarriersListProps) {
  const { deleteCarrier } = useCarriers();
  const [carrierToDeactivate, setCarrierToDeactivate] = useState<Carrier | null>(null);

  const handleDeactivate = async () => {
    if (!carrierToDeactivate) return;

    try {
      await deleteCarrier(carrierToDeactivate.id);
      toast.success('Transportadora desativada com sucesso');
      onCarriersChanged();
      setCarrierToDeactivate(null);
    } catch (error: any) {
      toast.error(`Erro ao desativar: ${error.message}`);
    }
  };

  if (carriers.length === 0) {
    return (
      <div className="border rounded-lg p-12 text-center">
        <p className="text-muted-foreground">
          {filteredState 
            ? `Nenhuma transportadora encontrada que atenda ${filteredState}`
            : 'Nenhuma transportadora cadastrada'}
        </p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-[600px]">
        <div className="space-y-4">
          {carriers.map(carrier => (
            <div
              key={carrier.id}
              className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-start gap-3 mb-2">
                    <h3 className="font-semibold text-lg">{carrier.name}</h3>
                    {filteredState && carrier.service_states.includes(filteredState) && (
                      <Badge variant="default" className="bg-green-500 hover:bg-green-600">
                        ✓ Atende {filteredState}
                      </Badge>
                    )}
                  </div>
                  
                  {carrier.cnpj && (
                    <p className="text-sm text-muted-foreground">
                      CNPJ: {carrier.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')}
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(carrier)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCarrierToDeactivate(carrier)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Power className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Contato Principal</p>
                  <p className="font-medium text-sm">{carrier.contact_person}</p>
                  {carrier.contact_position && (
                    <p className="text-xs text-muted-foreground">{carrier.contact_position}</p>
                  )}
                </div>

                <div className="space-y-1">
                  {carrier.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-3 w-3 text-muted-foreground" />
                      <a href={`mailto:${carrier.email}`} className="hover:underline">
                        {carrier.email}
                      </a>
                    </div>
                  )}
                  {carrier.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-3 w-3 text-muted-foreground" />
                      <span>{carrier.phone}</span>
                    </div>
                  )}
                  {carrier.whatsapp && (
                    <div className="flex items-center gap-2 text-sm">
                      <MessageSquare className="h-3 w-3 text-muted-foreground" />
                      <span>{carrier.whatsapp}</span>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs text-muted-foreground mb-1">Emails Adicionais</p>
                  {carrier.quote_email && (
                    <p className="text-xs">Cotação: {carrier.quote_email}</p>
                  )}
                  {carrier.collection_email && (
                    <p className="text-xs">Coleta: {carrier.collection_email}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Estados Atendidos</p>
                  <div className="flex flex-wrap gap-1">
                    {carrier.service_states.map(state => (
                      <Badge key={state} variant="outline" className="text-xs">
                        {state}
                      </Badge>
                    ))}
                  </div>
                </div>

                {carrier.coverage_notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Observações de Cobertura</p>
                    <p className="text-sm">{carrier.coverage_notes}</p>
                  </div>
                )}

                {carrier.additional_contacts && carrier.additional_contacts.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Contatos Adicionais</p>
                    <div className="grid grid-cols-2 gap-2">
                      {carrier.additional_contacts.map((contact, i) => (
                        <div key={i} className="text-xs border rounded p-2">
                          <p className="font-medium">{contact.name}</p>
                          <p className="text-muted-foreground">{contact.role}</p>
                          <p>{contact.phone}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {carrier.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notas</p>
                    <p className="text-sm">{carrier.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      <AlertDialog open={!!carrierToDeactivate} onOpenChange={() => setCarrierToDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar Transportadora</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja desativar <strong>{carrierToDeactivate?.name}</strong>?
              <br />
              Esta transportadora não aparecerá mais nas listas, mas seus dados serão preservados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-destructive hover:bg-destructive/90">
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
