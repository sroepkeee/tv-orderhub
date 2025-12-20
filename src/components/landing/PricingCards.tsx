import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface PricingCardsProps {
  onSelectPlan: (plan: string) => void;
}

const plans = [
  {
    name: "Starter",
    price: "297",
    period: "/mês",
    description: "Para operações em crescimento",
    features: [
      "Até 100 pedidos/mês",
      "1 número WhatsApp",
      "Fases customizáveis",
      "Consulta via WhatsApp",
      "Dashboard básico",
      "Suporte por email",
    ],
    popular: false,
    cta: "Começar Grátis",
  },
  {
    name: "Pro",
    price: "597",
    period: "/mês",
    description: "Para operações consolidadas",
    features: [
      "Até 500 pedidos/mês",
      "2 números WhatsApp",
      "Fases customizáveis",
      "IA avançada com contexto",
      "Relatórios gerenciais",
      "Alertas inteligentes",
      "Suporte prioritário",
      "Integrações API",
    ],
    popular: true,
    cta: "Escolher Pro",
  },
  {
    name: "Enterprise",
    price: "Sob consulta",
    period: "",
    description: "Para grandes operações",
    features: [
      "Pedidos ilimitados",
      "WhatsApp ilimitado",
      "Multi-organizações",
      "IA personalizada",
      "SLA garantido",
      "Gerente de sucesso",
      "Treinamento da equipe",
      "Integrações customizadas",
    ],
    popular: false,
    cta: "Falar com Vendas",
  },
];

export function PricingCards({ onSelectPlan }: PricingCardsProps) {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Planos que cabem na sua{" "}
            <span className="text-primary">operação</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Comece grátis por 14 dias. Sem cartão de crédito.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.name}
              className={`relative flex flex-col ${
                plan.popular 
                  ? "border-primary shadow-lg shadow-primary/10 scale-105" 
                  : "border-border"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Mais Popular
                </Badge>
              )}
              
              <CardHeader className="text-center pb-0">
                <h3 className="text-xl font-semibold text-foreground">{plan.name}</h3>
                <p className="text-sm text-muted-foreground">{plan.description}</p>
                <div className="pt-4">
                  <span className="text-4xl font-bold text-foreground">
                    {plan.price.startsWith("Sob") ? "" : "R$ "}
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>

              <CardContent className="flex-1 pt-6">
                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3">
                      <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button 
                  onClick={() => onSelectPlan(plan.name)}
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                  size="lg"
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
