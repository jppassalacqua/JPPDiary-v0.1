
import React, { useState, useRef, useEffect } from 'react';
import { 
  Bold, 
  Italic, 
  Strikethrough,
  Highlighter,
  List, 
  ListOrdered,
  Heading1, 
  Heading2, 
  Heading3,
  Heading4,
  Heading5,
  Heading6,
  Quote, 
  Code, 
  SquareCode,
  Eye, 
  PenLine, 
  Link as LinkIcon,
  Image as ImageIcon,
  CheckSquare,
  Minus,
  Table,
  Network,
  Superscript,
  Subscript,
  FileSymlink
} from 'lucide-react';
import { markdownService } from '../services/markdown';
import { useTranslation } from '../services/translations';
import { EntryPicker } from './EntryPicker';
import { DiaryEntry } from '../types';
import { SpeechInput } from './SpeechInput';

interface RichTextEditorProps {
  initialValue: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

declare global {
    interface Window {
        mermaid: any;
    }
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ initialValue, onChange, placeholder }) => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'write' | 'preview'>('write');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showEntryPicker, setShowEntryPicker] = useState(false);
  
  // Internal state to manage input immediately
  const [value, setValue] = useState(initialValue);

  // Sync external changes (e.g. loaded drafts)
  useEffect(() => {
    if (initialValue !== value) {
        setValue(initialValue);
    }
  }, [initialValue]);

  // Mermaid Initialization Effect
  useEffect(() => {
    if (activeTab === 'preview' && window.mermaid) {
        window.mermaid.initialize({ startOnLoad: false, theme: 'default' });
        // Small timeout to ensure DOM is ready
        setTimeout(() => {
            window.mermaid.run({
                querySelector: '.mermaid'
            });
        }, 100);
    }
  }, [activeTab, value]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setValue(val);
    onChange(val);
  };

  const insertSyntax = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = textareaRef.current.value;
    
    const before = text.substring(0, start);
    const selection = text.substring(start, end);
    const after = text.substring(end);
    
    const newText = before + prefix + selection + suffix + after;
    
    setValue(newText);
    onChange(newText);
    
    // Defer focus and cursor placement
    setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.focus();
            const newCursorPos = start + prefix.length + selection.length + suffix.length;
            // If nothing selected, place cursor inside tags
            const cursorPos = selection.length === 0 ? start + prefix.length : newCursorPos;
            textareaRef.current.setSelectionRange(cursorPos, cursorPos);
        }
    }, 0);
  };

  const insertBlock = (prefix: string) => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const text = textareaRef.current.value;
    
    // Check if we need a newline before
    const isStartOfLine = start === 0 || text[start - 1] === '\n';
    const insertion = isStartOfLine ? prefix : `\n${prefix}`;
    
    insertSyntax(insertion);
  };

  const insertTemplate = (template: string) => {
     if (!textareaRef.current) return;
     // Add newlines around templates
     insertSyntax(`\n${template}\n`);
  };

  const handleEntrySelect = (entry: DiaryEntry) => {
      const dateStr = new Date(entry.timestamp).toLocaleDateString();
      const label = `${dateStr} - ${entry.analysis.summary.substring(0, 20)}...`;
      insertSyntax(`[${label}](entry:${entry.id})`);
      setShowEntryPicker(false);
  };

  const handleSpeechResult = (text: string) => {
      insertSyntax(text + ' ');
  };

  const ToolbarButton = ({ icon: Icon, onClick, title, label }: any) => (
    <button
      onClick={onClick}
      className="p-2 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors flex items-center justify-center"
      title={title}
      type="button"
    >
      <Icon size={16} />
      {label && <span className="ml-1 text-xs font-bold">{label}</span>}
    </button>
  );

  return (
    <div className="flex flex-col h-full rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 shadow-sm transition-all relative">
      
      {showEntryPicker && (
          <EntryPicker onSelect={handleEntrySelect} onClose={() => setShowEntryPicker(false)} />
      )}

      {/* Header / Tabs / Toolbar */}
      <div className="flex flex-col border-b border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/80 backdrop-blur-sm">
        
        {/* Tabs Row */}
        <div className="flex justify-between items-center px-4 py-2 border-b border-slate-200/50 dark:border-slate-800/50">
             <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-1">
                <button
                    onClick={() => setActiveTab('write')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'write' 
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    <PenLine size={14} /> Write
                </button>
                <button
                    onClick={() => setActiveTab('preview')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === 'preview' 
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                    <Eye size={14} /> Preview
                </button>
            </div>
            <div className="text-xs text-slate-400 font-medium hidden sm:block">
                <a 
                  href="https://www.markdownlang.com/fr/cheatsheet/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline transition-colors"
                >
                  Markdown Supported
                </a>
            </div>
        </div>

        {/* Toolbar (Only visible in Write mode) */}
        {activeTab === 'write' && (
          <div className="flex flex-wrap items-center gap-1 px-2 py-2 overflow-x-auto custom-scrollbar">
             {/* Text Style */}
             <div className="flex items-center gap-0.5 border-r border-slate-300 dark:border-slate-700 pr-2 mr-1">
                <ToolbarButton icon={Bold} onClick={() => insertSyntax('**', '**')} title={t('tool_bold')} />
                <ToolbarButton icon={Italic} onClick={() => insertSyntax('_', '_')} title={t('tool_italic')} />
                <ToolbarButton icon={Strikethrough} onClick={() => insertSyntax('~~', '~~')} title={t('tool_strikethrough')} />
                <ToolbarButton icon={Highlighter} onClick={() => insertSyntax('==', '==')} title={t('tool_highlight')} />
                <ToolbarButton icon={Superscript} onClick={() => insertSyntax('^', '^')} title="Superscript" />
                <ToolbarButton icon={Subscript} onClick={() => insertSyntax('~', '~')} title="Subscript" />
             </div>
             
             {/* Headers */}
             <div className="flex items-center gap-0.5 border-r border-slate-300 dark:border-slate-700 pr-2 mr-1">
                <ToolbarButton icon={Heading1} onClick={() => insertBlock('# ')} title="H1" />
                <ToolbarButton icon={Heading2} onClick={() => insertBlock('## ')} title="H2" />
                <ToolbarButton icon={Heading3} onClick={() => insertBlock('### ')} title="H3" />
             </div>

             {/* Lists */}
             <div className="flex items-center gap-0.5 border-r border-slate-300 dark:border-slate-700 pr-2 mr-1">
                <ToolbarButton icon={List} onClick={() => insertBlock('- ')} title="Bullet List" />
                <ToolbarButton icon={ListOrdered} onClick={() => insertBlock('1. ')} title="Ordered List" />
                <ToolbarButton icon={CheckSquare} onClick={() => insertBlock('- [ ] ')} title="Task List" />
             </div>

             {/* Code & Quote */}
             <div className="flex items-center gap-0.5 border-r border-slate-300 dark:border-slate-700 pr-2 mr-1">
                <ToolbarButton icon={Code} onClick={() => insertSyntax('`', '`')} title={t('tool_code')} />
                <ToolbarButton icon={SquareCode} onClick={() => insertSyntax('```\n', '\n```')} title={t('tool_codeblock')} />
                <ToolbarButton icon={Quote} onClick={() => insertBlock('> ')} title={t('tool_quote')} />
             </div>

             {/* Extended (Table, Mermaid, Link, Image) */}
             <div className="flex items-center gap-0.5 border-r border-slate-300 dark:border-slate-700 pr-2 mr-1">
                <ToolbarButton icon={LinkIcon} onClick={() => insertSyntax('[', '](url)')} title={t('tool_link')} />
                <ToolbarButton icon={FileSymlink} onClick={() => setShowEntryPicker(true)} title={t('tool_link_entry')} />
                <ToolbarButton icon={ImageIcon} onClick={() => insertSyntax('![Alt text](', ')')} title={t('tool_image')} />
                <ToolbarButton icon={Table} onClick={() => insertTemplate('| Head | Head |\n|---|---|\n| Cell | Cell |')} title={t('tool_table')} />
                <ToolbarButton icon={Network} onClick={() => insertTemplate('```mermaid\ngraph TD;\n    A-->B;\n    A-->C;\n```')} title={t('tool_mermaid')} />
                <ToolbarButton icon={Minus} onClick={() => insertBlock('---')} title={t('tool_hr')} />
             </div>

             {/* STT */}
             <div className="flex items-center gap-0.5 pl-1">
                 <SpeechInput onSpeechResult={handleSpeechResult} className="hover:bg-slate-200 dark:hover:bg-slate-700" />
             </div>
          </div>
        )}
      </div>
      
      {/* Editor Content */}
      <div className="flex-1 relative bg-white dark:bg-slate-950">
        {activeTab === 'write' ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            className="w-full h-full p-6 bg-transparent text-slate-800 dark:text-slate-200 resize-none focus:outline-none font-mono text-sm leading-relaxed custom-scrollbar"
            spellCheck={false}
          />
        ) : (
          <div 
            className="w-full h-full p-6 overflow-y-auto custom-scrollbar prose dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: markdownService.render(value) }}
          />
        )}
      </div>
    </div>
  );
};
