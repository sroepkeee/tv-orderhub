import React from "react";
import { Settings, Eye, EyeOff } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuCheckboxItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
export interface ColumnVisibility {
  priority: boolean;
  orderNumber: boolean;
  item: boolean;
  description: boolean;
  quantity: boolean;
  createdDate: boolean;
  status: boolean;
  client: boolean;
  deskTicket: boolean;
  deliveryDeadline: boolean;
  daysRemaining: boolean;
  labStatus: boolean;
  phaseManagement: boolean;
  actions: boolean;
}
interface ColumnSettingsProps {
  visibility: ColumnVisibility;
  onVisibilityChange: (visibility: ColumnVisibility) => void;
}
export const ColumnSettings = ({
  visibility,
  onVisibilityChange
}: ColumnSettingsProps) => {
  const columns = [{
    key: "priority",
    label: "Prioridade"
  }, {
    key: "orderNumber",
    label: "Número do Pedido"
  }, {
    key: "item",
    label: "Item"
  }, {
    key: "description",
    label: "Descrição"
  }, {
    key: "quantity",
    label: "Quantidade"
  }, {
    key: "createdDate",
    label: "Data de Criação"
  }, {
    key: "status",
    label: "Status"
  }, {
    key: "client",
    label: "Cliente"
  }, {
    key: "deskTicket",
    label: "Chamado Desk"
  }, {
    key: "deliveryDeadline",
    label: "Prazo de Entrega"
  }, {
    key: "daysRemaining",
    label: "Dias Restantes"
  }, {
    key: "labStatus",
    label: "Status Laboratório"
  }, {
    key: "phaseManagement",
    label: "Gestão de Fase"
  }, {
    key: "actions",
    label: "Ações"
  }];
  const handleToggle = (key: keyof ColumnVisibility) => {
    onVisibilityChange({
      ...visibility,
      [key]: !visibility[key]
    });
  };
  const visibleCount = Object.values(visibility).filter(Boolean).length;
  return <DropdownMenu>
      <DropdownMenuTrigger asChild>
        
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Configurar Colunas</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map(column => <DropdownMenuCheckboxItem key={column.key} checked={visibility[column.key as keyof ColumnVisibility]} onCheckedChange={() => handleToggle(column.key as keyof ColumnVisibility)}>
            <div className="flex items-center gap-2">
              {visibility[column.key as keyof ColumnVisibility] ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              {column.label}
            </div>
          </DropdownMenuCheckboxItem>)}
      </DropdownMenuContent>
    </DropdownMenu>;
};