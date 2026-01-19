import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Mail, CreditCard, Headphones, Server, Link2, 
  MoreHorizontal, Shield, ShieldCheck, ShieldAlert,
  Loader2, Upload, Camera
} from 'lucide-react';
import { useAccessBlocks } from '@/hooks/useReturnProcesses';
import { 
  AccessBlock, 
  AccessType,
  ACCESS_TYPE_LABELS, 
  ACCESS_BLOCK_STATUS_LABELS,
  ACCESS_BLOCK_STATUS_COLORS
} from '@/types/returnProcess';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AccessBlockPanelProps {
  processId: string;
  readOnly?: boolean;
}

const ACCESS_TYPE_ICONS: Record<AccessType, React.ElementType> = {
  email: Mail,
  paytrack: CreditCard,
  desk_manager: Headphones,
  sistema_interno: Server,
  integracao_externa: Link2,
  outro: MoreHorizontal,
};

export function AccessBlockPanel({ processId, readOnly = false }: AccessBlockPanelProps) {
  const { blocks, loading, updateBlock } = useAccessBlocks(processId);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [blockNotes, setBlockNotes] = useState<Record<string, string>>({});
  const [expandedBlock, setExpandedBlock] = useState<string | null>(null);

  const handleToggleBlock = async (block: AccessBlock) => {
    if (readOnly) return;
    // Only allow toggling to bloqueado
    await updateBlock(block.id, 'bloqueado', undefined, blockNotes[block.id]);
  };

  const handleMarkNotApplicable = async (block: AccessBlock) => {
    if (readOnly) return;
    await updateBlock(block.id, 'nao_aplicavel', undefined, blockNotes[block.id] || 'Não aplicável');
  };

  const handleUploadEvidence = async (blockId: string, file: File) => {
    setUploadingId(blockId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${processId}/access-blocks/${blockId}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('technician-returns')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('technician-returns')
        .getPublicUrl(fileName);

      await updateBlock(blockId, 'bloqueado', urlData.publicUrl, blockNotes[blockId]);
      toast.success('Print do bloqueio enviado');
    } catch (error) {
      console.error('Error uploading evidence:', error);
      toast.error('Erro ao enviar arquivo');
    } finally {
      setUploadingId(null);
    }
  };

  const totalBlocks = blocks.length;
  const completedBlocks = blocks.filter(b => b.status === 'bloqueado' || b.status === 'nao_aplicavel').length;
  const pendingBlocks = blocks.filter(b => b.status === 'pendente').length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Controle de Acessos
              </CardTitle>
              <CardDescription>
                Gerencie o bloqueio de acessos do técnico
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {pendingBlocks > 0 && (
                <Badge variant="secondary" className="bg-amber-100 text-amber-800">
                  {pendingBlocks} pendente{pendingBlocks > 1 ? 's' : ''}
                </Badge>
              )}
              <Badge variant="secondary" className="bg-emerald-100 text-emerald-800">
                {completedBlocks}/{totalBlocks} bloqueados
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{ width: `${(completedBlocks / totalBlocks) * 100}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Access Blocks List */}
      <div className="grid gap-3">
        {blocks.map((block) => {
          const Icon = ACCESS_TYPE_ICONS[block.access_type];
          const isExpanded = expandedBlock === block.id;

          return (
            <Card 
              key={block.id}
              className={`transition-colors ${
                block.status === 'bloqueado'
                  ? 'border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-950/20'
                  : block.status === 'nao_aplicavel'
                  ? 'border-muted bg-muted/30'
                  : ''
              }`}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${
                    block.status === 'bloqueado'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300'
                      : block.status === 'nao_aplicavel'
                      ? 'bg-muted text-muted-foreground'
                      : 'bg-primary/10 text-primary'
                  }`}>
                    <Icon className="h-5 w-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`font-medium ${
                          block.status === 'nao_aplicavel' ? 'text-muted-foreground line-through' : ''
                        }`}>
                          {ACCESS_TYPE_LABELS[block.access_type]}
                        </p>
                        {block.access_name && (
                          <p className="text-sm text-muted-foreground">
                            {block.access_name}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-3">
                        <Badge className={ACCESS_BLOCK_STATUS_COLORS[block.status]}>
                          {block.status === 'bloqueado' && <ShieldCheck className="h-3 w-3 mr-1" />}
                          {block.status === 'pendente' && <ShieldAlert className="h-3 w-3 mr-1" />}
                          {ACCESS_BLOCK_STATUS_LABELS[block.status]}
                        </Badge>

                        {!readOnly && block.status === 'pendente' && (
                          <Switch
                            checked={false}
                            onCheckedChange={() => handleToggleBlock(block)}
                          />
                        )}
                      </div>
                    </div>

                    {/* Evidence */}
                    {block.evidence_url && (
                      <a
                        href={block.evidence_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
                      >
                        <Camera className="h-4 w-4" />
                        Ver print do bloqueio
                      </a>
                    )}

                    {/* Blocked info */}
                    {block.blocked_at && (
                      <p className="text-xs text-muted-foreground">
                        Bloqueado em {new Date(block.blocked_at).toLocaleString('pt-BR')}
                      </p>
                    )}

                    {/* Notes */}
                    {block.notes && (
                      <p className="text-sm text-muted-foreground">
                        {block.notes}
                      </p>
                    )}

                    {/* Actions for pending */}
                    {!readOnly && block.status === 'pendente' && (
                      <div className="pt-2 space-y-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setExpandedBlock(isExpanded ? null : block.id)}
                        >
                          {isExpanded ? 'Fechar' : 'Registrar Bloqueio'}
                        </Button>

                        {isExpanded && (
                          <div className="p-3 bg-muted/50 rounded-lg space-y-3">
                            <div className="space-y-2">
                              <Label>Observações</Label>
                              <Textarea
                                value={blockNotes[block.id] || ''}
                                onChange={(e) => setBlockNotes({
                                  ...blockNotes,
                                  [block.id]: e.target.value
                                })}
                                placeholder="Notas sobre o bloqueio..."
                                rows={2}
                              />
                            </div>

                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={uploadingId === block.id}
                                onClick={() => {
                                  const input = document.createElement('input');
                                  input.type = 'file';
                                  input.accept = 'image/*';
                                  input.onchange = (e) => {
                                    const file = (e.target as HTMLInputElement).files?.[0];
                                    if (file) handleUploadEvidence(block.id, file);
                                  };
                                  input.click();
                                }}
                              >
                                {uploadingId === block.id ? (
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                  <Upload className="h-4 w-4 mr-2" />
                                )}
                                Enviar Print
                              </Button>

                              <Button
                                size="sm"
                                onClick={() => {
                                  handleToggleBlock(block);
                                  setExpandedBlock(null);
                                }}
                              >
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Confirmar Bloqueio
                              </Button>

                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkNotApplicable(block)}
                              >
                                N/A
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
