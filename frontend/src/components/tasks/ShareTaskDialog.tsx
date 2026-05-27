import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { shareApi, ShareResponse } from '@/utils/api/shareApi';
import { HiClipboard, HiTrash, HiCheck } from 'react-icons/hi2';
import { formatDateTimeForDisplay } from '@/utils/date';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { HiLink } from 'react-icons/hi';
import ActionButton from '@/components/common/ActionButton';

interface ShareTaskDialogProps {
  taskId: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function ShareTaskDialog({ taskId, isOpen, onClose }: ShareTaskDialogProps) {
  const [expiryDays, setExpiryDays] = useState('7');
  const [shares, setShares] = useState<ShareResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadShares();
    }
  }, [isOpen, taskId]);

  const loadShares = async () => {
    setLoading(true);
    try {
      const data = await shareApi.getSharesForTask(taskId);
      setShares(data);
    } catch (error) {
      toast.error('Không thể tải liên kết chia sẻ');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShare = async () => {
    setCreating(true);
    try {
      const newShare = await shareApi.createShare({
        taskId,
        expiresInDays: parseInt(expiryDays),
      });
      setShares((currentShares) => [newShare, ...currentShares]);
      toast.success('Đã tạo liên kết công khai');
      if (newShare.shareUrl) {
        await copyToClipboard(newShare.shareUrl, newShare.id, false);
      } else {
        await loadShares();
      }
    } catch (error) {
      toast.error('Không thể tạo liên kết chia sẻ');
    } finally {
      setCreating(false);
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    try {
      await shareApi.revokeShare(shareId);
      setShares((currentShares) => currentShares.filter((share) => share.id !== shareId));
      toast.success('Đã thu hồi liên kết');
    } catch (error) {
      toast.error('Không thể thu hồi liên kết');
    }
  };

  const copyToClipboard = async (url: string, id: string, showFailureToast = true) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      setCopiedId(id);
      toast.success('Đã sao chép liên kết');
      setTimeout(() => setCopiedId(null), 2000);
    } catch (error) {
      if (showFailureToast) {
        toast.error('Không thể sao chép liên kết');
      } else {
        toast.warning('Đã tạo liên kết, nhưng không thể sao chép tự động');
      }
    }
  };

  const formatDate = (dateString: string) => {
    return formatDateTimeForDisplay(dateString, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Chia sẻ lên web</DialogTitle>
          <DialogDescription>
            Công khai công việc này trên web. Bất kỳ ai có liên kết đều có thể xem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4 min-w-0">
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="expiry">Liên kết hết hạn sau</Label>
              <div className="flex gap-2">
                <Select value={expiryDays} onValueChange={setExpiryDays}>
                  <SelectTrigger id="expiry" className="w-[180px] h-9 border-none bg-[var(--primary)]/5 hover:bg-[var(--primary)]/10 text-[var(--foreground)] transition-all duration-200">
                    <SelectValue placeholder="Chọn thời hạn" />
                  </SelectTrigger>
                  <SelectContent className='bg-[var(--card)]'>
                    <SelectItem value="1">1 ngày</SelectItem>
                    <SelectItem value="3">3 ngày</SelectItem>
                    <SelectItem value="7">7 ngày</SelectItem>
                    <SelectItem value="14">14 ngày</SelectItem>
                    <SelectItem value="30">30 ngày</SelectItem>
                  </SelectContent>
                </Select>
                <ActionButton
                  onClick={handleCreateShare}
                  disabled={creating}
                  className="flex-1"
                  secondary
                >
                  {creating ? 'Đang tạo...' : 'Tạo liên kết công khai'}
                </ActionButton>
              </div>
            </div>
          </div>

          {shares.length > 0 && (
            <div className="space-y-3">
              <Label>Liên kết đang hoạt động ({shares.length})</Label>
              <ScrollArea className="h-[200px] w-full rounded-md border p-3" orientation='both'>
                <div className="space-y-3">
                  {shares.map((share) => (
                    <div
                      key={share.id}
                      className="flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-sm min-w-0"
                    >
                      <div className="flex items-center justify-between min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant={isExpired(share.expiresAt) ? "destructive" : "secondary"}>
                            {isExpired(share.expiresAt) ? 'Đã hết hạn' : 'Đang hoạt động'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            Hết hạn {formatDate(share.expiresAt)}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive hover:bg-destructive/10"
                          onClick={() => handleRevokeShare(share.id)}
                          title="Thu hồi liên kết"
                        >
                          <HiTrash className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="flex items-center gap-2 rounded-md bg-muted p-2">
                        <HiLink className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs font-mono text-muted-foreground w-full">
                            {share.shareUrl}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 flex-shrink-0"
                          onClick={() => void copyToClipboard(share.shareUrl, share.id)}
                        >
                          {copiedId === share.id ? (
                            <HiCheck className="h-4 w-4 text-green-500" />
                          ) : (
                            <HiClipboard className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter>
          <ActionButton secondary onClick={onClose}>
            Xong
          </ActionButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
