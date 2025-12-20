import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Quanto tempo leva para começar a usar?",
    answer: "Em média, 1 dia útil. Fazemos a configuração inicial junto com você, importamos seus pedidos e treinamos a IA com o contexto da sua operação.",
  },
  {
    question: "Preciso ter conhecimento técnico?",
    answer: "Não. A plataforma foi desenhada para gestores de operação. Interface visual, sem código. Se você sabe usar WhatsApp, sabe usar o V.I.V.O.",
  },
  {
    question: "Como a IA responde os clientes?",
    answer: "A IA é treinada com o contexto da sua operação. Ela entende as fases, consulta o status do pedido e responde de forma natural e personalizada via WhatsApp.",
  },
  {
    question: "Posso cancelar a qualquer momento?",
    answer: "Sim. Sem fidelidade, sem multa. Você pode cancelar quando quiser e seus dados ficam disponíveis para exportação.",
  },
  {
    question: "Funciona com meu sistema atual?",
    answer: "Sim. Temos importação via CSV para começar rápido, e API para integrações mais avançadas. Funciona em paralelo com seu ERP.",
  },
  {
    question: "É seguro? Onde ficam meus dados?",
    answer: "Sim. Usamos infraestrutura Supabase com criptografia em trânsito e repouso. Seus dados ficam em servidores seguros com backup automático.",
  },
];

export function FAQSection() {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            Perguntas Frequentes
          </h2>
          <p className="text-lg text-muted-foreground">
            Tire suas dúvidas sobre o V.I.V.O.
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="w-full space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem 
                key={index} 
                value={`item-${index}`}
                className="border rounded-lg px-6 bg-card"
              >
                <AccordionTrigger className="text-left font-medium hover:no-underline">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}
