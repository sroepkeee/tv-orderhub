import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Order } from "@/components/Dashboard";
import { FileText, CheckCircle, XCircle } from "lucide-react";
interface OrderTotvsMetricsProps {
  orders: Order[];
}
export const OrderTotvsMetrics = ({
  orders
}: OrderTotvsMetricsProps) => {
  const ordersWithTotvs = orders.filter(o => o.totvsOrderNumber);
  const ordersWithoutTotvs = orders.filter(o => !o.totvsOrderNumber);
  const percentageWithTotvs = orders.length > 0 ? Math.round(ordersWithTotvs.length / orders.length * 100) : 0;
  return <Card>
      
      
    </Card>;
};