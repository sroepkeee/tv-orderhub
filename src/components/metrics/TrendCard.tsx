import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrendCardProps {
  title: string;
  value: string | number;
  previousValue?: string | number;
  subtitle?: string;
  icon: LucideIcon;
  status?: 'good' | 'warning' | 'critical';
  format?: 'number' | 'percentage' | 'days';
  additionalMetrics?: Array<{
    label: string;
    value: string | number;
    highlight?: boolean;
  }>;
}

export const TrendCard = ({ 
  title, 
  value, 
  previousValue,
  subtitle, 
  icon: Icon, 
  status,
  additionalMetrics
}: TrendCardProps) => {
  const statusStyles = {
    good: 'border-l-[hsl(var(--progress-good))] bg-[hsl(var(--priority-low-bg))]',
    warning: 'border-l-[hsl(var(--progress-warning))] bg-[hsl(var(--priority-medium-bg))]',
    critical: 'border-l-[hsl(var(--progress-critical))] bg-[hsl(var(--priority-high-bg))]'
  };

  const calculateTrend = () => {
    if (previousValue === undefined) return null;
    
    const current = typeof value === 'string' ? parseFloat(value) : value;
    const previous = typeof previousValue === 'string' ? parseFloat(previousValue) : previousValue;
    
    if (isNaN(current) || isNaN(previous) || previous === 0) return null;
    
    const diff = current - previous;
    const percentChange = ((diff / previous) * 100).toFixed(1);
    
    return {
      diff,
      percentChange,
      isPositive: diff > 0,
      isNeutral: diff === 0
    };
  };

  const trend = calculateTrend();
  
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
        {additionalMetrics && additionalMetrics.length > 0 && (
          <div className="mt-2 space-y-1 pt-2 border-t border-border/50">
            {additionalMetrics.map((metric, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{metric.label}</span>
                <span className={cn(
                  "font-medium",
                  metric.highlight ? "text-destructive" : "text-foreground"
                )}>
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        )}
        {trend && (
          <div className="flex items-center gap-1 mt-2">
            {trend.isNeutral ? (
              <Minus className="h-3 w-3 text-muted-foreground" />
            ) : trend.isPositive ? (
              <TrendingUp className="h-3 w-3 text-[hsl(var(--progress-good))]" />
            ) : (
              <TrendingDown className="h-3 w-3 text-[hsl(var(--progress-critical))]" />
            )}
            <span className={cn(
              "text-xs font-medium",
              trend.isNeutral ? "text-muted-foreground" :
              trend.isPositive ? "text-[hsl(var(--progress-good))]" : "text-[hsl(var(--progress-critical))]"
            )}>
              {trend.isPositive && '+'}{trend.percentChange}% vs período anterior
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};