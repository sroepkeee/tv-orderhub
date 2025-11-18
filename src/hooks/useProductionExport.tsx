import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ProductionItem, ProductionStats } from '@/types/production';
import { toast } from 'sonner';

const getItemStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'pending': 'Pendente',
    'in_stock': 'Disponível em Estoque',
    'awaiting_production': 'Aguardando Produção',
    'purchase_required': 'Solicitar Compra',
    'purchase_requested': 'Solicitado Compra',
    'completed': 'Concluído',
  };
  return labels[status] || status;
};

export const useProductionExport = () => {
  const exportToExcel = (items: ProductionItem[], stats: ProductionStats) => {
    try {
      // Aba 1: Todos os itens
      const itemsData = items.map(item => ({
        'Pedido': item.orderNumber,
        'Cliente': item.customerName || '',
        'Código': item.itemCode,
        'Descrição': item.itemDescription,
        'Unidade': item.unit,
        'Qtd Solicitada': item.requestedQuantity,
        'Qtd Recebida': item.deliveredQuantity,
        'Saldo': item.requestedQuantity - item.deliveredQuantity,
        'Situação': getItemStatusLabel(item.item_status),
        'Data Entrega': format(new Date(item.deliveryDate), 'dd/MM/yyyy'),
        'Armazém': item.warehouse,
        'Tipo de Origem': item.item_source_type || '',
      }));

      const ws1 = XLSX.utils.json_to_sheet(itemsData);

      // Aba 2: Resumo
      const summaryData = [
        { 'Métrica': 'Total de Itens', 'Valor': stats.total },
        { 'Métrica': 'Em Produção', 'Valor': stats.awaiting_production },
        { 'Métrica': 'Pendentes', 'Valor': stats.pending },
        { 'Métrica': 'Para Compra', 'Valor': stats.purchase_required },
        { 'Métrica': 'Concluídos', 'Valor': stats.completed },
        { 'Métrica': 'Em Estoque', 'Valor': stats.in_stock },
        { 'Métrica': 'Itens Críticos (< 3 dias)', 'Valor': stats.critical },
      ];

      const ws2 = XLSX.utils.json_to_sheet(summaryData);

      // Criar workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws1, 'Itens de Produção');
      XLSX.utils.book_append_sheet(wb, ws2, 'Resumo');

      // Salvar arquivo
      const fileName = `Producao_${format(new Date(), 'yyyy-MM-dd_HHmm')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast.success('Excel exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar:', error);
      toast.error('Erro ao exportar para Excel');
    }
  };

  return { exportToExcel };
};
