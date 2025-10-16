import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  status?: 'good' | 'warning' | 'critical';
}

export const MetricCard = ({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  trend, 
  trendValue, 
  status 
}: MetricCardProps) => {
  const statusStyles = {
    good: 'border-l-[hsl(var(--progress-good))] bg-[hsl(var(--priority-low-bg))]',
    warning: 'border-l-[hsl(var(--progress-warning))] bg-[hsl(var(--priority-medium-bg))]',
    critical: 'border-l-[hsl(var(--progress-critical))] bg-[hsl(var(--priority-high-bg))]'
  };
  
  const trendStyles = {
    up: 'text-[hsl(var(--progress-good))]',
    down: 'text-[hsl(var(--progress-critical))]',
    neutral: 'text-muted-foreground'
  };
  
  return (
    <Card className={cn("border-l-4 transition-all hover:shadow-lg p-3", status && statusStyles[status])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 p-3">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </CardHeader>
      <CardContent className="p-3 pt-0">
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
        )}
        {trend && trendValue && (
          <div className={cn("flex items-center text-xs mt-1.5 font-medium", trend && trendStyles[trend])}>
            {trendValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
