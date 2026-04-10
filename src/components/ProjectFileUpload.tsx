'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image as ImageIcon, File, Trash2 } from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
export interface ProjectAttachment {
  id: string;
  project_id: string;
  milestone_id: string | null;
  file_name: string;
  file_url: string;
  storage_path: string | null;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  created_at: string;
}

interface PendingFile {
  file: File;
  preview?: string; // data URL for images
}

// ─── Pending File List (for modals — before project/milestone exists) ──
export function PendingFileList({
  files,
  onRemove,
}: {
  files: PendingFile[];
  onRemove: (index: number) => void;
}) {
  if (files.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mt-2">
      {files.map((pf, i) => (
        <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px]"
          style={{ background: '#f3f4f6', border: '1px solid #e5e7eb' }}>
          {pf.preview ? (
            <img src={pf.preview} alt="" className="w-5 h-5 rounded object-cover" />
          ) : (
            <FileText size={12} style={{ color: '#6b7280' }} />
          )}
          <span className="truncate max-w-[120px]" style={{ color: '#374151' }}>{pf.file.name}</span>
          <span style={{ color: '#9ca3af' }}>({formatSize(pf.file.size)})</span>
          <button onClick={() => onRemove(i)} className="ml-0.5 p-0.5 rounded hover:bg-red-50"
            style={{ color: '#ef4444' }}>
            <X size={10} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── File Drop Zone (for modals) ──────────────────────────────
export function FileDropZone({
  files,
  setFiles,
  accept = 'image/*,.pdf,.doc,.docx,.xls,.xlsx',
  maxFiles = 5,
}: {
  files: PendingFile[];
  setFiles: (files: PendingFile[]) => void;
  accept?: string;
  maxFiles?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const arr = Array.from(newFiles);
    const remaining = maxFiles - files.length;
    const toAdd = arr.slice(0, remaining);

    const pending: PendingFile[] = toAdd.map(file => {
      const isImage = file.type.startsWith('image/');
      return {
        file,
        preview: isImage ? URL.createObjectURL(file) : undefined,
      };
    });
    setFiles([...files, ...pending]);
  }, [files, setFiles, maxFiles]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
  };

  return (
    <div>
      <div
        className="relative rounded-xl p-3 text-center cursor-pointer transition-all"
        style={{
          border: `2px dashed ${dragOver ? '#6366f1' : '#d1d5db'}`,
          background: dragOver ? '#eef2ff' : '#fafafa',
        }}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <Upload size={18} className="mx-auto mb-1" style={{ color: dragOver ? '#6366f1' : '#9ca3af' }} />
        <p className="text-[11px]" style={{ color: '#6b7280' }}>
          ลากไฟล์มาวาง หรือ <span style={{ color: '#6366f1', fontWeight: 600 }}>เลือกไฟล์</span>
        </p>
        <p className="text-[10px] mt-0.5" style={{ color: '#9ca3af' }}>
          รูปภาพ, PDF, Word, Excel (สูงสุด {maxFiles} ไฟล์, ไม่เกิน 20MB/ไฟล์)
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple
          className="hidden"
          onChange={e => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      <PendingFileList
        files={files}
        onRemove={i => {
          const next = [...files];
          if (next[i].preview) URL.revokeObjectURL(next[i].preview!);
          next.splice(i, 1);
          setFiles(next);
        }}
      />
    </div>
  );
}

// ─── Upload pending files to API ────────────────────────────
export async function uploadPendingFiles(
  projectId: string,
  milestoneId: string | null,
  files: PendingFile[],
  uploadedBy: string
): Promise<ProjectAttachment[]> {
  const results: ProjectAttachment[] = [];

  for (const pf of files) {
    const formData = new FormData();
    formData.append('file', pf.file);
    if (milestoneId) formData.append('milestoneId', milestoneId);
    formData.append('uploadedBy', uploadedBy);

    const res = await fetch(`/api/projects/${projectId}/attachments`, {
      method: 'POST',
      body: formData,
    });

    if (res.ok) {
      const data = await res.json();
      if (data.attachment) results.push(data.attachment);
    }

    // Revoke preview URL
    if (pf.preview) URL.revokeObjectURL(pf.preview);
  }

  return results;
}

// ─── Uploaded Attachment List (for detail page) ───────────────
export function AttachmentList({
  attachments,
  onDelete,
  canDelete = true,
}: {
  attachments: ProjectAttachment[];
  onDelete?: (id: string) => void;
  canDelete?: boolean;
}) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {attachments.map(att => {
        const isImage = att.file_type === 'image';
        return (
          <div key={att.id} className="group relative rounded-lg overflow-hidden transition-all"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
            {isImage ? (
              <a href={att.file_url} target="_blank" rel="noopener noreferrer" className="block">
                <img src={att.file_url} alt={att.file_name}
                  className="w-20 h-20 object-cover" loading="lazy" />
              </a>
            ) : (
              <a href={att.file_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 hover:opacity-80">
                {getFileIcon(att.file_type)}
                <div className="min-w-0">
                  <div className="text-[11px] font-medium truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>
                    {att.file_name}
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--muted)' }}>
                    {formatSize(att.file_size)}
                  </div>
                </div>
              </a>
            )}
            {canDelete && onDelete && (
              <button
                onClick={() => {
                  if (confirm(`ลบไฟล์ "${att.file_name}" ใช่ไหม?`)) onDelete(att.id);
                }}
                className="absolute top-1 right-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: 'rgba(0,0,0,0.6)' }}>
                <Trash2 size={10} color="#fff" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Inline Uploader (for project detail / milestone row) ─────
export function InlineUploader({
  projectId,
  milestoneId,
  uploadedBy,
  onUploaded,
}: {
  projectId: string;
  milestoneId?: string;
  uploadedBy: string;
  onUploaded: (att: ProjectAttachment) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (fileList: FileList) => {
    setUploading(true);
    for (const file of Array.from(fileList)) {
      const formData = new FormData();
      formData.append('file', file);
      if (milestoneId) formData.append('milestoneId', milestoneId);
      formData.append('uploadedBy', uploadedBy);

      const res = await fetch(`/api/projects/${projectId}/attachments`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        if (data.attachment) onUploaded(data.attachment);
      }
    }
    setUploading(false);
  };

  return (
    <div className="inline-flex">
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium transition-all hover:opacity-80"
        style={{ background: '#f3f4f6', color: uploading ? '#9ca3af' : '#6366f1', border: '1px solid #e5e7eb' }}
      >
        <Upload size={11} />
        {uploading ? 'กำลังอัปโหลด...' : 'แนบไฟล์'}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files && e.target.files.length > 0) handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileType: string) {
  switch (fileType) {
    case 'image': return <ImageIcon size={16} style={{ color: '#6366f1' }} />;
    case 'pdf': return <FileText size={16} style={{ color: '#ef4444' }} />;
    case 'excel': return <File size={16} style={{ color: '#22c55e' }} />;
    case 'word': return <FileText size={16} style={{ color: '#3b82f6' }} />;
    default: return <File size={16} style={{ color: '#9ca3af' }} />;
  }
}
