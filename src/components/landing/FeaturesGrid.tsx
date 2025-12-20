import { FileInput, GitBranch, Settings2, UserCheck, MessageSquare, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: FileInput,
    title: "Entrada Flexível",
    description: "Importe via CSV, formulário ou integração. Campos configuráveis para sua operação. Validação automática.",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    icon: GitBranch,
    title: "Fluxo Visual",
    description: "Visualize o processo inteiro. Arraste itens entre fases. Saiba onde cada coisa está em tempo real.",
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    icon: Settings2,
    title: "Processo Seu",
    description: "Configure até 20 fases. Nomes, ordem, cores. Exatamente como sua operação funciona na prática.",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    icon: UserCheck,
    title: "Dono por Etapa",
    description: "Cada fase tem seu responsável. Notificação automática quando entra processo. Histórico completo.",
    color: "bg-green-500/10 text-green-600",
  },
  {
    icon: MessageSquare,
    title: "WhatsApp Nativo",
    description: "\"Qual o status do X?\" — A IA responde. Funciona 24/7, onde seu time e clientes já estão.",
    color: "bg-emerald-500/10 text-emerald-600",
  },
  {
    icon: BarChart3,
    title: "5 Métricas que Importam",
    description: "Tempo por fase, atrasados, gargalos, volume, performance. Sem dashboard pesado. Decisão rápida.",
    color: "bg-cyan-500/10 text-cyan-600",
  },
];

export function FeaturesGrid() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Os 6 módulos que{" "}
            <span className="text-primary">sua operação precisa</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Funcionalidades essenciais. Sem complexidade desnecessária. Tudo configurável.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {features.map((feature, index) => (
            <Card 
              key={feature.title}
              className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-2 hover:border-primary/20"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardContent className="p-6 space-y-4">
                <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-semibold text-foreground">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </section>
  );
}
