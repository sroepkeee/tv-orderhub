import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight, Sparkles } from "lucide-react";

interface HeroSectionProps {
  onCtaClick: () => void;
}

export function HeroSection({ onCtaClick }: HeroSectionProps) {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-gradient-to-br from-background via-background to-primary/5">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 py-20 relative z-10">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            <span>Controle Operacional com IA</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
            Seus clientes perguntam{" "}
            <span className="text-primary">"onde está meu pedido?"</span>
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              A IA responde no WhatsApp.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Controle operacional com rastreio em tempo real, fases customizáveis 
            e atendimento automatizado. Setup em 1 dia. Sem complexidade.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Button 
              size="lg" 
              onClick={onCtaClick}
              className="text-lg px-8 py-6 rounded-full shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all group"
            >
              <MessageCircle className="w-5 h-5 mr-2" />
              Começar Agora
              <ArrowRight className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button 
              variant="outline" 
              size="lg"
              onClick={onCtaClick}
              className="text-lg px-8 py-6 rounded-full border-2"
            >
              Agendar Demo
            </Button>
          </div>

          {/* Social Proof */}
          <div className="pt-8 flex items-center justify-center gap-8 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>+1.000 pedidos rastreados</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-border" />
            <div className="hidden sm:flex items-center gap-2">
              <span>⭐ 4.9/5 satisfação</span>
            </div>
            <div className="hidden md:block w-px h-4 bg-border" />
            <div className="hidden md:flex items-center gap-2">
              <span>🚀 Setup em 1 dia</span>
            </div>
          </div>
        </div>

        {/* Demo Visual */}
        <div className="mt-16 max-w-3xl mx-auto">
          <div className="relative rounded-2xl bg-card border shadow-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-background/80 to-transparent z-10 pointer-events-none" />
            <div className="p-6 space-y-4">
              {/* Fake WhatsApp conversation */}
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg">
                  👤
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3 max-w-xs">
                  <p className="text-sm">Olá! Onde está meu pedido #12345?</p>
                  <span className="text-xs text-muted-foreground">10:30</span>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-3 max-w-sm">
                  <p className="text-sm">
                    Olá! 👋 Seu pedido #12345 está em <strong>Produção</strong>, 
                    fase 3 de 5. Previsão de entrega: 22/12. 
                    Acompanhe em tempo real! 📦
                  </p>
                  <span className="text-xs opacity-80">10:30 ✓✓</span>
                </div>
                <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-lg">
                  🤖
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
