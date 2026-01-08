import { useState, useEffect, useRef } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import type * as monaco from 'monaco-editor';

interface MonacoViewProps {
  originalCode?: string;
  modifiedCode?: string;
  originalFilename?: string;
  modifiedFilename?: string;
  theme?: 'light' | 'dark';
  editableRight?: boolean;
  onSave?: (path: string, content: string) => void;
  onNoteAdded?: (note: {
    file: string;
    line: number;
    lineContent: string;
    noteText: string;
    formattedNote: string;
  }) => void;
}

type SaveState = 'idle' | 'modified' | 'saving' | 'saved';

export function MonacoView({
  originalCode = '',
  modifiedCode = '',
  originalFilename: _originalFilename = 'original',
  modifiedFilename = 'modified',
  theme = 'light',
  editableRight = true,
  onSave,
  onNoteAdded,
}: MonacoViewProps) {
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedContent, setLastSavedContent] = useState(modifiedCode);
  const [showNoteBox, setShowNoteBox] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteBoxPosition, setNoteBoxPosition] = useState({ top: 0, left: 0 });
  const [clickedLine, setClickedLine] = useState<{ line: number; lineContent: string } | null>(null);

  const editorRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);
  const modifiedModelRef = useRef<monaco.editor.ITextModel | null>(null);
  const modifiedDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null);
  const visibleGlyphsRef = useRef<Set<string>>(new Set());

  const getLanguageForFile = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      json: 'json',
      html: 'html',
      css: 'css',
      scss: 'scss',
      md: 'markdown',
      py: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      cpp: 'cpp',
      c: 'c',
      sh: 'shell',
      yaml: 'yaml',
      yml: 'yaml',
      xml: 'xml',
      sql: 'sql',
    };
    return langMap[ext] || 'plaintext';
  };

  const requestSave = () => {
    if (!editableRight || saveState !== 'modified') return;

    setSaveState('saving');
    const modifiedContent = modifiedModelRef.current?.getValue() || '';

    if (onSave) {
      onSave(modifiedFilename, modifiedContent);
    }
  };

  const clearAllVisibleGlyphs = () => {
    try {
      visibleGlyphsRef.current.forEach((glyphId) => {
        const element = document.querySelector(`.${glyphId}`);
        if (element) {
          element.classList.remove('hover-visible');
        }
      });
      visibleGlyphsRef.current.clear();
    } catch (error) {
      console.error('Error clearing visible glyphs:', error);
    }
  };

  const toggleGlyphVisibility = (lineNumber: number, visible: boolean) => {
    try {
      if (visible) {
        clearAllVisibleGlyphs();
      }

      const glyphId = `comment-glyph-modified-${lineNumber}`;
      const element = document.querySelector(`.${glyphId}`);

      if (element) {
        if (visible) {
          element.classList.add('hover-visible');
          visibleGlyphsRef.current.add(glyphId);
        } else {
          element.classList.remove('hover-visible');
          visibleGlyphsRef.current.delete(glyphId);
        }
      }
    } catch (error) {
      console.error('Error toggling glyph visibility:', error);
    }
  };

  const showNoteBoxForLine = (lineNumber: number, lineContent: string, editor: monaco.editor.IStandaloneDiffEditor) => {
    const modifiedEditor = editor.getModifiedEditor();
    if (!modifiedEditor) return;

    const lineTop = modifiedEditor.getTopForLineNumber(lineNumber);
    const scrollTop = modifiedEditor.getScrollTop();
    const containerRect = modifiedEditor.getDomNode()?.getBoundingClientRect();

    if (containerRect) {
      const lineScreenTop = containerRect.top + lineTop - scrollTop;

      setNoteBoxPosition({
        top: Math.max(lineScreenTop, containerRect.top + 50),
        left: containerRect.left + containerRect.width - 550,
      });
    }

    setClickedLine({ line: lineNumber, lineContent });
    setNoteText('');
    setShowNoteBox(true);
  };

  const closeNoteBox = () => {
    setShowNoteBox(false);
    setNoteText('');
    setClickedLine(null);
  };

  const submitNote = () => {
    if (!clickedLine || !noteText.trim()) {
      return;
    }

    const formattedNote = `@${modifiedFilename}:${clickedLine.line}\n\`\`\`\n${clickedLine.lineContent}\n\`\`\`\n${noteText.trim()}`;

    if (onNoteAdded) {
      onNoteAdded({
        file: modifiedFilename,
        line: clickedLine.line,
        lineContent: clickedLine.lineContent,
        noteText: noteText.trim(),
        formattedNote,
      });
    }

    closeNoteBox();
  };

  const initializeGlyphDecorations = (monaco: any, editor: monaco.editor.IStandaloneDiffEditor, modifiedModel: monaco.editor.ITextModel) => {
    const modifiedEditor = editor.getModifiedEditor();
    if (!modifiedEditor || !modifiedDecorationsRef.current) return;

    const lineCount = modifiedModel.getLineCount();
    const decorations: monaco.editor.IModelDeltaDecoration[] = [];

    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
      decorations.push({
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        options: {
          isWholeLine: false,
          glyphMarginClassName: `comment-glyph-decoration comment-glyph-modified-${lineNumber}`,
          stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
        },
      });
    }

    modifiedDecorationsRef.current.set(decorations);
  };

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneDiffEditor, monaco: any) => {
    editorRef.current = editor;

    const modifiedEditor = editor.getModifiedEditor();
    const originalEditor = editor.getOriginalEditor();
    const modifiedModel = modifiedEditor.getModel();

    if (modifiedModel) {
      modifiedModelRef.current = modifiedModel;
      setLastSavedContent(modifiedModel.getValue());
    }

    const editorOptions = {
      lineNumbers: 'on' as const,
      glyphMargin: true,
      folding: true,
      scrollBeyondLastLine: false,
      minimap: { enabled: false },
      fontSize: 14,
      renderWhitespace: 'selection' as const,
    };

    if (originalEditor) {
      originalEditor.updateOptions({
        ...editorOptions,
        readOnly: true,
      });
    }

    if (modifiedEditor) {
      modifiedEditor.updateOptions({
        ...editorOptions,
        readOnly: !editableRight,
      });

      // Setup keyboard shortcuts
      modifiedEditor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
        () => {
          requestSave();
        }
      );

      // Setup content change listener
      if (modifiedModel && editableRight) {
        modifiedModel.onDidChangeContent(() => {
          const currentContent = modifiedModel.getValue();
          if (currentContent !== lastSavedContent) {
            setSaveState('modified');
          }
        });
      }

      // Setup line click listener
      let currentHoveredLine: number | null = null;

      modifiedEditor.onMouseMove((e) => {
        if (e.target.position) {
          const lineNumber = e.target.position.lineNumber;

          if (currentHoveredLine !== lineNumber) {
            if (currentHoveredLine !== null) {
              toggleGlyphVisibility(currentHoveredLine, false);
            }

            toggleGlyphVisibility(lineNumber, true);
            currentHoveredLine = lineNumber;
          }
        }
      });

      modifiedEditor.onMouseLeave(() => {
        if (currentHoveredLine !== null) {
          toggleGlyphVisibility(currentHoveredLine, false);
          currentHoveredLine = null;
        }
      });

      modifiedEditor.onMouseDown((e) => {
        if (e.target.type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
          const lineNumber = e.target.position?.lineNumber;
          if (lineNumber && modifiedModel) {
            const lineContent = modifiedModel.getLineContent(lineNumber) || '';

            e.event.preventDefault();
            e.event.stopPropagation();

            showNoteBoxForLine(lineNumber, lineContent, editor);
          }
        }
      });

      // Initialize glyph decorations
      if (modifiedModel) {
        modifiedDecorationsRef.current = modifiedEditor.createDecorationsCollection([]);
        initializeGlyphDecorations(monaco, editor, modifiedModel);
      }
    }
  };

  // Update decorations when code or filename changes
  useEffect(() => {
    if (editorRef.current) {
      const modifiedEditor = editorRef.current.getModifiedEditor();
      const modifiedModel = modifiedEditor?.getModel();

      if (modifiedModel && modifiedEditor) {
        // Update ref to new model
        modifiedModelRef.current = modifiedModel;

        // Create fresh decorations collection for the new model
        // This ensures we don't hold references to disposed models
        modifiedDecorationsRef.current = modifiedEditor.createDecorationsCollection([]);

        const monaco = (window as any).monaco;
        if (monaco) {
          initializeGlyphDecorations(monaco, editorRef.current, modifiedModel);
        }
      }
    }
  }, [originalCode, modifiedCode, _originalFilename, modifiedFilename]);

  const language = getLanguageForFile(modifiedFilename);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      {saveState !== 'idle' && (
        <div className={`save-indicator ${saveState}`}>
          {saveState === 'modified' ? 'Modified' : saveState === 'saving' ? 'Saving...' : 'Saved'}
        </div>
      )}

      <DiffEditor
        original={originalCode}
        modified={modifiedCode}
        language={language}
        originalModelPath={_originalFilename ? `file:///${_originalFilename}` : undefined}
        modifiedModelPath={modifiedFilename ? `file:///${modifiedFilename}` : undefined}
        keepCurrentOriginalModel={true}
        keepCurrentModifiedModel={true}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        onMount={handleEditorDidMount}
        options={{
          automaticLayout: true,
          renderSideBySide: true,
          ignoreTrimWhitespace: false,
          diffAlgorithm: 'advanced',
          glyphMargin: true,
          renderOverviewRuler: true,
          scrollBeyondLastLine: true,
          minimap: { enabled: false },
          readOnly: !editableRight,
        }}
      />

      {showNoteBox && clickedLine && (
        <div
          className="note-box"
          style={{ top: `${noteBoxPosition.top}px`, left: `${noteBoxPosition.left}px` }}
        >
          <div className="note-box-header">
            <h3 className="note-box-title">Add note</h3>
            <button className="note-box-close" onClick={closeNoteBox}>×</button>
          </div>
          <div className="note-line-preview">{clickedLine.lineContent}</div>
          <textarea
            className="note-textarea"
            placeholder="Type your note here... (Press Enter to save, Shift+Enter for new line)"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (noteText.trim()) {
                  submitNote();
                }
              }
            }}
            autoFocus
          />
          <div className="note-box-actions">
            <button className="note-btn note-btn-secondary" onClick={closeNoteBox}>
              Cancel
            </button>
            <button className="note-btn note-btn-primary" onClick={submitNote}>
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
