import { useState } from "react";
import { PurchaseRequest } from "@/types/purchases";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Eye, Edit, Trash2, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PurchaseRequestsTableProps {
  requests: PurchaseRequest[];
  onView: (request: PurchaseRequest) => void;
  onEdit: (request: PurchaseRequest) => void;
  onDelete: (requestId: string) => void;
  onApprove: (request: PurchaseRequest) => void;
  canApprove: boolean;
}

export const PurchaseRequestsTable = ({
  requests,
  onView,
  onEdit,
  onDelete,
  onApprove,
  canApprove,
}: PurchaseRequestsTableProps) => {
  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      draft: { label: '🟡 Rascunho', className: 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20' },
      pending: { label: '🟠 Pendente', className: 'bg-orange-500/10 text-orange-500 hover:bg-orange-500/20' },
      approved: { label: '🟢 Aprovado', className: 'bg-green-500/10 text-green-500 hover:bg-green-500/20' },
      rejected: { label: '🔴 Rejeitado', className: 'bg-red-500/10 text-red-500 hover:bg-red-500/20' },
    };
    const config = variants[status] || variants.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Número OC</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Solicitante</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Valor Estimado</TableHead>
            <TableHead>Data Criação</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                Nenhuma solicitação encontrada
              </TableCell>
            </TableRow>
          ) : (
            requests.map((request) => (
              <TableRow key={request.id}>
                <TableCell className="font-medium">
                  {request.purchase_order_number}
                </TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell>
                  {(request as any).profiles?.full_name || 'N/A'}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">
                    {request.request_type === 'auto_generated' ? '🤖 Automática' : '✏️ Manual'}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Intl.NumberFormat('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                  }).format(request.total_estimated_value || 0)}
                </TableCell>
                <TableCell>
                  {format(new Date(request.created_at), 'dd/MM/yyyy HH:mm', {
                    locale: ptBR,
                  })}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onView(request)}
                      title="Visualizar"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {request.status === 'draft' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEdit(request)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    {canApprove && request.status === 'pending' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onApprove(request)}
                        title="Aprovar/Rejeitar"
                      >
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      </Button>
                    )}
                    {(request.status === 'draft' || request.status === 'rejected') && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDelete(request.id)}
                        title="Excluir"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
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
  );
};
