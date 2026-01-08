import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, Search, ArrowLeft, Phone, Mail, MapPin, Building, FileText, 
  Pencil, MessageSquare, Package, Download, Upload, Plus, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useOrganizationId } from "@/hooks/useOrganizationId";

interface Customer {
  id: string;
  customer_name: string;
  customer_document: string | null;
  email: string | null;
  whatsapp: string | null;
  phone: string | null;
  contact_person: string | null;
  address: string | null;
  neighborhood: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  preferred_channel: string | null;
  opt_in_whatsapp: boolean | null;
  opt_in_email: boolean | null;
  notes: string | null;
  source: string | null;
  orders_count: number | null;
  last_order_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export default function Customers() {
  const navigate = useNavigate();
  const { organizationId } = useOrganizationId();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSource, setFilterSource] = useState("all");
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState<Partial<Customer>>({});

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('customer_contacts')
        .select('*')
        .order('customer_name');
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Erro ao carregar clientes:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  // Métricas calculadas
  const metrics = {
    total: customers.length,
    withWhatsApp: customers.filter(c => c.whatsapp).length,
    withEmail: customers.filter(c => c.email).length,
    optInWhatsApp: customers.filter(c => c.opt_in_whatsapp).length,
    optInEmail: customers.filter(c => c.opt_in_email).length,
  };

  const handleNewCustomer = () => {
    setFormData({
      customer_name: '',
      opt_in_whatsapp: true,
      opt_in_email: true,
      preferred_channel: 'whatsapp'
    });
    setNewDialogOpen(true);
  };

  const handleSaveNew = async () => {
    if (!formData.customer_name) {
      toast.error('Nome do cliente é obrigatório');
      return;
    }

    if (!organizationId) {
      toast.error('Organização não identificada');
      return;
    }

    try {
      const { error } = await supabase
        .from('customer_contacts')
        .insert({
          organization_id: organizationId,
          customer_name: formData.customer_name,
          customer_document: formData.customer_document,
          email: formData.email,
          whatsapp: formData.whatsapp,
          phone: formData.phone,
          contact_person: formData.contact_person,
          address: formData.address,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          preferred_channel: formData.preferred_channel || 'whatsapp',
          opt_in_whatsapp: formData.opt_in_whatsapp ?? true,
          opt_in_email: formData.opt_in_email ?? true,
          notes: formData.notes,
          source: 'manual'
        });

      if (error) throw error;

      toast.success('Cliente criado com sucesso');
      setNewDialogOpen(false);
      setFormData({});
      loadCustomers();
    } catch (error) {
      console.error('Erro ao criar cliente:', error);
      toast.error('Erro ao criar cliente');
    }
  };

  const filteredCustomers = customers.filter(customer => {
    const matchesSearch = 
      customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.customer_document?.includes(searchTerm) ||
      customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      customer.whatsapp?.includes(searchTerm) ||
      customer.city?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSource = filterSource === 'all' || customer.source === filterSource;
    
    return matchesSearch && matchesSource;
  });

  const handleEdit = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormData({ ...customer });
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedCustomer) return;

    try {
      const { error } = await supabase
        .from('customer_contacts')
        .update({
          customer_name: formData.customer_name,
          customer_document: formData.customer_document,
          email: formData.email,
          whatsapp: formData.whatsapp,
          phone: formData.phone,
          contact_person: formData.contact_person,
          address: formData.address,
          neighborhood: formData.neighborhood,
          city: formData.city,
          state: formData.state,
          zip_code: formData.zip_code,
          preferred_channel: formData.preferred_channel,
          opt_in_whatsapp: formData.opt_in_whatsapp,
          opt_in_email: formData.opt_in_email,
          notes: formData.notes
        })
        .eq('id', selectedCustomer.id);

      if (error) throw error;

      toast.success('Cliente atualizado com sucesso');
      setEditDialogOpen(false);
      loadCustomers();
    } catch (error) {
      console.error('Erro ao salvar:', error);
      toast.error('Erro ao salvar cliente');
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

  const handleExportCSV = () => {
    const headers = ['Nome,Documento,WhatsApp,Email,Cidade,Estado,Origem,Pedidos'];
    const rows = filteredCustomers.map(c => 
      `"${c.customer_name}","${c.customer_document || ''}","${c.whatsapp || ''}","${c.email || ''}","${c.city || ''}","${c.state || ''}","${c.source || ''}","${c.orders_count || 0}"`
    );
    const csv = [...headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clientes_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Clientes
                </h1>
                <p className="text-sm text-muted-foreground">
                  {customers.length} clientes cadastrados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={handleExportCSV}>
                <Download className="h-4 w-4 mr-2" />
                Exportar
              </Button>
              <Button onClick={handleNewCustomer}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Cliente
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold">{metrics.total}</div>
              <p className="text-xs text-muted-foreground">Total de Clientes</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-green-600">{metrics.withWhatsApp}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Com WhatsApp
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-blue-600">{metrics.withEmail}</div>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" /> Com Email
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-green-500">{metrics.optInWhatsApp}</div>
              <p className="text-xs text-muted-foreground">Opt-in WhatsApp</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-2xl font-bold text-blue-500">{metrics.optInEmail}</div>
              <p className="text-xs text-muted-foreground">Opt-in Email</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, documento, email, cidade..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Tabs value={filterSource} onValueChange={setFilterSource}>
                <TabsList>
                  <TabsTrigger value="all">Todos</TabsTrigger>
                  <TabsTrigger value="import">Importados</TabsTrigger>
                  <TabsTrigger value="manual">Manuais</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Customers Table */}
        <Card>
          <ScrollArea className="h-[calc(100vh-280px)]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Localização</TableHead>
                  <TableHead>Notificações</TableHead>
                  <TableHead>Origem</TableHead>
                  <TableHead>Pedidos</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">
                      Carregando...
                    </TableCell>
                  </TableRow>
                ) : filteredCustomers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhum cliente encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredCustomers.map(customer => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.customer_name}</div>
                          {customer.customer_document && (
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {customer.customer_document}
                            </div>
                          )}
                          {customer.contact_person && (
                            <div className="text-xs text-muted-foreground">
                              Resp: {customer.contact_person}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {customer.whatsapp && (
                            <div className="flex items-center gap-1 text-sm">
                              <Phone className="h-3 w-3 text-green-600" />
                              {formatPhone(customer.whatsapp)}
                            </div>
                          )}
                          {customer.email && (
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {customer.email}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {customer.city || customer.state ? (
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            {[customer.city, customer.state].filter(Boolean).join(' - ')}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {customer.opt_in_whatsapp && (
                            <Badge variant="outline" className="text-xs bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800">
                              <MessageSquare className="h-3 w-3" />
                            </Badge>
                          )}
                          {customer.opt_in_email && (
                            <Badge variant="outline" className="text-xs bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
                              <Mail className="h-3 w-3" />
                            </Badge>
                          )}
                          {!customer.opt_in_whatsapp && !customer.opt_in_email && (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={customer.source === 'import' ? 'secondary' : 'outline'}>
                          {customer.source === 'import' ? '📥 Importado' : '✏️ Manual'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Package className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{customer.orders_count || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(customer)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </Card>
      </main>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome/Razão Social *</Label>
                <Input
                  value={formData.customer_name || ''}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <Input
                  value={formData.customer_document || ''}
                  onChange={(e) => setFormData({ ...formData, customer_document: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsável pelo Contato</Label>
                <Input
                  value={formData.contact_person || ''}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Nome de quem receberá notificações"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone Fixo</Label>
                <Input
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  WhatsApp
                </Label>
                <Input
                  value={formData.whatsapp || ''}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={formData.neighborhood || ''}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input
                  value={formData.state || ''}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  maxLength={2}
                />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={formData.zip_code || ''}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Canal Preferido</Label>
              <Select
                value={formData.preferred_channel || 'whatsapp'}
                onValueChange={(value) => setFormData({ ...formData, preferred_channel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <Label>Consentimento para Notificações</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm">Aceita receber WhatsApp</span>
                <Switch
                  checked={formData.opt_in_whatsapp ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, opt_in_whatsapp: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Aceita receber E-mail</span>
                <Switch
                  checked={formData.opt_in_email ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, opt_in_email: checked })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave}>
              Salvar Alterações
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Customer Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Novo Cliente
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome/Razão Social *</Label>
                <Input
                  value={formData.customer_name || ''}
                  onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                  placeholder="Nome completo ou razão social"
                />
              </div>
              <div className="space-y-2">
                <Label>CPF/CNPJ</Label>
                <Input
                  value={formData.customer_document || ''}
                  onChange={(e) => setFormData({ ...formData, customer_document: e.target.value })}
                  placeholder="Documento"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Responsável pelo Contato</Label>
                <Input
                  value={formData.contact_person || ''}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  placeholder="Nome de quem receberá notificações"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone Fixo</Label>
                <Input
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  WhatsApp
                </Label>
                <Input
                  value={formData.whatsapp || ''}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-blue-600" />
                  E-mail
                </Label>
                <Input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input
                value={formData.address || ''}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="Rua, número, complemento"
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Bairro</Label>
                <Input
                  value={formData.neighborhood || ''}
                  onChange={(e) => setFormData({ ...formData, neighborhood: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Input
                  value={formData.state || ''}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  maxLength={2}
                  placeholder="UF"
                />
              </div>
              <div className="space-y-2">
                <Label>CEP</Label>
                <Input
                  value={formData.zip_code || ''}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Canal Preferido</Label>
              <Select
                value={formData.preferred_channel || 'whatsapp'}
                onValueChange={(value) => setFormData({ ...formData, preferred_channel: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3 pt-2 border-t">
              <Label>Consentimento para Notificações</Label>
              <div className="flex items-center justify-between">
                <span className="text-sm">Aceita receber WhatsApp</span>
                <Switch
                  checked={formData.opt_in_whatsapp ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, opt_in_whatsapp: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Aceita receber E-mail</span>
                <Switch
                  checked={formData.opt_in_email ?? true}
                  onCheckedChange={(checked) => setFormData({ ...formData, opt_in_email: checked })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                placeholder="Notas sobre o cliente..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveNew}>
              <Plus className="h-4 w-4 mr-2" />
              Criar Cliente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}