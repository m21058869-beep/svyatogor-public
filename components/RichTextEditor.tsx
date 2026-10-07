'use client';
import { useState, useRef, useEffect } from 'react';
import { Bold, Italic, List, ListOrdered, Link as LinkIcon } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const caretTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Проп value приходит из состояния родителя и обновляется асинхронно. В
  // обработчиках кнопок нужен самый свежий текст: иначе два быстрых клика подряд
  // («жирный» + «курсив») выполнялись по устаревшему значению и теряли правку.
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(
    () => () => {
      if (caretTimerRef.current) clearTimeout(caretTimerRef.current);
    },
    [],
  );

  const insertFormatting = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const current = valueRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = current.substring(start, end);
    const beforeText = current.substring(0, start);
    const afterText = current.substring(end);

    const newText = beforeText + before + selectedText + after + afterText;
    valueRef.current = newText;
    onChange(newText);

    // Возврат каретки — после того, как React применит новое значение.
    if (caretTimerRef.current) clearTimeout(caretTimerRef.current);
    caretTimerRef.current = setTimeout(() => {
      caretTimerRef.current = null;
      const field = textareaRef.current;
      if (!field) return;
      field.focus();
      field.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const handleBold = () => insertFormatting('**', '**');
  const handleItalic = () => insertFormatting('*', '*');
  const handleBulletList = () => {
    const lines = valueRef.current.split('\n');
    const start = textareaRef.current?.selectionStart || 0;
    let currentLine = 0;
    let charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= start) {
        currentLine = i;
        break;
      }
      charCount += lines[i].length + 1;
    }

    if (lines[currentLine].trim().startsWith('- ')) {
      lines[currentLine] = lines[currentLine].replace(/^(\s*)- /, '$1');
    } else {
      lines[currentLine] = '- ' + lines[currentLine];
    }

    onChange(lines.join('\n'));
  };

  const handleNumberedList = () => {
    const lines = valueRef.current.split('\n');
    const start = textareaRef.current?.selectionStart || 0;
    let currentLine = 0;
    let charCount = 0;

    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= start) {
        currentLine = i;
        break;
      }
      charCount += lines[i].length + 1;
    }

    if (lines[currentLine].trim().match(/^\d+\. /)) {
      lines[currentLine] = lines[currentLine].replace(/^(\s*)\d+\. /, '$1');
    } else {
      lines[currentLine] = '1. ' + lines[currentLine];
    }

    onChange(lines.join('\n'));
  };

  const handleLink = () => {
    setShowLinkDialog(true);
  };

  const insertLink = () => {
    if (linkUrl) {
      const linkMarkdown = linkText ? `[${linkText}](${linkUrl})` : linkUrl;
      insertFormatting(linkMarkdown);
    }
    setShowLinkDialog(false);
    setLinkUrl('');
    setLinkText('');
  };

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="bg-gray-50 border-b border-gray-300 p-2 flex gap-1">
        <button
          type="button"
          onClick={handleBold}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Жирный (Ctrl+B)"
        >
          <Bold size={18} />
        </button>
        <button
          type="button"
          onClick={handleItalic}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Курсив (Ctrl+I)"
        >
          <Italic size={18} />
        </button>
        <div className="w-px bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={handleBulletList}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Маркированный список"
        >
          <List size={18} />
        </button>
        <button
          type="button"
          onClick={handleNumberedList}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Нумерованный список"
        >
          <ListOrdered size={18} />
        </button>
        <div className="w-px bg-gray-300 mx-1" />
        <button
          type="button"
          onClick={handleLink}
          className="p-2 hover:bg-gray-200 rounded transition-colors"
          title="Вставить ссылку"
        >
          <LinkIcon size={18} />
        </button>
      </div>

      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={12}
        className="w-full px-4 py-3 focus:ring-0 focus:outline-none resize-none"
      />

      {showLinkDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Вставить ссылку</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  URL
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="https://example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Текст ссылки (необязательно)
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={(e) => setLinkText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="Текст ссылки"
                />
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => {
                    setShowLinkDialog(false);
                    setLinkUrl('');
                    setLinkText('');
                  }}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Отмена
                </button>
                <button
                  onClick={insertLink}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Вставить
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
