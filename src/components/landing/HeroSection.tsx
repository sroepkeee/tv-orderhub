import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, ArrowRight, Sparkles } from "lucide-react";

interface HeroSectionProps {
  onCtaClick: () => void;
}

const processExamples = [
  { type: "Pedido", id: "#12345", phase: "Produção", step: "3 de 5", date: "22/12" },
  { type: "OS", id: "#4521", phase: "Montagem", step: "4 de 6", date: "23/12" },
  { type: "Projeto", id: "ALFA-01", phase: "Execução", step: "2 de 4", date: "28/12" },
  { type: "Carga", id: "#789", phase: "Trânsito", step: "5 de 6", date: "20/12" },
];

export function HeroSection({ onCtaClick }: HeroSectionProps) {
  const [currentExample, setCurrentExample] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentExample((prev) => (prev + 1) % processExamples.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const example = processExamples[currentExample];

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
            <span>V.I.V.O. CORE — Controle Operacional Inteligente</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-foreground leading-tight">
            Saber exatamente onde cada{" "}
            <span className="text-primary">processo</span> está.
            <br />
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Em tempo real.
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Controle operacional com IA + WhatsApp. Fases customizáveis, responsáveis 
            por etapa, métricas automáticas. Funciona para pedidos, OS, projetos, cargas. 
            Setup em 1 dia. Sem complexidade.
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
              <span>+1.000 processos controlados</span>
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
                  <p className="text-sm transition-all duration-500">
                    Olá! Qual o status d{example.type === "Carga" ? "a" : "o"} {example.type} {example.id}?
                  </p>
                  <span className="text-xs text-muted-foreground">10:30</span>
                </div>
              </div>
              <div className="flex gap-3 justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-none px-4 py-3 max-w-sm">
                  <p className="text-sm transition-all duration-500">
                    Olá! 👋 {example.type === "Carga" ? "A" : "O"} {example.type} {example.id} está em <strong>{example.phase}</strong>, 
                    fase {example.step}. Previsão: {example.date}. 
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
          {/* Process type indicators */}
          <div className="flex justify-center gap-2 mt-4">
            {processExamples.map((_, idx) => (
              <div 
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentExample ? "bg-primary w-6" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
