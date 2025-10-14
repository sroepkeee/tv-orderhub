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
    <Card className={cn("border-l-4 transition-all hover:shadow-lg", status && statusStyles[status])}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend && trendValue && (
          <div className={cn("flex items-center text-xs mt-2 font-medium", trend && trendStyles[trend])}>
            {trendValue}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
