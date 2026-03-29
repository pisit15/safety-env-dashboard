'use client';

import { useRef, useCallback, useEffect } from 'react';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  readOnly?: boolean;
}

export default function RichTextEditor({ value, onChange, placeholder, readOnly }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const isInternalChange = useRef(false);

  // Sync value prop to editor (only when value changes externally)
  useEffect(() => {
    if (editorRef.current && !isInternalChange.current) {
      if (editorRef.current.innerHTML !== value) {
        editorRef.current.innerHTML = value || '';
      }
    }
    isInternalChange.current = false;
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isInternalChange.current = true;
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const execCmd = (cmd: string, val?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, val);
    handleInput();
  };

  const handleBold = () => execCmd('bold');
  const handleItalic = () => execCmd('italic');
  const handleUnderline = () => execCmd('underline');

  const handleLink = () => {
    const url = prompt('วาง URL ลิงก์:');
    if (url) {
      execCmd('createLink', url);
    }
  };

  const handleImage = () => {
    const url = prompt('วาง URL รูปภาพ:');
    if (url) {
      execCmd('insertImage', url);
      // Make inserted images responsive
      if (editorRef.current) {
        const imgs = editorRef.current.querySelectorAll('img');
        imgs.forEach(img => {
          img.style.maxWidth = '100%';
          img.style.height = 'auto';
          img.style.borderRadius = '6px';
          img.style.marginTop = '4px';
        });
        handleInput();
      }
    }
  };

  if (readOnly) {
    return (
      <div
        className="text-sm px-3 py-2 rounded-lg"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          minHeight: '60px',
        }}
        dangerouslySetInnerHTML={{ __html: value || '<em style="color:var(--text-muted)">ไม่มีหมายเหตุ</em>' }}
      />
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 mb-1 px-1">
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); handleBold(); }}
          className="px-2 py-1 rounded text-xs font-bold hover:opacity-80 transition-opacity"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          title="ตัวหนา"
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); handleItalic(); }}
          className="px-2 py-1 rounded text-xs italic hover:opacity-80 transition-opacity"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          title="ตัวเอียง"
        >
          I
        </button>
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); handleUnderline(); }}
          className="px-2 py-1 rounded text-xs underline hover:opacity-80 transition-opacity"
          style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}
          title="ขีดเส้นใต้"
        >
          U
        </button>
        <div style={{ width: 1, height: 16, background: 'var(--border)' }} className="mx-1" />
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); handleLink(); }}
          className="px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity"
          style={{ background: 'var(--bg-secondary)', color: 'var(--accent)', border: '1px solid var(--border)' }}
          title="แทรกลิงก์"
        >
          🔗
        </button>
        <button
          type="button"
          onMouseDown={e => { e.preventDefault(); handleImage(); }}
          className="px-2 py-1 rounded text-xs hover:opacity-80 transition-opacity"
          style={{ background: 'var(--bg-secondary)', color: 'var(--accent)', border: '1px solid var(--border)' }}
          title="แทรกรูปภาพ (URL)"
        >
          🖼️
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
        style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          minHeight: '70px',
          maxHeight: '150px',
          overflowY: 'auto',
          lineHeight: '1.5',
        }}
        data-placeholder={placeholder}
        suppressContentEditableWarning
      />

      <style>{`
        [contenteditable]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-muted);
          pointer-events: none;
        }
        [contenteditable] img {
          max-width: 100%;
          height: auto;
          border-radius: 6px;
          margin-top: 4px;
        }
        [contenteditable] a {
          color: var(--accent);
          text-decoration: underline;
        }
      `}</style>
    </div>
  );
}
