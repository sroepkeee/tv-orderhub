import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  useProductivityOrders,
  type ProductivityOrdersFilters,
} from "@/hooks/useProductivityOrders";
import { Cpu, Image as ImageIcon, Inbox } from "lucide-react";

interface Props extends ProductivityOrdersFilters {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  subtitle?: string;
}

const statusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
  if (status === "delivered" || status === "completed") return "default";
  if (status === "cancelled" || status === "delayed") return "destructive";
  return "secondary";
};

const priorityVariant = (priority: string | null): "default" | "secondary" | "destructive" | "outline" => {
  if (!priority) return "outline";
  const p = priority.toLowerCase();
  if (p.includes("urgent") || p === "alta" || p === "high") return "destructive";
  if (p === "media" || p === "medium") return "default";
  return "secondary";
};

export function ProductivityOrdersSheet({
  open,
  onOpenChange,
  title = "Pedidos do recorte selecionado",
  subtitle,
  ...filters
}: Props) {
  const { data: orders, isLoading } = useProductivityOrders({ ...filters, enabled: open });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {subtitle && <SheetDescription>{subtitle}</SheetDescription>}
        </SheetHeader>

        <div className="mt-4 text-sm text-muted-foreground">
          {isLoading ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <span>{orders?.length ?? 0} pedido(s) encontrados (limite 500)</span>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-180px)] mt-3 pr-3">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !orders || orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 text-muted-foreground">
              <Inbox className="h-12 w-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhum pedido encontrado para este recorte.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Prior.</TableHead>
                  <TableHead>Resp.</TableHead>
                  <TableHead>Criado</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Compl.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-xs">
                      {o.order_number || o.id.slice(0, 8)}
                    </TableCell>
                    <TableCell className="max-w-[140px] truncate" title={o.customer_name || ""}>
                      {o.customer_name || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {o.order_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant(o.priority)} className="text-[10px]">
                        {o.priority || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{o.user_name || "—"}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">
                      {o.created_at ? format(new Date(o.created_at), "dd/MM", { locale: ptBR }) : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(o.status)} className="text-[10px]">
                        {o.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {o.requires_firmware && (
                          <span title="Firmware">
                            <Cpu className="h-3 w-3 text-primary" />
                          </span>
                        )}
                        {o.requires_image && (
                          <span title="Imagem">
                            <ImageIcon className="h-3 w-3 text-primary" />
                          </span>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
