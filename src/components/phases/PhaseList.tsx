import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { PhaseCard } from "./PhaseCard";
import { EditPhaseDialog } from "./EditPhaseDialog";
import type { PhaseConfig, UserByRole } from "@/pages/PhaseSettings";

interface PhaseListProps {
  phases: PhaseConfig[];
  usersByRole: Record<string, UserByRole[]>;
  onReorder: (phases: PhaseConfig[]) => void;
  onUpdate: (phase: PhaseConfig) => void;
  onDelete: (phaseId: string) => void;
}

export function PhaseList({ phases, usersByRole, onReorder, onUpdate, onDelete }: PhaseListProps) {
  const [editingPhase, setEditingPhase] = useState<PhaseConfig | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = phases.findIndex((p) => p.id === active.id);
      const newIndex = phases.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(phases, oldIndex, newIndex);
      onReorder(reordered);
    }
  };

  return (
    <>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={phases.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="space-y-2">
            {phases.map((phase, index) => (
              <PhaseCard
                key={phase.id}
                phase={phase}
                index={index}
                users={phase.responsible_role ? usersByRole[phase.responsible_role] || [] : []}
                onEdit={() => setEditingPhase(phase)}
                onDelete={() => onDelete(phase.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <EditPhaseDialog
        phase={editingPhase}
        open={!!editingPhase}
        onOpenChange={(open) => !open && setEditingPhase(null)}
        onSave={(updated) => {
          onUpdate(updated);
          setEditingPhase(null);
        }}
        usersByRole={usersByRole}
      />
    </>
  );
}
