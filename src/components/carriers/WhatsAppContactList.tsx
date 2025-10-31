import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Phone, Trash2 } from 'lucide-react';
import { CarrierConversation } from '@/types/carriers';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCarrierMessage } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface WhatsAppContact {
  whatsapp: string;
  carrierName: string;
  carrierId: string;
  orderCount: number;
  unreadCount: number;
  lastMessage: CarrierConversation;
  conversations: CarrierConversation[];
}

interface WhatsAppContactListProps {
  conversations: CarrierConversation[];
  selectedWhatsApp?: string;
  onSelectContact: (contact: WhatsAppContact) => void;
  onConversationsUpdate?: () => void;
}

export function WhatsAppContactList({ 
  conversations, 
  selectedWhatsApp, 
  onSelectContact,
  onConversationsUpdate
}: WhatsAppContactListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<WhatsAppContact | null>(null);
  const [deleteQuotesAndClearOrders, setDeleteQuotesAndClearOrders] = useState(false);
  const { toast } = useToast();

  // Agrupar por chave única (WhatsApp ou carrier_id para casos sem WhatsApp)
  const groupedByWhatsApp = conversations.reduce((acc, conv) => {
    const key = conv.carrier?.whatsapp || `sem-whatsapp:${conv.carrier_id}`;
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(conv);
    return acc;
  }, {} as Record<string, CarrierConversation[]>);

  // Criar lista de contatos
  const contacts: WhatsAppContact[] = Object.entries(groupedByWhatsApp).map(([key, convs]) => {
    const sortedConvs = convs.sort((a, b) => 
      new Date(b.sent_at).getTime() - new Date(a.sent_at).getTime()
    );
    
    const lastMessage = sortedConvs[0];
    const unreadCount = sortedConvs.filter(c => 
      c.message_direction === 'inbound' && !c.read_at
    ).length;

    // Contar pedidos únicos
    const uniqueOrders = new Set(convs.map(c => c.order_id));

    return {
      whatsapp: key,
      carrierName: lastMessage.carrier?.name || 'Transportadora',
      carrierId: lastMessage.carrier_id,
      orderCount: uniqueOrders.size,
      unreadCount,
      lastMessage,
      conversations: sortedConvs
    };
  }).sort((a, b) => 
    new Date(b.lastMessage.sent_at).getTime() - new Date(a.lastMessage.sent_at).getTime()
  );

  const filteredContacts = contacts.filter(contact => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      contact.carrierName.toLowerCase().includes(search) ||
      contact.whatsapp.includes(search) ||
      contact.lastMessage.message_content.toLowerCase().includes(search)
    );
  });

  const formatWhatsApp = (whatsapp: string) => {
    if (!whatsapp || whatsapp.startsWith('sem-whatsapp')) return 'Sem WhatsApp';
    
    const cleaned = whatsapp.replace(/\D/g, '');
    
    if (cleaned.length === 11) {
      // Celular: (XX) XXXXX-XXXX
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
    } else if (cleaned.length === 10) {
      // Fixo: (XX) XXXX-XXXX
      return `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 6)}-${cleaned.slice(6)}`;
    }
    
    return whatsapp;
  };

  const handleDeleteClick = (e: React.MouseEvent, contact: WhatsAppContact) => {
    e.stopPropagation();
    setContactToDelete(contact);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!contactToDelete) return;

    try {
      const conversationIds = contactToDelete.conversations.map(c => c.id);
      const orderIds = [...new Set(contactToDelete.conversations.map(c => c.order_id))];

      // Helper para processar em chunks
      const chunkArray = <T,>(arr: T[], size: number): T[][] => {
        const chunks: T[][] = [];
        for (let i = 0; i < arr.length; i += size) {
          chunks.push(arr.slice(i, i + size));
        }
        return chunks;
      };

      // Se opção marcada, excluir cotações e limpar dados dos pedidos
      if (deleteQuotesAndClearOrders) {
        // 1. Buscar IDs das cotações deste carrier para estes pedidos (em chunks se muitos pedidos)
        const orderChunks = chunkArray(orderIds, 100);
        let allQuoteIds: string[] = [];

        for (const chunk of orderChunks) {
          const { data: quotes } = await supabase
            .from('freight_quotes')
            .select('id')
            .eq('carrier_id', contactToDelete.carrierId)
            .in('order_id', chunk);

          if (quotes && quotes.length > 0) {
            allQuoteIds = [...allQuoteIds, ...quotes.map(q => q.id)];
          }
        }

        if (allQuoteIds.length > 0) {
          const quoteChunks = chunkArray(allQuoteIds, 100);

          // 2. Excluir respostas de cotações em chunks
          for (const chunk of quoteChunks) {
            await supabase
              .from('freight_quote_responses')
              .delete()
              .in('quote_id', chunk);
          }

          // 3. Excluir cotações em chunks
          for (const chunk of quoteChunks) {
            await supabase
              .from('freight_quotes')
              .delete()
              .in('id', chunk);
          }
        }

        // 4. Limpar campos de frete dos pedidos em chunks
        for (const chunk of orderChunks) {
          await supabase
            .from('orders')
            .update({
              freight_type: null,
              freight_value: null,
              freight_modality: null,
              carrier_name: null,
              tracking_code: null
            })
            .in('id', chunk);
        }

        toast({
          title: '🔄 Processando exclusão...',
          description: `Removendo ${allQuoteIds.length} cotações e atualizando ${orderIds.length} pedidos...`,
        });
      }

      // 5. Excluir conversas em chunks
      const conversationChunks = chunkArray(conversationIds, 100);
      for (const chunk of conversationChunks) {
        await supabase
          .from('carrier_conversations')
          .delete()
          .in('id', chunk);
      }

      toast({
        title: '✅ Conversas excluídas',
        description: deleteQuotesAndClearOrders 
          ? `Conversas, cotações e dados de frete dos pedidos foram removidos.`
          : `Todas as mensagens com ${contactToDelete.carrierName} foram removidas.`,
      });

      onConversationsUpdate?.();
    } catch (error) {
      console.error('Erro ao excluir conversas:', error);
      toast({
        title: 'Erro ao excluir',
        description: 'Não foi possível excluir as conversas.',
        variant: 'destructive',
      });
    } finally {
      setDeleteDialogOpen(false);
      setContactToDelete(null);
      setDeleteQuotesAndClearOrders(false);
    }
  };

  return (
    <div className="w-80 border-r bg-background flex flex-col h-full">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
          <Phone className="h-5 w-5" />
          Contatos WhatsApp
        </h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Pesquisar contato..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        {filteredContacts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <p className="text-sm">Nenhum contato encontrado</p>
          </div>
        ) : (
          filteredContacts.map((contact) => (
            <button
              key={contact.whatsapp}
              onClick={() => onSelectContact(contact)}
              className={`w-full p-4 border-b text-left hover:bg-accent transition-colors relative group ${
                selectedWhatsApp === contact.whatsapp ? 'bg-accent border-l-4 border-l-primary' : ''
              }`}
            >
              {/* Botão de exclusão (aparece no hover) */}
              <button
                onClick={(e) => handleDeleteClick(e, contact)}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-background/80 hover:bg-destructive hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity z-10"
                title="Excluir todas as conversas"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>

              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <span className="font-semibold text-sm block mb-1">
                    {contact.carrierName}
                  </span>
               <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {formatWhatsApp(contact.whatsapp)}
                {contact.whatsapp.startsWith('sem-whatsapp') && (
                  <Badge variant="outline" className="text-xs ml-1">⚠️ Sem contato</Badge>
                )}
              </span>
                </div>
                <span className="text-xs text-muted-foreground ml-2 whitespace-nowrap">
                  {formatDistanceToNow(new Date(contact.lastMessage.sent_at), {
                    addSuffix: true,
                    locale: ptBR
                  })}
                </span>
              </div>
              
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-xs">
                  {contact.orderCount} {contact.orderCount === 1 ? 'pedido' : 'pedidos'}
                </Badge>
                {contact.unreadCount > 0 && (
                  <Badge variant="destructive" className="text-xs animate-pulse">
                    {contact.unreadCount} não lida{contact.unreadCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </div>

              <p className="text-sm text-muted-foreground truncate">
                {contact.lastMessage.message_direction === 'outbound' ? '📤 ' : '📥 '}
                {formatCarrierMessage(contact.lastMessage.message_content).formatted.split('\n')[0]}
              </p>
            </button>
          ))
        )}
      </ScrollArea>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir todas as conversas?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as mensagens com <strong>{contactToDelete?.carrierName}</strong> ({contactToDelete?.orderCount} {contactToDelete?.orderCount === 1 ? 'pedido' : 'pedidos'}) serão permanentemente excluídas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          <div className="flex items-start space-x-2 py-4">
            <Checkbox 
              id="delete-quotes" 
              checked={deleteQuotesAndClearOrders}
              onCheckedChange={(checked) => setDeleteQuotesAndClearOrders(checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label 
                htmlFor="delete-quotes" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Excluir também cotações e limpar campos dos pedidos
              </Label>
              <p className="text-xs text-muted-foreground">
                Remove cotações de frete e limpa os campos freight_type, freight_value, freight_modality, carrier_name e tracking_code dos pedidos relacionados.
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
