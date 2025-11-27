import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { WhatsAppConnectionCard } from '@/components/carriers/WhatsAppConnectionCard';
import { WhatsAppWebhookCard } from '@/components/carriers/WhatsAppWebhookCard';
import { WhatsAppAuthGuard } from '@/components/carriers/WhatsAppAuthGuard';

export default function WhatsAppSettings() {
  const navigate = useNavigate();

  return (
    <WhatsAppAuthGuard>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-background sticky top-0 z-10">
          <div className="flex items-center justify-between gap-4 p-4">
            <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/carriers-chat')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
              <div>
                <h1 className="text-2xl font-bold">Conexões WhatsApp</h1>
                <p className="text-sm text-muted-foreground">Gerencie suas conexões com o WhatsApp Business API</p>
              </div>
            </div>
          </div>
        </header>

        <div className="container mx-auto p-6 max-w-4xl space-y-6">
          <WhatsAppConnectionCard />
          <WhatsAppWebhookCard />
        </div>
      </div>
    </WhatsAppAuthGuard>
  );
}
