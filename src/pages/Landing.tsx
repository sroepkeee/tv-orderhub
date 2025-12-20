import { useState, useRef } from "react";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesGrid } from "@/components/landing/FeaturesGrid";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { PricingCards } from "@/components/landing/PricingCards";
import { FAQSection } from "@/components/landing/FAQSection";
import { LeadForm } from "@/components/landing/LeadForm";
import { Footer } from "@/components/landing/Footer";

export default function Landing() {
  const [selectedPlan, setSelectedPlan] = useState<string | undefined>();
  const formRef = useRef<HTMLDivElement>(null);

  const scrollToForm = () => {
    document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" });
  };

  const handlePlanSelect = (plan: string) => {
    setSelectedPlan(plan);
    scrollToForm();
  };

  return (
    <div className="min-h-screen bg-background">
      <HeroSection onCtaClick={scrollToForm} />
      <div id="features">
        <FeaturesGrid />
      </div>
      <HowItWorks />
      <div id="pricing">
        <PricingCards onSelectPlan={handlePlanSelect} />
      </div>
      <div id="faq">
        <FAQSection />
      </div>
      <LeadForm selectedPlan={selectedPlan} />
      <Footer />
    </div>
  );
}
