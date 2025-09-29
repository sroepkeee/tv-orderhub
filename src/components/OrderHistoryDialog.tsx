import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, User, FileText, CheckCircle, XCircle, Clock, History } from "lucide-react";
import { Order } from "./Dashboard";

interface OrderHistoryDialogProps {
  order: Order;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HistoryEvent {
  id: string;
  date: string;
  time: string;
  action: string;
  description: string;
  user: string;
  type: "created" | "updated" | "approved" | "cancelled" | "completed" | "attachment";
}

export const OrderHistoryDialog = ({ order, open, onOpenChange }: OrderHistoryDialogProps) => {
  // Load history from localStorage
  const getOrderHistory = (): HistoryEvent[] => {
    if (!order) return [];
    
    const historyKey = `orderHistory_${order.id}`;
    const savedHistory = localStorage.getItem(historyKey);
    
    if (savedHistory) {
      const history = JSON.parse(savedHistory);
      return history.events.map((event: any) => ({
        id: event.id,
        date: event.date,
        time: event.time,
        action: event.action,
        description: event.description,
        user: event.userName || "Sistema",
        type: event.type === "status_change" ? "updated" : event.type,
      }));
    }
    
    // Default initial event if no history exists
    return [
      {
        id: "1",
        date: order.createdDate,
        time: "00:00",
        action: "Pedido Criado",
        description: `Pedido ${order.orderNumber} criado com prioridade ${order.priority}`,
        user: "Sistema",
        type: "created" as const
      },
    ];
  };

  const historyEvents = getOrderHistory();

  const getEventIcon = (type: HistoryEvent["type"]) => {
    switch (type) {
      case "created":
        return <FileText className="h-4 w-4 text-blue-500" />;
      case "updated":
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case "approved":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "cancelled":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "attachment":
        return <FileText className="h-4 w-4 text-purple-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getEventBadgeVariant = (type: HistoryEvent["type"]) => {
    switch (type) {
      case "approved":
      case "completed":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return "secondary";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl h-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Histórico do Pedido #{order?.orderNumber}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">Cliente</p>
              <p className="text-sm text-muted-foreground">{order?.client}</p>
            </div>
            <div>
              <p className="text-sm font-medium">Chamado Desk</p>
              <p className="text-sm text-muted-foreground">{order?.deskTicket}</p>
            </div>
          </div>

          <ScrollArea className="h-[400px]">
            <div className="space-y-4">
              {historyEvents.map((event, index) => (
                <div key={event.id} className="flex gap-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    {getEventIcon(event.type)}
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">{event.action}</h4>
                      <Badge variant={getEventBadgeVariant(event.type)} className="text-xs">
                        {event.type}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{event.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(event.date).toLocaleDateString('pt-BR')} às {event.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {event.user}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
};