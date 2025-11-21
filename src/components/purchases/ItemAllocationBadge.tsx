import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ItemCostAllocation } from "@/types/purchases";

interface ItemAllocationBadgeProps {
  allocations?: ItemCostAllocation[];
}

export function ItemAllocationBadge({ allocations }: ItemAllocationBadgeProps) {
  if (!allocations || allocations.length === 0) {
    return (
      <Badge variant="destructive" className="gap-1">
        ❌ Sem rateio
      </Badge>
    );
  }

  const totalPercentage = allocations.reduce((sum, a) => sum + a.allocation_percentage, 0);
  
  if (totalPercentage === 100) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="default" className="gap-1 cursor-help bg-green-600 hover:bg-green-700">
              ✅ {allocations.length} rateio{allocations.length > 1 ? 's' : ''} (100%)
            </Badge>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1">
              <p className="font-semibold">Rateios configurados:</p>
              {allocations.map((allocation, idx) => (
                <p key={idx} className="text-sm">
                  • {allocation.allocation_percentage}% - {allocation.business_unit}
                  <br />
                  <span className="text-muted-foreground ml-2">
                    ({allocation.cost_center}, {allocation.warehouse})
                  </span>
                </p>
              ))}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Badge variant="secondary" className="gap-1 bg-yellow-600 hover:bg-yellow-700">
      ⚠️ Parcial ({totalPercentage}%)
    </Badge>
  );
}
