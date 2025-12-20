import { Upload, Zap, TrendingUp } from "lucide-react";

const steps = [
  {
    icon: Upload,
    number: "01",
    title: "Importe seus pedidos",
    description: "Via CSV, formulário ou integração. Seus pedidos entram no sistema em segundos.",
  },
  {
    icon: Zap,
    number: "02",
    title: "Configure suas fases",
    description: "Defina o fluxo da sua operação. A IA aprende e começa a responder automaticamente.",
  },
  {
    icon: TrendingUp,
    number: "03",
    title: "Acompanhe e escale",
    description: "Métricas em tempo real. Clientes satisfeitos. Operação sob controle.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Como funciona?
          </h2>
          <p className="text-lg text-muted-foreground">
            Em 3 passos simples, sua operação está no ar
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Connection line */}
            <div className="hidden md:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-primary/20 via-primary to-primary/20 -translate-y-1/2" />

            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((step, index) => (
                <div key={step.number} className="relative">
                  <div className="flex flex-col items-center text-center space-y-4">
                    {/* Number bubble */}
                    <div className="relative z-10 w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/25">
                      <step.icon className="w-8 h-8" />
                    </div>
                    
                    {/* Step number */}
                    <span className="text-sm font-bold text-primary">{step.number}</span>
                    
                    {/* Content */}
                    <h3 className="text-xl font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
