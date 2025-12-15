import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { 
  Search, FileImage, FileText, FileAudio, File, 
  Download, Eye, Calendar, User, Filter,
  Image as ImageIcon, FolderOpen
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface FileItem {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  uploaded_at: string;
  uploaded_by: string;
  order_number?: string;
  source: 'attachment' | 'message';
}

export function AIAgentFilesTab() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      // Load from order_attachments
      const { data: attachments, error: attachError } = await supabase
        .from('order_attachments')
        .select(`
          id,
          file_name,
          file_type,
          file_size,
          file_path,
          uploaded_at,
          uploaded_by,
          orders!inner(order_number)
        `)
        .order('uploaded_at', { ascending: false })
        .limit(100);

      if (attachError) throw attachError;

      const formattedFiles: FileItem[] = (attachments || []).map((a: any) => ({
        id: a.id,
        file_name: a.file_name,
        file_type: a.file_type,
        file_size: a.file_size,
        file_path: a.file_path,
        uploaded_at: a.uploaded_at,
        uploaded_by: a.uploaded_by,
        order_number: a.orders?.order_number,
        source: 'attachment' as const
      }));

      setFiles(formattedFiles);
    } catch (error) {
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) return <FileImage className="h-8 w-8 text-blue-500" />;
    if (type.startsWith('audio/')) return <FileAudio className="h-8 w-8 text-purple-500" />;
    if (type.includes('pdf')) return <FileText className="h-8 w-8 text-red-500" />;
    return <File className="h-8 w-8 text-muted-foreground" />;
  };

  const getFileCategory = (type: string): string => {
    if (type.startsWith('image/')) return 'image';
    if (type.startsWith('audio/')) return 'audio';
    if (type.includes('pdf') || type.includes('document')) return 'document';
    return 'other';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredFiles = files.filter(file => {
    const matchesSearch = file.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (file.order_number && file.order_number.includes(searchTerm));
    const matchesType = filterType === 'all' || getFileCategory(file.file_type) === filterType;
    return matchesSearch && matchesType;
  });

  const handleDownload = async (file: FileItem) => {
    try {
      const { data, error } = await supabase.storage
        .from('order-attachments')
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handlePreview = async (file: FileItem) => {
    if (file.file_type.startsWith('image/')) {
      setSelectedFile(file);
      setPreviewOpen(true);
    }
  };

  const getFileUrl = async (path: string): Promise<string> => {
    const { data } = await supabase.storage
      .from('order-attachments')
      .getPublicUrl(path);
    return data.publicUrl;
  };

  return (
    <div className="space-y-4">
      {/* Header with filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FolderOpen className="h-5 w-5" />
              Arquivos Enviados e Recebidos
            </CardTitle>
            <Badge variant="secondary">{files.length} arquivos</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou número do pedido..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-40">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="image">Imagens</SelectItem>
                <SelectItem value="document">Documentos</SelectItem>
                <SelectItem value="audio">Áudios</SelectItem>
                <SelectItem value="other">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Files Grid */}
      <Card>
        <CardContent className="p-4">
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando arquivos...
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ImageIcon className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum arquivo encontrado</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-350px)]">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {filteredFiles.map(file => (
                  <Card 
                    key={file.id} 
                    className="group cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => handlePreview(file)}
                  >
                    <CardContent className="p-3">
                      {/* Preview/Icon */}
                      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center mb-2 overflow-hidden">
                        {file.file_type.startsWith('image/') ? (
                          <img
                            src={`${supabase.storage.from('order-attachments').getPublicUrl(file.file_path).data.publicUrl}`}
                            alt={file.file_name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          getFileIcon(file.file_type)
                        )}
                      </div>

                      {/* File info */}
                      <div className="space-y-1">
                        <p className="text-xs font-medium truncate" title={file.file_name}>
                          {file.file_name}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatFileSize(file.file_size)}</span>
                          <span>{format(new Date(file.uploaded_at), 'dd/MM', { locale: ptBR })}</span>
                        </div>
                        {file.order_number && (
                          <Badge variant="outline" className="text-xs w-full justify-center">
                            #{file.order_number}
                          </Badge>
                        )}
                      </div>

                      {/* Actions (visible on hover) */}
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="flex-1 h-7 text-xs"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(file);
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          Baixar
                        </Button>
                        {file.file_type.startsWith('image/') && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="flex-1 h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(file);
                            }}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Ver
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedFile?.file_name}</DialogTitle>
          </DialogHeader>
          {selectedFile && (
            <div className="space-y-4">
              <div className="flex justify-center bg-muted rounded-lg p-4">
                <img
                  src={`${supabase.storage.from('order-attachments').getPublicUrl(selectedFile.file_path).data.publicUrl}`}
                  alt={selectedFile.file_name}
                  className="max-h-[60vh] object-contain"
                />
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {format(new Date(selectedFile.uploaded_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                  </span>
                  <span>{formatFileSize(selectedFile.file_size)}</span>
                </div>
                <Button onClick={() => handleDownload(selectedFile)}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
