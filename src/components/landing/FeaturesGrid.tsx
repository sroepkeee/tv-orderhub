import { MessageCircle, LayoutDashboard, Settings, Users, BarChart3, Bell } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: MessageCircle,
    title: "Consulta via WhatsApp",
    description: "Cliente manda mensagem, IA responde o status automaticamente. 24/7, sem intervenção humana.",
    color: "bg-green-500/10 text-green-600",
  },
  {
    icon: LayoutDashboard,
    title: "Kanban de Fases",
    description: "Visualize onde cada pedido está no fluxo. Arraste entre fases com um clique.",
    color: "bg-blue-500/10 text-blue-600",
  },
  {
    icon: Settings,
    title: "Fases Customizáveis",
    description: "Configure o fluxo da sua operação. Crie as fases que fazem sentido pro seu negócio.",
    color: "bg-purple-500/10 text-purple-600",
  },
  {
    icon: Users,
    title: "Responsáveis por Etapa",
    description: "Cada fase tem seu dono. Notificações automáticas quando pedidos chegam.",
    color: "bg-orange-500/10 text-orange-600",
  },
  {
    icon: BarChart3,
    title: "Métricas Automáticas",
    description: "Dashboard gerencial diário via WhatsApp. Saiba exatamente como está sua operação.",
    color: "bg-cyan-500/10 text-cyan-600",
  },
  {
    icon: Bell,
    title: "Alertas Inteligentes",
    description: "Atrasos e gargalos detectados automaticamente. Aja antes que vire problema.",
    color: "bg-red-500/10 text-red-600",
  },
];

export function FeaturesGrid() {
  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Tudo que você precisa para{" "}
            <span className="text-primary">controlar sua operação</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Funcionalidades essenciais. Sem complexidade desnecessária.
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
