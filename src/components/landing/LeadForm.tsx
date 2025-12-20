import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Loader2, Send, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const formSchema = z.object({
  company_name: z.string().min(2, "Nome da empresa é obrigatório"),
  contact_name: z.string().min(2, "Seu nome é obrigatório"),
  email: z.string().email("Email inválido"),
  whatsapp: z.string().min(10, "WhatsApp inválido"),
  segment: z.string().optional(),
  monthly_volume: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const segments = [
  "E-commerce",
  "Indústria",
  "Logística",
  "Varejo",
  "Serviços",
  "Tecnologia",
  "Outro",
];

const volumes = [
  "Até 50 pedidos/mês",
  "50-100 pedidos/mês",
  "100-500 pedidos/mês",
  "500-1000 pedidos/mês",
  "Mais de 1000 pedidos/mês",
];

interface LeadFormProps {
  selectedPlan?: string;
}

export function LeadForm({ selectedPlan }: LeadFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from("saas_leads").insert({
        company_name: data.company_name,
        contact_name: data.contact_name,
        email: data.email,
        whatsapp: data.whatsapp,
        segment: data.segment,
        monthly_volume: data.monthly_volume,
        notes: selectedPlan ? `Plano selecionado: ${selectedPlan}` : undefined,
      });

      if (error) throw error;

      setIsSubmitted(true);
      toast({
        title: "Recebemos seu contato! 🎉",
        description: "Em breve entraremos em contato pelo WhatsApp.",
      });
    } catch (error) {
      console.error("Error submitting lead:", error);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente ou entre em contato pelo WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <section id="lead-form" className="py-24 bg-primary/5">
        <div className="container mx-auto px-4">
          <Card className="max-w-lg mx-auto text-center">
            <CardContent className="pt-12 pb-8 space-y-4">
              <div className="w-20 h-20 rounded-full bg-green-500/10 text-green-600 flex items-center justify-center mx-auto">
                <CheckCircle className="w-10 h-10" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">
                Recebemos seu contato!
              </h3>
              <p className="text-muted-foreground">
                Nossa equipe entrará em contato pelo WhatsApp em até 24 horas 
                para agendar sua demonstração personalizada.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    );
  }

  return (
    <section id="lead-form" className="py-24 bg-primary/5">
      <div className="container mx-auto px-4">
        <div className="max-w-lg mx-auto">
          <Card className="shadow-xl border-2">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                {selectedPlan 
                  ? `Começar com o plano ${selectedPlan}` 
                  : "Fale com nossa equipe"}
              </CardTitle>
              <CardDescription>
                Preencha seus dados e receba uma demonstração personalizada
              </CardDescription>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="company_name">Nome da Empresa *</Label>
                  <Input
                    id="company_name"
                    placeholder="Sua empresa"
                    {...register("company_name")}
                    className={errors.company_name ? "border-destructive" : ""}
                  />
                  {errors.company_name && (
                    <p className="text-sm text-destructive">{errors.company_name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contact_name">Seu Nome *</Label>
                  <Input
                    id="contact_name"
                    placeholder="Como podemos te chamar?"
                    {...register("contact_name")}
                    className={errors.contact_name ? "border-destructive" : ""}
                  />
                  {errors.contact_name && (
                    <p className="text-sm text-destructive">{errors.contact_name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    {...register("email")}
                    className={errors.email ? "border-destructive" : ""}
                  />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="whatsapp">WhatsApp *</Label>
                  <Input
                    id="whatsapp"
                    placeholder="(00) 00000-0000"
                    {...register("whatsapp")}
                    className={errors.whatsapp ? "border-destructive" : ""}
                  />
                  {errors.whatsapp && (
                    <p className="text-sm text-destructive">{errors.whatsapp.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Segmento</Label>
                  <Select onValueChange={(value) => setValue("segment", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o segmento" />
                    </SelectTrigger>
                    <SelectContent>
                      {segments.map((segment) => (
                        <SelectItem key={segment} value={segment}>
                          {segment}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Volume Mensal de Pedidos</Label>
                  <Select onValueChange={(value) => setValue("monthly_volume", value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Quantos pedidos por mês?" />
                    </SelectTrigger>
                    <SelectContent>
                      {volumes.map((volume) => (
                        <SelectItem key={volume} value={volume}>
                          {volume}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Quero uma demonstração
                    </>
                  )}
                </Button>

                <p className="text-xs text-center text-muted-foreground">
                  Ao enviar, você concorda em receber contato da nossa equipe.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
