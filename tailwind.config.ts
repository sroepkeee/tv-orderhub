import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    screens: {
      'xs': '640px',
      'sm': '768px',
      'md': '1024px',
      'lg': '1280px',
      'xl': '1440px',
      '2xl': '1920px',
      '3xl': '2560px',
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        priority: {
          high: "hsl(var(--priority-high))",
          "high-bg": "hsl(var(--priority-high-bg))",
          "high-border": "hsl(var(--priority-high-border))",
          medium: "hsl(var(--priority-medium))",
          "medium-bg": "hsl(var(--priority-medium-bg))",
          "medium-border": "hsl(var(--priority-medium-border))",
          low: "hsl(var(--priority-low))",
          "low-bg": "hsl(var(--priority-low-bg))",
          "low-border": "hsl(var(--priority-low-border))",
        },
        status: {
          // Preparação/Planejamento
          pending: "hsl(var(--status-pending))",
          "pending-bg": "hsl(var(--status-pending-bg))",
          analysis: "hsl(var(--status-analysis))",
          "analysis-bg": "hsl(var(--status-analysis-bg))",
          awaiting: "hsl(var(--status-awaiting))",
          "awaiting-bg": "hsl(var(--status-awaiting-bg))",
          planned: "hsl(var(--status-planned))",
          "planned-bg": "hsl(var(--status-planned-bg))",
          // Separação/Produção
          separation: "hsl(var(--status-separation))",
          "separation-bg": "hsl(var(--status-separation-bg))",
          production: "hsl(var(--status-production))",
          "production-bg": "hsl(var(--status-production-bg))",
          material: "hsl(var(--status-material))",
          "material-bg": "hsl(var(--status-material-bg))",
          "sep-complete": "hsl(var(--status-sep-complete))",
          "sep-complete-bg": "hsl(var(--status-sep-complete-bg))",
          "prod-complete": "hsl(var(--status-prod-complete))",
          "prod-complete-bg": "hsl(var(--status-prod-complete-bg))",
          // Embalagem/Conferência
          quality: "hsl(var(--status-quality))",
          "quality-bg": "hsl(var(--status-quality-bg))",
          packaging: "hsl(var(--status-packaging))",
          "packaging-bg": "hsl(var(--status-packaging-bg))",
          ready: "hsl(var(--status-ready))",
          "ready-bg": "hsl(var(--status-ready-bg))",
          // Expedição/Logística
          released: "hsl(var(--status-released))",
          "released-bg": "hsl(var(--status-released-bg))",
          expedition: "hsl(var(--status-expedition))",
          "expedition-bg": "hsl(var(--status-expedition-bg))",
          transit: "hsl(var(--status-transit))",
          "transit-bg": "hsl(var(--status-transit-bg))",
          scheduled: "hsl(var(--status-scheduled))",
          "scheduled-bg": "hsl(var(--status-scheduled-bg))",
          pickup: "hsl(var(--status-pickup))",
          "pickup-bg": "hsl(var(--status-pickup-bg))",
          // Conclusão
          delivered: "hsl(var(--status-delivered))",
          "delivered-bg": "hsl(var(--status-delivered-bg))",
          completed: "hsl(var(--status-completed))",
          "completed-bg": "hsl(var(--status-completed-bg))",
          // Exceção/Problemas
          cancelled: "hsl(var(--status-cancelled))",
          "cancelled-bg": "hsl(var(--status-cancelled-bg))",
          hold: "hsl(var(--status-hold))",
          "hold-bg": "hsl(var(--status-hold-bg))",
          delayed: "hsl(var(--status-delayed))",
          "delayed-bg": "hsl(var(--status-delayed-bg))",
          returned: "hsl(var(--status-returned))",
          "returned-bg": "hsl(var(--status-returned-bg))",
        },
        orderType: {
          production: "hsl(var(--type-production))",
          "production-bg": "hsl(var(--type-production-bg))",
          sales: "hsl(var(--type-sales))",
          "sales-bg": "hsl(var(--type-sales-bg))",
          materials: "hsl(var(--type-materials))",
          "materials-bg": "hsl(var(--type-materials-bg))",
          ecommerce: "hsl(var(--type-ecommerce))",
          "ecommerce-bg": "hsl(var(--type-ecommerce-bg))",
        },
        phase: {
          "almox-ssm": "hsl(var(--phase-almox-ssm))",
          "almox-ssm-bg": "hsl(var(--phase-almox-ssm-bg))",
          "order-gen": "hsl(var(--phase-order-gen))",
          "order-gen-bg": "hsl(var(--phase-order-gen-bg))",
          "almox-general": "hsl(var(--phase-almox-general))",
          "almox-general-bg": "hsl(var(--phase-almox-general-bg))",
          production: "hsl(var(--phase-production))",
          "production-bg": "hsl(var(--phase-production-bg))",
          balance: "hsl(var(--phase-balance))",
          "balance-bg": "hsl(var(--phase-balance-bg))",
          laboratory: "hsl(var(--phase-laboratory))",
          "laboratory-bg": "hsl(var(--phase-laboratory-bg))",
          packaging: "hsl(var(--phase-packaging))",
          "packaging-bg": "hsl(var(--phase-packaging-bg))",
          freight: "hsl(var(--phase-freight))",
          "freight-bg": "hsl(var(--phase-freight-bg))",
          "ready-invoice": "hsl(var(--phase-ready-invoice))",
          "ready-invoice-bg": "hsl(var(--phase-ready-invoice-bg))",
          invoicing: "hsl(var(--phase-invoicing))",
          "invoicing-bg": "hsl(var(--phase-invoicing-bg))",
          logistics: "hsl(var(--phase-logistics))",
          "logistics-bg": "hsl(var(--phase-logistics-bg))",
          transit: "hsl(var(--phase-transit))",
          "transit-bg": "hsl(var(--phase-transit-bg))",
          completion: "hsl(var(--phase-completion))",
          "completion-bg": "hsl(var(--phase-completion-bg))",
        },
        progress: {
          good: "hsl(var(--progress-good))",
          warning: "hsl(var(--progress-warning))",
          critical: "hsl(var(--progress-critical))",
        },
        dashboard: {
          header: "hsl(var(--dashboard-header))",
          nav: "hsl(var(--dashboard-nav))",
        },
        tab: {
          active: "hsl(var(--tab-active))",
          inactive: "hsl(var(--tab-inactive))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: {
            height: "0",
          },
          to: {
            height: "var(--radix-accordion-content-height)",
          },
        },
        "accordion-up": {
          from: {
            height: "var(--radix-accordion-content-height)",
          },
          to: {
            height: "0",
          },
        },
        "pulse-critical": {
          "0%, 100%": {
            backgroundColor: "hsl(var(--card))",
            boxShadow: "0 0 0 0 hsl(var(--progress-critical) / 0)"
          },
          "50%": {
            backgroundColor: "hsl(var(--progress-critical) / 0.05)",
            boxShadow: "0 0 0 4px hsl(var(--progress-critical) / 0.1)"
          },
        },
        "ecommerce-pulse": {
          "0%, 100%": {
            borderColor: "hsl(var(--ecommerce-pulse) / 0.12)",
            boxShadow: "0 0 0 0 hsl(var(--ecommerce-pulse) / 0)"
          },
          "50%": {
            borderColor: "hsl(var(--ecommerce-pulse) / 0.26)",
            boxShadow: "0 0 4px 1px hsl(var(--ecommerce-pulse) / 0.12)"
          },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "pulse-critical": "pulse-critical 3s ease-in-out infinite",
        "ecommerce-pulse": "ecommerce-pulse 12s cubic-bezier(0.4, 0, 0.2, 1) infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
