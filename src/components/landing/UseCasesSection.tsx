import { Factory, ShoppingCart, Wrench, Truck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const useCases = [
  {
    segment: "Indústria",
    icon: Factory,
    process: "Ordens de Produção",
    example: "Ordem de Produção #4521 está em Montagem, fase 4 de 6.",
    color: "bg-amber-500/10 text-amber-600 border-amber-200",
  },
  {
    segment: "E-commerce",
    icon: ShoppingCart,
    process: "Pedidos de Venda",
    example: "Pedido #12345 está em Separação, previsão: 22/12.",
    color: "bg-blue-500/10 text-blue-600 border-blue-200",
  },
  {
    segment: "Serviços",
    icon: Wrench,
    process: "Chamados e OS",
    example: "Chamado #789 está com o técnico João, aguardando peça.",
    color: "bg-purple-500/10 text-purple-600 border-purple-200",
  },
  {
    segment: "Logística",
    icon: Truck,
    process: "Cargas e Entregas",
    example: "Carga #456 em trânsito, previsão de chegada: 14h.",
    color: "bg-green-500/10 text-green-600 border-green-200",
  },
];

export function UseCasesSection() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Funciona para{" "}
            <span className="text-primary">qualquer operação</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Pedidos, OS, projetos, cargas... Configure as fases do seu jeito.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {useCases.map((useCase) => (
            <Card 
              key={useCase.segment}
              className={`group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 ${useCase.color.split(' ')[2]}`}
            >
              <CardContent className="p-6 space-y-4">
                <div className={`w-14 h-14 rounded-xl ${useCase.color.split(' ').slice(0, 2).join(' ')} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <useCase.icon className="w-7 h-7" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">
                    {useCase.segment}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {useCase.process}
                  </p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground italic">
                    "{useCase.example}"
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
