import { useState, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Upload, X, FileText, AlertCircle, CheckCircle2 } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import ActionButton from "@/components/common/ActionButton";
import { useWorkspaceContext } from "@/contexts/workspace-context";
import { useProjectContext } from "@/contexts/project-context";
import { getCurrentOrganizationId } from "@/utils/hierarchyContext";
import { formatDateForApi } from "@/utils/handleDateChange";
import { taskApi } from "@/utils/api/taskApi";

interface CsvImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImportComplete?: () => Promise<void>;
    workspaceId?: string;
    workspaceName?: string;
    projectId?: string;
    projectName?: string;
    projectSlug?: string;
}

interface ParsedTask {
    title: string;
    description?: string;
    priority?: string;
    type?: string;
    dueDate?: string;
}

const VALID_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "HIGHEST"];
const VALID_TYPES = ["TASK", "BUG", "STORY", "EPIC"];

function parseCsvLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return { headers: [], rows: [] };

    const headers = parseCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
    const rows = lines.slice(1).map((line) => parseCsvLine(line));
    return { headers, rows };
}

function mapRowToTask(headers: string[], row: string[]): ParsedTask | null {
    const get = (key: string) => {
        const idx = headers.indexOf(key);
        return idx >= 0 && idx < row.length ? row[idx].trim() : "";
    };

    const title = get("title") || get("name") || get("task") || get("summary");
    if (!title) return null;

    const rawPriority = (get("priority") || "MEDIUM").toUpperCase();
    const priority = VALID_PRIORITIES.includes(rawPriority) ? rawPriority : "MEDIUM";

    const rawType = (get("type") || "TASK").toUpperCase();
    const type = VALID_TYPES.includes(rawType) ? rawType : "TASK";

    const dueDate = get("duedate") || get("due_date") || get("due date") || "";

    return {
        title,
        description: get("description") || undefined,
        priority,
        type,
        dueDate: dueDate || undefined,
    };
}

export function CsvImportModal({
    isOpen,
    onClose,
    onImportComplete,
    workspaceId: prefilledWorkspaceId,
    workspaceName: prefilledWorkspaceName,
    projectId: prefilledProjectId,
    projectName: prefilledProjectName,
    projectSlug: prefilledProjectSlug,
}: CsvImportModalProps) {
    const { t } = useTranslation("tasks");
    const { getWorkspacesByOrganization } = useWorkspaceContext();
    const { getProjectsByWorkspace, getTaskStatusByProject } = useProjectContext();

    const fileInputRef = useRef<HTMLInputElement>(null);

    // Context state
    const [workspaces, setWorkspaces] = useState<any[]>([]);
    const [projects, setProjects] = useState<any[]>([]);
    const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(prefilledWorkspaceId || "");
    const [selectedProjectId, setSelectedProjectId] = useState(prefilledProjectId || "");
    const [loadingWorkspaces, setLoadingWorkspaces] = useState(false);
    const [loadingProjects, setLoadingProjects] = useState(false);



    // File state
    const [file, setFile] = useState<File | null>(null);
    const [parsedTasks, setParsedTasks] = useState<ParsedTask[]>([]);
    const [parseError, setParseError] = useState<string | null>(null);

    // Import state
    const [isImporting, setIsImporting] = useState(false);
    const [importProgress, setImportProgress] = useState({ done: 0, total: 0, failed: 0 });
    const [importDone, setImportDone] = useState(false);

    const needsWorkspace = !prefilledWorkspaceId;
    const needsProject = !prefilledProjectId;

    // Load workspaces if needed
    useEffect(() => {
        if (!isOpen || !needsWorkspace) return;
        const orgId = getCurrentOrganizationId();
        if (!orgId) return;

        setLoadingWorkspaces(true);
        getWorkspacesByOrganization(orgId)
            .then((data) => setWorkspaces(data || []))
            .catch(() => setWorkspaces([]))
            .finally(() => setLoadingWorkspaces(false));
    }, [isOpen, needsWorkspace]);

    // Load projects when workspace selected
    useEffect(() => {
        const wsId = prefilledWorkspaceId || selectedWorkspaceId;
        if (!isOpen || !wsId || !needsProject) return;

        setLoadingProjects(true);
        getProjectsByWorkspace(wsId)
            .then((data) => setProjects(data || []))
            .catch(() => setProjects([]))
            .finally(() => setLoadingProjects(false));
    }, [isOpen, selectedWorkspaceId, prefilledWorkspaceId, needsProject]);



    // Reset on open
    useEffect(() => {
        if (isOpen) {
            setFile(null);
            setParsedTasks([]);
            setParseError(null);
            setIsImporting(false);
            setImportDone(false);
            setImportProgress({ done: 0, total: 0, failed: 0 });
            if (!prefilledWorkspaceId) setSelectedWorkspaceId("");
            if (!prefilledProjectId) setSelectedProjectId("");
        }
    }, [isOpen]);

    const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const selected = e.target.files?.[0];
        if (!selected) return;

        if (!selected.name.endsWith(".csv")) {
            setParseError("Vui lòng chọn tệp CSV");
            return;
        }

        setFile(selected);
        setParseError(null);
        setParsedTasks([]);

        const reader = new FileReader();
        reader.onload = (ev) => {
            try {
                const text = ev.target?.result as string;
                const { headers, rows } = parseCsv(text);

                if (!headers.includes("title") && !headers.includes("name") && !headers.includes("task") && !headers.includes("summary")) {
                    setParseError("CSV cần có cột 'title' (hoặc 'name', 'task', 'summary')");
                    return;
                }

                const tasks = rows
                    .map((row) => mapRowToTask(headers, row))
                    .filter(Boolean) as ParsedTask[];

                if (tasks.length === 0) {
                    setParseError("Không tìm thấy công việc hợp lệ trong CSV");
                    return;
                }

                setParsedTasks(tasks);
            } catch {
                setParseError("Không thể đọc tệp CSV");
            }
        };
        reader.readAsText(selected);
    }, []);

    const handleImport = useCallback(async () => {
        const projectId = prefilledProjectId || selectedProjectId;
        if (!projectId || parsedTasks.length === 0) return;

        setIsImporting(true);
        setImportProgress({ done: 0, total: parsedTasks.length, failed: 0 });

        let statuses: any[] = [];
        try {
            statuses = await getTaskStatusByProject(projectId);
        } catch {
            toast.error("Không thể tải trạng thái công việc");
            setIsImporting(false);
            return;
        }

        const defaultStatus =
            statuses.find((s: any) => s.isDefault) || statuses[0];

        if (!defaultStatus) {
            toast.error("Không tìm thấy trạng thái công việc cho dự án này");
            setIsImporting(false);
            return;
        }

        // Format tasks for bulk API
        const bulkTasks = parsedTasks.map((task) => {
            let formattedDueDate: string | undefined = undefined;
            if (task.dueDate) {
                const parsed = new Date(task.dueDate);
                if (!isNaN(parsed.getTime())) {
                    formattedDueDate = formatDateForApi(parsed.toISOString().split('T')[0]) ?? undefined;
                }
            }
            return {
                title: task.title,
                description: task.description || "",
                priority: task.priority || "MEDIUM",
                type: task.type || "TASK",
                dueDate: formattedDueDate,
            };
        });

        try {
            const result = await taskApi.bulkCreateTasks({
                projectId,
                statusId: defaultStatus.id,
                tasks: bulkTasks,
            });

            setImportProgress({ done: result.created, total: parsedTasks.length, failed: result.failed });
            setImportDone(true);

            if (result.failed === 0) {
                toast.success(`Created ${result.created} tasks successfully`);
            } else {
                toast.warning(`Created ${result.created} tasks, ${result.failed} failed`);
            }

            if (onImportComplete) {
                try {
                    await onImportComplete();
                } catch { }
            }
        } catch (err) {
            toast.error("Không thể nhập công việc");
        } finally {
            setIsImporting(false);
        }
    }, [parsedTasks, selectedProjectId, prefilledProjectId, getTaskStatusByProject, onImportComplete]);

    const activeProjectId = prefilledProjectId || selectedProjectId;
    const canImport = parsedTasks.length > 0 && activeProjectId && !isImporting && !importDone;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent className="projects-modal-container border-none max-w-lg">
                <DialogHeader className="projects-modal-header">
                    <div className="projects-modal-header-content">
                        <div className="projects-modal-icon bg-[var(--primary)]">
                            <Upload className="projects-modal-icon-content w-5 h-5" />
                        </div>
                        <div className="projects-modal-info">
                            <DialogTitle className="projects-modal-title">Nhập công việc từ CSV</DialogTitle>
                            <DialogDescription className="projects-modal-description">
                                Tải lên tệp CSV để tạo nhiều công việc
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="projects-modal-form space-y-4">
                    {/* Workspace selector (only if not pre-filled) */}
                    {needsWorkspace && (
                        <div className="projects-form-field">
                            <Label className="projects-form-label text-sm font-medium">
                                Không gian làm việc <span className="projects-form-label-required">*</span>
                            </Label>
                            <select
                                value={selectedWorkspaceId}
                                onChange={(e) => {
                                    setSelectedWorkspaceId(e.target.value);
                                    setSelectedProjectId("");
                                }}
                                disabled={loadingWorkspaces || isImporting}
                                className="w-full h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                            >
                                <option value="">{loadingWorkspaces ? "Đang tải..." : "Chọn không gian làm việc"}</option>
                                {workspaces.map((ws) => (
                                    <option key={ws.id} value={ws.id}>{ws.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Project selector (only if not pre-filled) */}
                    {needsProject && (
                        <div className="projects-form-field">
                            <Label className="projects-form-label text-sm font-medium">
                                Dự án <span className="projects-form-label-required">*</span>
                            </Label>
                            <select
                                value={selectedProjectId}
                                onChange={(e) => setSelectedProjectId(e.target.value)}
                                disabled={loadingProjects || isImporting || (!prefilledWorkspaceId && !selectedWorkspaceId)}
                                className="w-full h-10 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 text-sm"
                            >
                                <option value="">
                                    {loadingProjects
                                        ? "Đang tải..."
                                        : !prefilledWorkspaceId && !selectedWorkspaceId
                                            ? "Chọn không gian làm việc trước"
                                            : "Chọn dự án"}
                                </option>
                                {projects.map((p) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}



                    {/* Show pre-filled context */}
                    {prefilledWorkspaceName && (
                        <div className="text-sm text-[var(--muted-foreground)]">
                            Không gian làm việc: <span className="font-medium text-[var(--foreground)]">{prefilledWorkspaceName}</span>
                        </div>
                    )}
                    {prefilledProjectName && (
                        <div className="text-sm text-[var(--muted-foreground)]">
                            Dự án: <span className="font-medium text-[var(--foreground)]">{prefilledProjectName}</span>
                        </div>
                    )}


                    {/* File upload */}
                    <div className="projects-form-field">
                        <Label className="projects-form-label text-sm font-medium">Tệp CSV</Label>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="hidden"
                            disabled={isImporting}
                        />
                        <div
                            onClick={() => !isImporting && fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${file
                                ? "border-green-400 bg-green-50 dark:bg-green-900/10"
                                : "border-[var(--border)] hover:border-[var(--primary)] hover:bg-[var(--accent)]"
                                } ${isImporting ? "opacity-50 cursor-not-allowed" : ""}`}
                        >
                            {file ? (
                                <div className="flex items-center justify-center gap-2 text-sm">
                                    <FileText className="w-5 h-5 text-green-600 dark:text-green-400" />
                                    <span className="font-medium">{file.name}</span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setFile(null);
                                            setParsedTasks([]);
                                            setParseError(null);
                                            setImportDone(false);
                                            if (fileInputRef.current) fileInputRef.current.value = "";
                                        }}
                                        className="ml-2 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    <Upload className="w-8 h-8 mx-auto text-[var(--muted-foreground)]" />
                                    <p className="text-sm text-[var(--muted-foreground)]">Nhấn để tải tệp CSV lên</p>
                                    <p className="text-xs text-[var(--muted-foreground)]">
                                        Cột bắt buộc: title. Không bắt buộc: description, priority, type, dueDate
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Parse error */}
                    {parseError && (
                        <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                            <AlertCircle className="w-4 h-4" />
                            {parseError}
                        </div>
                    )}

                    {/* Preview */}
                    {parsedTasks.length > 0 && !importDone && (
                        <div className="space-y-2">
                            <p className="text-sm font-medium">
                                Tìm thấy {parsedTasks.length} công việc để nhập:
                            </p>
                            <div className="overflow-hidden border border-[var(--border)] rounded-md">
                                <table className="w-full text-xs table-fixed">
                                    <thead className="bg-[var(--accent)] sticky top-0">
                                        <tr>
                                            <th className="text-left p-2 font-medium w-8">#</th>
                                            <th className="text-left p-2 font-medium w-1/4">Tiêu đề</th>
                                            <th className="text-left p-2 font-medium w-1/4">Mô tả</th>
                                            <th className="text-left p-2 font-medium w-1/6">Độ ưu tiên</th>
                                            <th className="text-left p-2 font-medium w-1/6">Loại</th>
                                            <th className="text-left p-2 font-medium w-1/6">Hạn hoàn thành</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {parsedTasks.slice(0, 5).map((task, i) => (
                                            <tr key={i} className="border-t border-[var(--border)]">
                                                <td className="p-2 text-[var(--muted-foreground)]">{i + 1}</td>
                                                <td className="p-2">
                                                    <div className="truncate" title={task.title}>{task.title}</div>
                                                </td>
                                                <td className="p-2">
                                                    <div className="truncate" title={task.description}>{task.description || "-"}</div>
                                                </td>
                                                <td className="p-2">{task.priority || "MEDIUM"}</td>
                                                <td className="p-2">{task.type || "TASK"}</td>
                                                <td className="p-2 truncate">{task.dueDate || "-"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {parsedTasks.length > 5 && (
                                <p className="text-xs text-[var(--muted-foreground)] text-right">
                                    Đang hiển thị 5 công việc đầu trong tổng số {parsedTasks.length}
                                </p>
                            )}
                        </div>
                    )}

                    {/* Progress */}
                    {isImporting && (
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span>Đang nhập công việc...</span>
                                <span>{importProgress.done}/{importProgress.total}</span>
                            </div>
                            <div className="w-full bg-[var(--accent)] rounded-full h-2">
                                <div
                                    className="bg-[var(--primary)] h-2 rounded-full transition-all"
                                    style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                                />
                            </div>
                            {importProgress.failed > 0 && (
                                <p className="text-xs text-red-500">{importProgress.failed} failed</p>
                            )}
                        </div>
                    )}

                    {/* Done state */}
                    {importDone && (
                        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                            <CheckCircle2 className="w-4 h-4" />
                            Nhập hoàn tất! Đã tạo {importProgress.done - importProgress.failed} công việc.
                            {importProgress.failed > 0 && ` (${importProgress.failed} failed)`}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex justify-end gap-3 pt-2">
                        <ActionButton onClick={onClose} disabled={isImporting}>
                            {importDone ? "Đóng" : "Hủy"}
                        </ActionButton>
                        {!importDone && (
                            <ActionButton
                                primary
                                onClick={handleImport}
                                disabled={!canImport}
                            >
                                {isImporting ? "Đang nhập..." : `Nhập ${parsedTasks.length > 0 ? parsedTasks.length : ""} công việc`}
                            </ActionButton>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
