import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Plus, X, Loader2 } from 'lucide-react';
import { useCarriers } from '@/hooks/useCarriers';
import type { Carrier } from '@/types/carriers';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

interface CarrierManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  carrier?: Carrier | null;
}

export const CarrierManagementDialog = ({
  open,
  onOpenChange,
  carrier,
}: CarrierManagementDialogProps) => {
  const { createCarrier, updateCarrier } = useCarriers();
  const [saving, setSaving] = useState(false);

  const [formData, setFormData] = useState<Partial<Carrier>>({
    name: '',
    cnpj: '',
    email: '',
    quote_email: '',
    collection_email: '',
    phone: '',
    whatsapp: '',
    contact_person: '',
    contact_position: '',
    service_states: [],
    coverage_notes: '',
    notes: '',
    is_active: true,
    additional_contacts: [],
  });

  const [newContact, setNewContact] = useState({ name: '', phone: '', role: '' });

  useEffect(() => {
    if (carrier) {
      setFormData(carrier);
    } else {
      setFormData({
        name: '',
        cnpj: '',
        email: '',
        quote_email: '',
        collection_email: '',
        phone: '',
        whatsapp: '',
        contact_person: '',
        contact_position: '',
        service_states: [],
        coverage_notes: '',
        notes: '',
        is_active: true,
        additional_contacts: [],
      });
    }
  }, [carrier, open]);

  const handleSubmit = async () => {
    if (!formData.name || !formData.email || !formData.contact_person) {
      return;
    }

    setSaving(true);
    try {
      if (carrier?.id) {
        await updateCarrier(carrier.id, formData);
      } else {
        await createCarrier(formData as Omit<Carrier, 'id' | 'created_at' | 'updated_at'>);
      }
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const toggleState = (state: string) => {
    const currentStates = formData.service_states || [];
    if (currentStates.includes(state)) {
      setFormData({
        ...formData,
        service_states: currentStates.filter(s => s !== state),
      });
    } else {
      setFormData({
        ...formData,
        service_states: [...currentStates, state],
      });
    }
  };

  const addContact = () => {
    if (!newContact.name || !newContact.phone) return;
    
    const currentContacts = formData.additional_contacts || [];
    setFormData({
      ...formData,
      additional_contacts: [...currentContacts, newContact],
    });
    setNewContact({ name: '', phone: '', role: '' });
  };

  const removeContact = (index: number) => {
    const currentContacts = formData.additional_contacts || [];
    setFormData({
      ...formData,
      additional_contacts: currentContacts.filter((_, i) => i !== index),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {carrier ? 'Editar Transportadora' : 'Nova Transportadora'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name">Nome da Transportadora *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={formData.cnpj || ''}
                onChange={(e) => setFormData({ ...formData, cnpj: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>📧 E-mails</Label>
            <Input
              placeholder="E-mail Principal *"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
            <Input
              placeholder="E-mail para Cotações"
              value={formData.quote_email || ''}
              onChange={(e) => setFormData({ ...formData, quote_email: e.target.value })}
            />
            <Input
              placeholder="E-mail para Coletas"
              value={formData.collection_email || ''}
              onChange={(e) => setFormData({ ...formData, collection_email: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="whatsapp">📱 WhatsApp</Label>
              <Input
                id="whatsapp"
                value={formData.whatsapp || ''}
                onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 0000-0000"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="contact_person">👤 Responsável *</Label>
              <Input
                id="contact_person"
                value={formData.contact_person}
                onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_position">Cargo</Label>
              <Input
                id="contact_position"
                value={formData.contact_position || ''}
                onChange={(e) => setFormData({ ...formData, contact_position: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>📋 Contatos Adicionais</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Nome"
                value={newContact.name}
                onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
              />
              <Input
                placeholder="Telefone"
                value={newContact.phone}
                onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
              />
              <Input
                placeholder="Função"
                value={newContact.role}
                onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
              />
              <Button onClick={addContact} size="icon">
                <Plus className="h-4 w-4" />
              </Button>
            </div>

            {formData.additional_contacts && formData.additional_contacts.length > 0 && (
              <div className="space-y-2 mt-2">
                {formData.additional_contacts.map((contact: any, index: number) => (
                  <Card key={index} className="p-3 flex justify-between items-center">
                    <div>
                      <p className="font-medium">{contact.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {contact.phone} • {contact.role}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeContact(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>📍 Estados Atendidos *</Label>
            <div className="flex flex-wrap gap-2">
              {BRAZILIAN_STATES.map((state) => (
                <Badge
                  key={state}
                  variant={
                    formData.service_states?.includes(state) ? 'default' : 'outline'
                  }
                  className="cursor-pointer"
                  onClick={() => toggleState(state)}
                >
                  {state}
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverage_notes">Observações de Cobertura</Label>
            <Textarea
              id="coverage_notes"
              value={formData.coverage_notes || ''}
              onChange={(e) => setFormData({ ...formData, coverage_notes: e.target.value })}
              placeholder="Ex: Não atende áreas rurais em MG"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas Gerais</Label>
            <Textarea
              id="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
