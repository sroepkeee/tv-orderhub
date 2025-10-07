import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Order } from "@/components/Dashboard";

interface SendToLabResult {
  labTicketId: string;
}

export const useSendToLab = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendToLab = async (order: Order): Promise<SendToLabResult> => {
    setLoading(true);
    setError(null);

    try {
      // Validate order has items
      if (!order.items || order.items.length === 0) {
        throw new Error("O pedido deve ter pelo menos um item para ser enviado ao laboratório.");
      }

      // Validate order status
      if (order.status !== "awaiting_lab") {
        throw new Error("Apenas pedidos com status 'Aguardando Laboratório' podem ser enviados.");
      }

      // Prepare payload
      const payload = {
        orderId: order.id,
        orderNumber: order.orderNumber,
        items: order.items.map(item => ({
          code: item.itemCode,
          description: item.itemDescription,
          quantity: item.requestedQuantity,
          unit: item.unit
        })),
        deliveryDate: order.deliveryDeadline,
        priority: order.priority
      };

      // Call edge function
      const { data, error: functionError } = await supabase.functions.invoke('notify-lab', {
        body: payload
      });

      if (functionError) {
        throw new Error(functionError.message || "Erro ao enviar pedido ao laboratório.");
      }

      if (!data?.success) {
        throw new Error(data?.error || "Falha ao processar o pedido no laboratório.");
      }

      return {
        labTicketId: data.labTicketId
      };
    } catch (err: any) {
      const errorMessage = err.message || "Erro desconhecido ao enviar ao laboratório.";
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    sendToLab,
    loading,
    error
  };
};
