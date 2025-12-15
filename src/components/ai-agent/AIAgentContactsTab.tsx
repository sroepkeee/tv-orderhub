import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Users, Search, MessageSquare, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

interface CustomerContact {
  id: string;
  customer_name: string;
  customer_document: string | null;
  email: string | null;
  whatsapp: string | null;
  preferred_channel: string;
  opt_in_whatsapp: boolean;
  opt_in_email: boolean;
  notes: string | null;
}

interface Props {
  contacts: CustomerContact[];
  onAdd: (contact: Omit<CustomerContact, 'id'>) => Promise<{ data: any; error: any }>;
  onUpdate: (id: string, updates: Partial<CustomerContact>) => Promise<{ error: any }>;
  onDelete: (id: string) => Promise<{ error: any }>;
}

export function AIAgentContactsTab({ contacts, onAdd, onUpdate, onDelete }: Props) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_document: '',
    email: '',
    whatsapp: '',
    preferred_channel: 'whatsapp',
    opt_in_whatsapp: true,
    opt_in_email: true,
    notes: '',
  });

  const filteredContacts = contacts.filter(contact =>
    contact.customer_name.toLowerCase().includes(search.toLowerCase()) ||
    contact.customer_document?.includes(search) ||
    contact.email?.toLowerCase().includes(search.toLowerCase()) ||
    contact.whatsapp?.includes(search)
  );

  const handleOpenDialog = (contact?: CustomerContact) => {
    if (contact) {
      setEditingContact(contact);
      setFormData({
        customer_name: contact.customer_name,
        customer_document: contact.customer_document || '',
        email: contact.email || '',
        whatsapp: contact.whatsapp || '',
        preferred_channel: contact.preferred_channel,
        opt_in_whatsapp: contact.opt_in_whatsapp,
        opt_in_email: contact.opt_in_email,
        notes: contact.notes || '',
      });
    } else {
      setEditingContact(null);
      setFormData({
        customer_name: '',
        customer_document: '',
        email: '',
        whatsapp: '',
        preferred_channel: 'whatsapp',
        opt_in_whatsapp: true,
        opt_in_email: true,
        notes: '',
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const data = {
      customer_name: formData.customer_name,
      customer_document: formData.customer_document || null,
      email: formData.email || null,
      whatsapp: formData.whatsapp || null,
      preferred_channel: formData.preferred_channel,
      opt_in_whatsapp: formData.opt_in_whatsapp,
      opt_in_email: formData.opt_in_email,
      notes: formData.notes || null,
    };

    if (editingContact) {
      const { error } = await onUpdate(editingContact.id, data);
      if (error) {
        toast.error("Erro ao atualizar contato");
      } else {
        toast.success("Contato atualizado");
        setDialogOpen(false);
      }
    } else {
      const { error } = await onAdd(data);
      if (error) {
        toast.error("Erro ao adicionar contato");
      } else {
        toast.success("Contato adicionado");
        setDialogOpen(false);
      }
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este contato?")) return;
    
    const { error } = await onDelete(id);
    if (error) {
      toast.error("Erro ao excluir");
    } else {
      toast.success("Contato excluído");
    }
  };

  const formatPhone = (phone: string | null) => {
    if (!phone) return '-';
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Contato
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {editingContact ? 'Editar Contato' : 'Novo Contato de Cliente'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Nome do Cliente *</Label>
                <Input
                  value={formData.customer_name}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Nome completo ou razão social"
                />
              </div>

              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <Input
                  value={formData.customer_document}
                  onChange={(e) => setFormData({ ...formData, customer_document: e.target.value })}
                  placeholder="00.000.000/0000-00"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>WhatsApp</Label>
                  <Input
                    value={formData.whatsapp}
                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Canal Preferido</Label>
                <Select
                  value={formData.preferred_channel}
                  onValueChange={(value) => setFormData({ ...formData, preferred_channel: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="whatsapp">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-green-600" />
                        WhatsApp
                      </div>
                    </SelectItem>
                    <SelectItem value="email">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-blue-600" />
                        E-mail
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label>Opt-in (Consentimento)</Label>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-green-600" />
                    <span className="text-sm">Aceita receber WhatsApp</span>
                  </div>
                  <Switch
                    checked={formData.opt_in_whatsapp}
                    onCheckedChange={(checked) => setFormData({ ...formData, opt_in_whatsapp: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-blue-600" />
                    <span className="text-sm">Aceita receber E-mail</span>
                  </div>
                  <Switch
                    checked={formData.opt_in_email}
                    onCheckedChange={(checked) => setFormData({ ...formData, opt_in_email: checked })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Anotações sobre o contato..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleSave}>
                  {editingContact ? 'Salvar Alterações' : 'Adicionar Contato'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Contacts Table */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>E-mail</TableHead>
              <TableHead>Preferência</TableHead>
              <TableHead>Opt-in</TableHead>
              <TableHead className="w-[100px]">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredContacts.map(contact => (
              <TableRow key={contact.id}>
                <TableCell>
                  <div>
                    <div className="font-medium">{contact.customer_name}</div>
                    {contact.customer_document && (
                      <div className="text-xs text-muted-foreground">{contact.customer_document}</div>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  {contact.whatsapp ? (
                    <div className="flex items-center gap-1">
                      <Phone className="h-3 w-3 text-green-600" />
                      {formatPhone(contact.whatsapp)}
                    </div>
                  ) : '-'}
                </TableCell>
                <TableCell>{contact.email || '-'}</TableCell>
                <TableCell>
                  <Badge className={contact.preferred_channel === 'whatsapp' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}>
                    {contact.preferred_channel === 'whatsapp' ? <MessageSquare className="h-3 w-3 mr-1" /> : <Mail className="h-3 w-3 mr-1" />}
                    {contact.preferred_channel}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {contact.opt_in_whatsapp && (
                      <Badge variant="outline" className="text-xs bg-green-50 border-green-200">
                        <MessageSquare className="h-3 w-3" />
                      </Badge>
                    )}
                    {contact.opt_in_email && (
                      <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200">
                        <Mail className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => handleOpenDialog(contact)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleDelete(contact.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {filteredContacts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Nenhum contato encontrado</p>
        </div>
      )}
    </div>
  );
}
