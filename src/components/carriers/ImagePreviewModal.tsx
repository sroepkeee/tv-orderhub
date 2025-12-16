import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, Bot, AlertTriangle, FileText, Package, Camera } from 'lucide-react';
import type { WhatsAppMedia } from '@/types/carriers';

interface ImagePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  media: WhatsAppMedia | null;
}

const getTypeIcon = (tipo: string) => {
  switch (tipo?.toLowerCase()) {
    case 'documento':
    case 'nota fiscal':
    case 'comprovante':
      return <FileText className="h-4 w-4" />;
    case 'embalagem':
    case 'produto':
      return <Package className="h-4 w-4" />;
    default:
      return <Camera className="h-4 w-4" />;
  }
};

export function ImagePreviewModal({ open, onOpenChange, media }: ImagePreviewModalProps) {
  if (!media) return null;

  const imageUrl = media.base64_data 
    ? `data:${media.mime_type || 'image/jpeg'};base64,${media.base64_data}`
    : media.storage_path || '';

  const aiAnalysis = media.ai_analysis as {
    tipo?: string;
    resumo?: string;
    detalhes?: string;
    detectou_problema?: boolean;
    relevante_para_pedido?: boolean;
  } | null;

  const handleDownload = () => {
    if (imageUrl) {
      const link = document.createElement('a');
      link.href = imageUrl;
      link.download = media.file_name || 'imagem.jpg';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {media.file_name || 'Imagem'}
            {aiAnalysis && (
              <Badge variant="secondary" className="ml-2">
                <Bot className="h-3 w-3 mr-1" />
                Analisado por IA
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Image */}
          <div className="lg:col-span-2 flex items-center justify-center bg-muted/30 rounded-lg p-2">
            <img
              src={imageUrl}
              alt={media.file_name || 'Preview'}
              className="max-w-full max-h-[60vh] object-contain rounded-lg"
            />
          </div>

          {/* AI Analysis Panel */}
          <div className="space-y-4">
            {aiAnalysis ? (
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h4 className="font-semibold flex items-center gap-2 text-sm">
                  <Bot className="h-4 w-4 text-primary" />
                  Análise da IA
                </h4>

                {aiAnalysis.tipo && (
                  <div className="flex items-center gap-2">
                    {getTypeIcon(aiAnalysis.tipo)}
                    <span className="text-sm">
                      <strong>Tipo:</strong> {aiAnalysis.tipo}
                    </span>
                  </div>
                )}

                {aiAnalysis.resumo && (
                  <div>
                    <strong className="text-sm">Resumo:</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      {aiAnalysis.resumo}
                    </p>
                  </div>
                )}

                {aiAnalysis.detalhes && (
                  <div>
                    <strong className="text-sm">Detalhes:</strong>
                    <p className="text-sm text-muted-foreground mt-1">
                      {aiAnalysis.detalhes}
                    </p>
                  </div>
                )}

                {aiAnalysis.detectou_problema && (
                  <Badge variant="destructive" className="mt-2">
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Problema detectado
                  </Badge>
                )}

                {aiAnalysis.relevante_para_pedido && (
                  <Badge variant="default" className="mt-2">
                    <Package className="h-3 w-3 mr-1" />
                    Relevante para pedido
                  </Badge>
                )}
              </div>
            ) : (
              <div className="p-4 bg-muted/30 rounded-lg text-center text-sm text-muted-foreground">
                <Bot className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Análise de IA não disponível</p>
              </div>
            )}

            {/* File Info */}
            <div className="p-4 bg-muted/30 rounded-lg space-y-2 text-sm">
              <h4 className="font-semibold">Informações do Arquivo</h4>
              {media.file_name && (
                <p><strong>Nome:</strong> {media.file_name}</p>
              )}
              {media.mime_type && (
                <p><strong>Tipo:</strong> {media.mime_type}</p>
              )}
              {media.file_size_bytes && (
                <p><strong>Tamanho:</strong> {(media.file_size_bytes / 1024).toFixed(1)} KB</p>
              )}
              {media.caption && (
                <p><strong>Legenda:</strong> {media.caption}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button onClick={handleDownload} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Baixar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
