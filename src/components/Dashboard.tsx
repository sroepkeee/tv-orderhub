import { useState } from "react";
import { Search, Calendar, Edit, Copy, Check, X, Paperclip, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type Priority = "high" | "medium" | "low";
type OrderStatus = "Em Andamento" | "Pendente" | "Concluído" | "Cancelado";

interface Order {
  id: string;
  priority: Priority;
  orderNumber: string;
  item: string;
  description: string;
  quantity: number;
  creationDate: string;
  status: OrderStatus;
  client: string;
  deliveryDeadline: string;
  remainingDays: number;
}

const mockOrders: Order[] = [
  {
    id: "1",
    priority: "high",
    orderNumber: "PO-2024-001",
    item: "Motor Elétrico 220V",
    description: "Motor trifásico alta eficiência",
    quantity: 5,
    creationDate: "15/09/2024",
    status: "Em Andamento",
    client: "Empresa ABC Ltda",
    deliveryDeadline: "30/09/2024",
    remainingDays: 1
  },
  {
    id: "2",
    priority: "high",
    orderNumber: "PO-2024-002",
    item: "Bomba Centrífuga",
    description: "Bomba para sistema de refrigeração",
    quantity: 2,
    creationDate: "20/09/2024",
    status: "Pendente",
    client: "Indústria XYZ",
    deliveryDeadline: "05/10/2024",
    remainingDays: 6
  },
  {
    id: "3",
    priority: "medium",
    orderNumber: "PO-2024-003",
    item: "Válvula de Controle",
    description: "Válvula pneumática DN50",
    quantity: 10,
    creationDate: "18/09/2024",
    status: "Em Andamento",
    client: "Petroquímica Sul",
    deliveryDeadline: "15/10/2024",
    remainingDays: 16
  },
  {
    id: "4",
    priority: "low",
    orderNumber: "PO-2024-004",
    item: "Sensor de Pressão",
    description: "Sensor analógico 4-20mA",
    quantity: 20,
    creationDate: "22/09/2024",
    status: "Concluído",
    client: "Automação Norte",
    deliveryDeadline: "20/10/2024",
    remainingDays: 21
  }
];

const tabs = [
  { id: "production", label: "Pedidos de Produção" },
  { id: "sales", label: "Pedidos de Venda" },
  { id: "materials", label: "Remessa de Materiais" }
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("production");
  const [searchQuery, setSearchQuery] = useState("");

  const getPriorityClass = (priority: Priority) => {
    switch (priority) {
      case "high":
        return "priority-high-row";
      case "medium":
        return "priority-medium-row";
      case "low":
        return "priority-low-row";
      default:
        return "";
    }
  };

  const getPriorityLabel = (priority: Priority) => {
    switch (priority) {
      case "high":
        return "Alta";
      case "medium":
        return "Média";
      case "low":
        return "Baixa";
      default:
        return priority;
    }
  };

  const getProgressBarColor = (days: number) => {
    if (days > 10) return "bg-progress-good";
    if (days > 5) return "bg-progress-warning";
    return "bg-progress-critical";
  };

  const getProgressWidth = (days: number, totalDays = 30) => {
    return Math.max(0, Math.min(100, (days / totalDays) * 100));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="dashboard-header p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-bold text-primary-foreground">
            Customer Service - SSM
          </h1>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 bg-muted p-2 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 rounded-md text-lg font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? "bg-tab-active text-primary-foreground shadow-md"
                    : "bg-transparent text-tab-inactive hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8 flex gap-4 items-center">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              placeholder="Buscar pedidos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 py-3 text-lg"
            />
          </div>
          <Button variant="outline" size="lg" className="gap-2">
            <Calendar className="h-5 w-5" />
            Filtrar por Data
          </Button>
        </div>

        {/* Orders Table */}
        <div className="bg-card rounded-lg shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full dashboard-table">
              <thead>
                <tr className="bg-dashboard-nav text-primary-foreground">
                  <th className="px-6 py-4 text-left font-semibold">Prioridade</th>
                  <th className="px-6 py-4 text-left font-semibold">Número do Pedido</th>
                  <th className="px-6 py-4 text-left font-semibold">Item</th>
                  <th className="px-6 py-4 text-left font-semibold">Descrição</th>
                  <th className="px-6 py-4 text-left font-semibold">Quantidade</th>
                  <th className="px-6 py-4 text-left font-semibold">Data de Criação</th>
                  <th className="px-6 py-4 text-left font-semibold">Status</th>
                  <th className="px-6 py-4 text-left font-semibold">Cliente</th>
                  <th className="px-6 py-4 text-left font-semibold">Prazo de Entrega</th>
                  <th className="px-6 py-4 text-left font-semibold">Dias Restantes</th>
                  <th className="px-6 py-4 text-left font-semibold">Ações</th>
                </tr>
              </thead>
              <tbody>
                {mockOrders.map((order) => (
                  <tr
                    key={order.id}
                    className={`${getPriorityClass(order.priority)} hover:opacity-80 transition-opacity`}
                  >
                    <td className="px-6 py-4">
                      <Badge
                        variant="outline"
                        className={`font-semibold ${
                          order.priority === "high" ? "priority-blink" : ""
                        }`}
                      >
                        {getPriorityLabel(order.priority)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 font-mono font-semibold">
                      {order.orderNumber}
                    </td>
                    <td className="px-6 py-4 font-medium">{order.item}</td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {order.description}
                    </td>
                    <td className="px-6 py-4 font-semibold">{order.quantity}</td>
                    <td className="px-6 py-4">{order.creationDate}</td>
                    <td className="px-6 py-4">
                      <Badge
                        variant={
                          order.status === "Concluído"
                            ? "default"
                            : order.status === "Em Andamento"
                            ? "secondary"
                            : order.status === "Cancelado"
                            ? "destructive"
                            : "outline"
                        }
                      >
                        {order.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4">{order.client}</td>
                    <td className="px-6 py-4">{order.deliveryDeadline}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-3 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full progress-bar ${getProgressBarColor(
                              order.remainingDays
                            )}`}
                            style={{
                              width: `${getProgressWidth(order.remainingDays)}%`,
                            }}
                          />
                        </div>
                        <span className="font-semibold text-sm">
                          {order.remainingDays}d
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                          <X className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                          <Paperclip className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0">
                          <History className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}