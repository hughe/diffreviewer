import { html, css } from 'lit';
import { DiffReviewerElement } from './diffreviewer-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import type * as monaco from 'monaco-editor';

// Monaco is loaded dynamically
declare global {
  interface Window {
    monaco?: typeof monaco;
  }
}

let monacoLoadPromise: Promise<any> | null = null;

function loadMonaco(): Promise<typeof monaco> {
  if (monacoLoadPromise) {
    return monacoLoadPromise;
  }

  if (window.monaco) {
    return Promise.resolve(window.monaco);
  }

  monacoLoadPromise = import('monaco-editor').then((monaco) => {
    window.monaco = monaco;
    return monaco;
  });

  return monacoLoadPromise;
}

@customElement('monaco-view')
export class MonacoView extends DiffReviewerElement {
  @property({ type: Boolean, attribute: 'editable-right' })
  editableRight = true;

  @property() originalCode?: string = '';
  @property() modifiedCode?: string = '';
  @property() originalFilename?: string = 'original';
  @property() modifiedFilename?: string = 'modified';
  @property() theme: 'light' | 'dark' = 'light';

  @state() private saveState: 'idle' | 'modified' | 'saving' | 'saved' = 'idle';
  @state() private lastSavedContent: string = '';
  @state() private showNoteBox: boolean = false;
  @state() private noteText: string = '';
  @state() private noteBoxPosition: { top: number; left: number } = { top: 0, left: 0 };
  @state() private clickedLine: { line: number; lineContent: string } | null = null;

  private container: Ref<HTMLElement> = createRef();
  private editor?: monaco.editor.IStandaloneDiffEditor;
  private originalModel?: monaco.editor.ITextModel;
  private modifiedModel?: monaco.editor.ITextModel;
  private modifiedDecorations?: monaco.editor.IEditorDecorationsCollection;
  private visibleGlyphs: Set<string> = new Set();

  static styles = css`
    :host {
      display: block;
      width: 100%;
      height: 100%;
      position: relative;
    }

    .monaco-container {
      width: 100%;
      height: 100%;
    }

    .save-indicator {
      position: absolute;
      top: 8px;
      right: 8px;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      z-index: 1000;
      pointer-events: none;
    }

    .save-indicator.modified {
      background: #fef3c7;
      color: #92400e;
    }

    .save-indicator.saving {
      background: #dbeafe;
      color: #1e40af;
    }

    .save-indicator.saved {
      background: #d1fae5;
      color: #065f46;
    }

    .comment-glyph-decoration {
      width: 16px !important;
      height: 18px !important;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .comment-glyph-decoration:before {
      content: '💬';
      font-size: 12px;
      line-height: 18px;
      width: 16px;
      height: 18px;
      display: block;
      text-align: center;
    }

    .comment-glyph-decoration.hover-visible {
      opacity: 1;
    }

    .note-box {
      position: fixed;
      background: white;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      padding: 0.75rem;
      z-index: 10001;
      width: 500px;
      max-height: 80vh;
      overflow-y: auto;
    }

    .note-box-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .note-box-title {
      margin: 0;
      font-size: 0.875rem;
      font-weight: 600;
      color: #111827;
    }

    .note-box-close {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 1.25rem;
      color: #6b7280;
      padding: 0;
      width: 1.5rem;
      height: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .note-box-close:hover {
      color: #111827;
    }

    .note-line-preview {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 0.25rem;
      padding: 0.5rem;
      margin-bottom: 0.5rem;
      font-family: monospace;
      font-size: 0.75rem;
      overflow-x: auto;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .note-textarea {
      width: 100%;
      min-height: 80px;
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
      resize: vertical;
      font-family: inherit;
      font-size: 0.875rem;
      margin-bottom: 0.5rem;
    }

    .note-textarea:focus {
      outline: none;
      border-color: #3b82f6;
      ring: 2px;
      ring-color: rgba(59, 130, 246, 0.5);
    }

    .note-box-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }

    .note-btn {
      padding: 0.375rem 0.75rem;
      border-radius: 0.25rem;
      cursor: pointer;
      font-size: 0.75rem;
      font-weight: 500;
      border: none;
    }

    .note-btn-primary {
      background: #2563eb;
      color: white;
    }

    .note-btn-primary:hover {
      background: #1d4ed8;
    }

    .note-btn-secondary {
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .note-btn-secondary:hover {
      background: #f3f4f6;
    }
  `;

  private getLanguageForFile(filename: string): string {
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
  }

  private requestSave() {
    if (!this.editableRight || this.saveState !== 'modified') return;

    this.saveState = 'saving';
    const modifiedContent = this.modifiedModel?.getValue() || '';

    const saveEvent = new CustomEvent('monaco-save', {
      detail: {
        path: this.modifiedFilename,
        content: modifiedContent,
      },
      bubbles: true,
      composed: true,
    });

    this.dispatchEvent(saveEvent);
  }

  public notifySaveComplete(success: boolean) {
    if (success) {
      this.saveState = 'saved';
      this.lastSavedContent = this.modifiedModel?.getValue() || '';
      setTimeout(() => {
        this.saveState = 'idle';
      }, 2000);
    } else {
      this.saveState = 'modified';
    }
  }

  private setupKeyboardShortcuts() {
    if (!this.editor) return;

    const modifiedEditor = this.editor.getModifiedEditor();
    if (!modifiedEditor) return;

    modifiedEditor.addCommand(
      window.monaco!.KeyMod.CtrlCmd | window.monaco!.KeyCode.KeyS,
      () => {
        this.requestSave();
      }
    );
  }

  private setupContentChangeListener() {
    if (!this.modifiedModel || !this.editableRight) return;

    this.modifiedModel.onDidChangeContent(() => {
      const currentContent = this.modifiedModel?.getValue() || '';
      if (currentContent !== this.lastSavedContent) {
        this.saveState = 'modified';
      }
    });
  }

  private setupLineClickListener() {
    if (!this.editor) return;

    const modifiedEditor = this.editor.getModifiedEditor();
    if (!modifiedEditor) return;

    // Track the currently hovered line for this editor
    let currentHoveredLine: number | null = null;

    // Listen for mouse movement to show/hide speech bubble on hover
    modifiedEditor.onMouseMove((e) => {
      if (e.target.position) {
        const lineNumber = e.target.position.lineNumber;

        // If we're hovering over a different line, update visibility
        if (currentHoveredLine !== lineNumber) {
          // Hide previous line's glyph
          if (currentHoveredLine !== null) {
            this.toggleGlyphVisibility(currentHoveredLine, false);
          }

          // Show current line's glyph
          this.toggleGlyphVisibility(lineNumber, true);
          currentHoveredLine = lineNumber;
        }
      }
    });

    // Listen for mouse leaving the editor to clear hover state
    modifiedEditor.onMouseLeave(() => {
      if (currentHoveredLine !== null) {
        this.toggleGlyphVisibility(currentHoveredLine, false);
        currentHoveredLine = null;
      }
    });

    // Listen for mouse clicks on glyph margin (like Sketch does)
    modifiedEditor.onMouseDown((e) => {
      if (e.target.type === window.monaco!.editor.MouseTargetType.GUTTER_GLYPH_MARGIN) {
        const lineNumber = e.target.position?.lineNumber;
        if (lineNumber) {
          const lineContent = this.modifiedModel?.getLineContent(lineNumber) || '';
          
          // Prevent default Monaco behavior
          e.event.preventDefault();
          e.event.stopPropagation();
          
          // Show the inline note box
          this.showNoteBoxForLine(lineNumber, lineContent);
        }
      }
    });
  }

  private showNoteBoxForLine(lineNumber: number, lineContent: string) {
    if (!this.editor) return;

    const modifiedEditor = this.editor.getModifiedEditor();
    if (!modifiedEditor) return;

    // Get the position of the line in the editor
    const lineTop = modifiedEditor.getTopForLineNumber(lineNumber);
    const scrollTop = modifiedEditor.getScrollTop();
    const containerRect = this.container.value?.getBoundingClientRect();
    
    if (containerRect) {
      // Calculate the actual screen position of the line
      const lineScreenTop = containerRect.top + lineTop - scrollTop;
      
      // Position the box to the right of the editor, aligned with the line
      // Add some offset to avoid covering the line
      this.noteBoxPosition = {
        top: Math.max(lineScreenTop, containerRect.top + 50), // Don't go above the container
        left: containerRect.left + containerRect.width - 550, // Position near right edge
      };
    }

    this.clickedLine = { line: lineNumber, lineContent };
    this.noteText = '';
    this.showNoteBox = true;
    this.requestUpdate();
    
    // Focus the textarea after render
    setTimeout(() => {
      const textarea = this.renderRoot.querySelector('.note-textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.focus();
      }
    }, 0);
  }

  private closeNoteBox() {
    this.showNoteBox = false;
    this.noteText = '';
    this.clickedLine = null;
    this.requestUpdate();
  }

  private handleNoteInput(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    this.noteText = target.value;
    this.requestUpdate();
  }

  private handleNoteKeyDown(e: KeyboardEvent) {
    // Save on Enter (but allow Shift+Enter for new lines)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (this.noteText.trim()) {
        this.submitNote();
      }
    }
  }

  private submitNote() {
    if (!this.clickedLine || !this.noteText.trim()) {
      return;
    }

    // Format the note similar to Sketch
    const formattedNote = `@${this.modifiedFilename}:${this.clickedLine.line}\n\`\`\`\n${this.clickedLine.lineContent}\n\`\`\`\n${this.noteText.trim()}`;

    console.log('Submitting note:', formattedNote);

    // Dispatch event to add note to general notes BEFORE closing note box
    // (to ensure clickedLine is still available)
    const event = new CustomEvent('note-added', {
      detail: {
        file: this.modifiedFilename,
        line: this.clickedLine.line,
        lineContent: this.clickedLine.lineContent,
        noteText: this.noteText.trim(),
        formattedNote,
      },
      bubbles: true,
      composed: true,
    });

    console.log('About to dispatch event:', event);
    this.dispatchEvent(event);
    console.log('Event dispatched successfully');

    // Close the note box AFTER dispatching
    this.closeNoteBox();
  }

  /**
   * Initialize glyph decorations for all lines in the modified editor
   */
  private initializeGlyphDecorations() {
    const monaco = window.monaco;
    if (!this.editor || !monaco || !this.modifiedModel) return;

    const modifiedEditor = this.editor.getModifiedEditor();
    if (!modifiedEditor || !this.modifiedDecorations) return;

    // Create decorations for every line
    const lineCount = this.modifiedModel.getLineCount();
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

    this.modifiedDecorations.set(decorations);
  }

  /**
   * Clear all visible glyphs
   */
  private clearAllVisibleGlyphs() {
    try {
      this.visibleGlyphs.forEach((glyphId) => {
        const element = this.container.value?.querySelector(`.${glyphId}`);
        if (element) {
          element.classList.remove('hover-visible');
        }
      });
      this.visibleGlyphs.clear();
    } catch (error) {
      console.error('Error clearing visible glyphs:', error);
    }
  }

  /**
   * Toggle the visibility of a glyph decoration for a specific line
   */
  private toggleGlyphVisibility(lineNumber: number, visible: boolean) {
    try {
      // If making visible, clear all existing visible glyphs first
      if (visible) {
        this.clearAllVisibleGlyphs();
      }

      // Find the glyph decoration for this line in the modified editor
      const glyphId = `comment-glyph-modified-${lineNumber}`;
      const element = this.container.value?.querySelector(`.${glyphId}`);

      if (element) {
        if (visible) {
          element.classList.add('hover-visible');
          this.visibleGlyphs.add(glyphId);
        } else {
          element.classList.remove('hover-visible');
          this.visibleGlyphs.delete(glyphId);
        }
      }
    } catch (error) {
      console.error('Error toggling glyph visibility:', error);
    }
  }

  private async initializeEditor() {
    const monaco = await loadMonaco();
    if (!this.container.value || this.editor) return;

    const originalLang = this.getLanguageForFile(this.originalFilename || '');
    const modifiedLang = this.getLanguageForFile(this.modifiedFilename || '');

    // Create models with unique URIs based on timestamp to avoid conflicts
    const timestamp = new Date().getTime();
    const originalUri = monaco.Uri.parse(
      `file:///original-${timestamp}.${originalLang}`
    );
    const modifiedUri = monaco.Uri.parse(
      `file:///modified-${timestamp}.${modifiedLang}`
    );

    this.originalModel = monaco.editor.createModel(
      this.originalCode || '',
      originalLang,
      originalUri
    );
    this.modifiedModel = monaco.editor.createModel(
      this.modifiedCode || '',
      modifiedLang,
      modifiedUri
    );

    this.lastSavedContent = this.modifiedCode || '';

    this.editor = monaco.editor.createDiffEditor(this.container.value, {
      automaticLayout: true,
      renderSideBySide: true,
      theme: this.theme === 'dark' ? 'vs-dark' : 'vs',
      ignoreTrimWhitespace: false,
      diffAlgorithm: 'advanced',
      experimental: { showMoves: true },
      glyphMargin: true,
      renderOverviewRuler: true,
      scrollBeyondLastLine: true,
      minimap: { enabled: false },
      hideUnchangedRegions: {
        enabled: true,
        contextLineCount: 5,
        minimumLineCount: 3,
        revealLineCount: 10,
      },
    });

    this.editor.setModel({
      original: this.originalModel,
      modified: this.modifiedModel,
    });

    // Configure both editors explicitly
    const modifiedEditor = this.editor.getModifiedEditor();
    const originalEditor = this.editor.getOriginalEditor();
    
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
        readOnly: !this.editableRight,
      });

      this.modifiedDecorations =
        modifiedEditor.createDecorationsCollection([]);
    }

    this.setupKeyboardShortcuts();
    this.setupContentChangeListener();
    this.setupLineClickListener();
    this.initializeGlyphDecorations();
  }

  private updateModels() {
    if (!this.originalModel || !this.modifiedModel) return;

    const language = this.getLanguageForFile(this.modifiedFilename || '');
    const monaco = window.monaco;
    if (!monaco) return;

    monaco.editor.setModelLanguage(this.originalModel, language);
    monaco.editor.setModelLanguage(this.modifiedModel, language);

    this.originalModel.setValue(this.originalCode || '');
    this.modifiedModel.setValue(this.modifiedCode || '');
    this.lastSavedContent = this.modifiedCode || '';
    this.saveState = 'idle';
    
    // Reinitialize glyph decorations after model update
    this.initializeGlyphDecorations();
  }

  async updated(changedProperties: Map<string, any>) {
    if (
      changedProperties.has('originalCode') ||
      changedProperties.has('modifiedCode') ||
      changedProperties.has('originalFilename') ||
      changedProperties.has('modifiedFilename')
    ) {
      this.updateModels();
    }

    if (changedProperties.has('theme')) {
      if (this.editor && window.monaco) {
        const monaco = window.monaco;
        if (monaco) {
          monaco.editor.setTheme(
            this.theme === 'dark' ? 'vs-dark' : 'vs'
          );
        }
      }
    }
  }

  async firstUpdated() {
    await this.initializeEditor();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.editor?.dispose();
    this.originalModel?.dispose();
    this.modifiedModel?.dispose();
  }

  render() {
    return html`
      ${this.saveState !== 'idle'
        ? html`
            <div class="save-indicator ${this.saveState}">
              ${this.saveState === 'modified'
                ? 'Modified'
                : this.saveState === 'saving'
                  ? 'Saving...'
                  : 'Saved'}
            </div>
          `
        : ''}
      <div class="monaco-container" ${ref(this.container)}></div>
      ${this.showNoteBox && this.clickedLine
        ? html`
            <div
              class="note-box"
              style="top: ${this.noteBoxPosition.top}px; left: ${this.noteBoxPosition.left}px;"
            >
              <div class="note-box-header">
                <h3 class="note-box-title">Add note</h3>
                <button class="note-box-close" @click=${this.closeNoteBox}>×</button>
              </div>
              <div class="note-line-preview">${this.clickedLine.lineContent}</div>
              <textarea
                class="note-textarea"
                placeholder="Type your note here... (Press Enter to save, Shift+Enter for new line)"
                .value=${this.noteText}
                @input=${this.handleNoteInput}
                @keydown=${this.handleNoteKeyDown}
                autofocus
              ></textarea>
              <div class="note-box-actions">
                <button class="note-btn note-btn-secondary" @click=${this.closeNoteBox}>
                  Cancel
                </button>
                <button class="note-btn note-btn-primary" @click=${this.submitNote}>
                  Add
                </button>
              </div>
            </div>
          `
        : ''}
    `;
  }
}
