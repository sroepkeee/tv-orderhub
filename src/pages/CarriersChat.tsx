import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useCarrierConversations } from '@/hooks/useCarrierConversations';

export default function CarriersChat() {
  const navigate = useNavigate();
  const { subscribeToNewMessages } = useCarrierConversations();

  useEffect(() => {
    const unsubscribe = subscribeToNewMessages();
    return unsubscribe;
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b p-4">
        <div className="container mx-auto flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-semibold">Conversas com Transportadoras</h1>
        </div>
      </header>
      <div className="container mx-auto p-4">
        <p className="text-muted-foreground">Sistema de conversas em desenvolvimento...</p>
      </div>
    </div>
  );
}
