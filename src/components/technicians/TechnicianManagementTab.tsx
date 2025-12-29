import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Plus, Search, Pencil, Trash2, Phone } from 'lucide-react';
import { useTechnicians } from '@/hooks/useTechnicians';
import type { Technician } from '@/types/technicians';

export function TechnicianManagementTab() {
  const { technicians, loading, createTechnician, updateTechnician, deleteTechnician } = useTechnicians();
  const [searchTerm, setSearchTerm] = useState('');
  const [showDialog, setShowDialog] = useState(false);
  const [editingTechnician, setEditingTechnician] = useState<Technician | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    whatsapp: '',
    city: '',
    state: '',
    address: '',
    zip_code: '',
    specialty: '',
    notes: '',
  });

  const filteredTechnicians = technicians.filter(tech =>
    tech.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tech.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    tech.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openCreateDialog = () => {
    setEditingTechnician(null);
    setFormData({
      name: '',
      email: '',
      phone: '',
      whatsapp: '',
      city: '',
      state: '',
      address: '',
      zip_code: '',
      specialty: '',
      notes: '',
    });
    setShowDialog(true);
  };

  const openEditDialog = (technician: Technician) => {
    setEditingTechnician(technician);
    setFormData({
      name: technician.name || '',
      email: technician.email || '',
      phone: technician.phone || '',
      whatsapp: technician.whatsapp || '',
      city: technician.city || '',
      state: technician.state || '',
      address: technician.address || '',
      zip_code: technician.zip_code || '',
      specialty: technician.specialty || '',
      notes: technician.notes || '',
    });
    setShowDialog(true);
  };

  const handleSubmit = async () => {
    if (editingTechnician) {
      await updateTechnician(editingTechnician.id, formData);
    } else {
      await createTechnician(formData);
    }
    setShowDialog(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('Tem certeza que deseja desativar este técnico?')) {
      await deleteTechnician(id);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Cadastro de Técnicos</CardTitle>
        <Button size="sm" onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Técnico
        </Button>
      </CardHeader>
      <CardContent>
        {/* Busca */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, cidade ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Tabela */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Cidade/UF</TableHead>
                <TableHead>Contato</TableHead>
                <TableHead>Especialidade</TableHead>
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
              ) : filteredTechnicians.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum técnico cadastrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredTechnicians.map((tech) => (
                  <TableRow key={tech.id}>
                    <TableCell className="font-medium">{tech.name}</TableCell>
                    <TableCell>
                      {tech.city && tech.state ? `${tech.city}/${tech.state}` : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {tech.whatsapp && (
                          <a
                            href={`https://wa.me/${tech.whatsapp.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-500 hover:text-emerald-600"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        )}
                        <span className="text-sm text-muted-foreground">
                          {tech.email || tech.phone || '-'}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{tech.specialty || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={tech.is_active ? 'default' : 'secondary'}>
                        {tech.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(tech)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(tech.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Dialog de Criação/Edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTechnician ? 'Editar Técnico' : 'Novo Técnico'}
            </DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Nome completo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="(00) 0000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  value={formData.whatsapp}
                  onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Cidade"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">UF</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  placeholder="UF"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2 col-span-2">
                <Label htmlFor="address">Endereço</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rua, número, bairro"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip_code">CEP</Label>
                <Input
                  id="zip_code"
                  value={formData.zip_code}
                  onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  placeholder="00000-000"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidade</Label>
              <Input
                id="specialty"
                value={formData.specialty}
                onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                placeholder="Ex: Manutenção de Catracas, Instalação..."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Notas adicionais..."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={!formData.name}>
              {editingTechnician ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
