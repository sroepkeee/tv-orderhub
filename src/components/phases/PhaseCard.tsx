import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Pencil, Trash2, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import type { PhaseConfig, UserByRole } from "@/pages/PhaseSettings";
import { ROLE_LABELS } from "@/lib/roleLabels";

interface PhaseCardProps {
  phase: PhaseConfig;
  index: number;
  users: UserByRole[];
  onEdit: () => void;
  onDelete: () => void;
}

export function PhaseCard({ phase, index, users, onEdit, onDelete }: PhaseCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: phase.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const roleLabel = phase.responsible_role 
    ? ROLE_LABELS[phase.responsible_role]?.name || phase.responsible_role
    : null;

  const getInitials = (name: string | null, email: string | null) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return '?';
  };

  const maxVisibleAvatars = 3;
  const visibleUsers = users.slice(0, maxVisibleAvatars);
  const remainingCount = users.length - maxVisibleAvatars;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 p-4 bg-card border rounded-lg ${
        isDragging ? "opacity-50 shadow-lg" : ""
      }`}
    >
      <button
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>

      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-semibold text-sm">
        {index + 1}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium truncate">{phase.display_name}</h3>
          <Badge variant="outline" className="text-xs">
            {phase.phase_key}
          </Badge>
        </div>
        
        <div className="flex items-center gap-4 mt-1">
          {roleLabel && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <User className="h-3 w-3" />
              <span>{roleLabel}</span>
            </div>
          )}
          
          {users.length > 0 && (
            <HoverCard>
              <HoverCardTrigger asChild>
                <div className="flex items-center gap-2 cursor-pointer group">
                  <div className="flex -space-x-2">
                    {visibleUsers.map((user) => (
                      <Avatar key={user.id} className="h-6 w-6 border-2 border-background">
                        <AvatarFallback className="text-[10px] bg-muted">
                          {getInitials(user.full_name, user.email)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {remainingCount > 0 && (
                      <div className="flex items-center justify-center h-6 w-6 rounded-full bg-muted border-2 border-background text-[10px] font-medium">
                        +{remainingCount}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                    <Users className="h-3 w-3 inline mr-1" />
                    {users.length} usuário{users.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </HoverCardTrigger>
              <HoverCardContent className="w-64" align="start">
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Usuários com esta função</h4>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {users.map((user) => (
                      <div key={user.id} className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarFallback className="text-[10px]">
                            {getInitials(user.full_name, user.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {user.full_name || 'Sem nome'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </Button>
        
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover fase?</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover a fase "{phase.display_name}"? 
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
