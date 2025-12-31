import { html, css } from 'lit';
import { DiffReviewerElement } from './diffreviewer-element.js';
import { customElement, property, state } from 'lit/decorators.js';
import { addNote, deleteNote } from '../services/notes';
import type { Note } from '../types';

@customElement('notes-panel')
export class NotesPanel extends DiffReviewerElement {
  @property({ type: Array }) notes: Note[] = [];
  @property({ type: Object }) pendingNote: { file: string; line: number; lineContent: string } | null = null;
  
  @state() private newNoteText: string = '';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      overflow: hidden;
    }

    .header {
      padding: 1rem;
      border-bottom: 1px solid #e5e7eb;
      background: white;
    }

    .title {
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
    }

    .notes-list {
      flex: 1;
      overflow-y: auto;
      padding: 1rem;
    }

    .note-group {
      margin-bottom: 1.5rem;
    }

    .file-name {
      font-size: 0.875rem;
      font-weight: 600;
      color: #374151;
      margin-bottom: 0.5rem;
    }

    .note-item {
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.375rem;
      padding: 0.75rem;
      margin-bottom: 0.5rem;
    }

    .note-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }

    .line-number {
      font-size: 0.75rem;
      color: #6b7280;
      font-family: monospace;
    }

    .note-actions {
      display: flex;
      gap: 0.25rem;
    }

    .action-btn {
      padding: 0.25rem 0.5rem;
      background: transparent;
      border: none;
      border-radius: 0.25rem;
      cursor: pointer;
      font-size: 0.75rem;
      color: #6b7280;
    }

    .action-btn:hover {
      background: #f3f4f6;
      color: #111827;
    }

    .delete-btn:hover {
      color: #dc2626;
    }

    .line-content {
      font-size: 0.75rem;
      font-family: monospace;
      background: #f9fafb;
      padding: 0.5rem;
      border-radius: 0.25rem;
      margin-bottom: 0.5rem;
      color: #374151;
      overflow-x: auto;
    }

    .note-text {
      font-size: 0.875rem;
      color: #111827;
      white-space: pre-wrap;
    }

    .empty-state {
      text-align: center;
      padding: 2rem;
      color: #9ca3af;
      font-size: 0.875rem;
    }

    .new-note-form {
      padding: 1rem;
      border-bottom: 2px solid #3b82f6;
      background: #eff6ff;
    }

    .new-note-header {
      font-size: 0.875rem;
      font-weight: 600;
      color: #1e40af;
      margin-bottom: 0.5rem;
    }

    .new-note-line {
      font-size: 0.75rem;
      font-family: monospace;
      background: white;
      padding: 0.5rem;
      border-radius: 0.25rem;
      margin-bottom: 0.5rem;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .new-note-input {
      width: 100%;
      min-height: 80px;
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.25rem;
      font-size: 0.875rem;
      resize: vertical;
      font-family: inherit;
    }

    .new-note-input:focus {
      outline: none;
      border-color: #3b82f6;
      ring: 2px;
      ring-color: #3b82f6;
    }

    .new-note-actions {
      display: flex;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .btn {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 0.25rem;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    .btn-primary:disabled {
      background: #9ca3af;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: white;
      color: #374151;
      border: 1px solid #d1d5db;
    }

    .btn-secondary:hover {
      background: #f3f4f6;
    }
  `;

  private async handleDelete(note: Note) {
    if (!confirm(`Delete note for ${note.file}:${note.line}?`)) {
      return;
    }

    try {
      await deleteNote(note.file, note.line);
      this.dispatchEvent(
        new CustomEvent('notes-update', {
          bubbles: true,
          composed: true,
        })
      );
    } catch (err) {
      alert('Failed to delete note: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  private async handleSaveNewNote() {
    if (!this.pendingNote || !this.newNoteText.trim()) {
      return;
    }

    try {
      await addNote(
        this.pendingNote.file,
        this.pendingNote.line,
        this.pendingNote.lineContent,
        this.newNoteText.trim()
      );
      
      this.newNoteText = '';
      this.dispatchEvent(
        new CustomEvent('note-created', {
          bubbles: true,
          composed: true,
        })
      );
    } catch (err) {
      alert('Failed to save note: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  private handleCancelNewNote() {
    this.newNoteText = '';
    this.dispatchEvent(
      new CustomEvent('note-created', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleNoteTextChange(e: Event) {
    const target = e.target as HTMLTextAreaElement;
    this.newNoteText = target.value;
  }

  private groupNotesByFile(): Map<string, Note[]> {
    const grouped = new Map<string, Note[]>();
    for (const note of this.notes) {
      if (!grouped.has(note.file)) {
        grouped.set(note.file, []);
      }
      grouped.get(note.file)!.push(note);
    }
    return grouped;
  }

  render() {
    const groupedNotes = this.groupNotesByFile();

    return html`
      <div class="header">
        <div class="title">Notes (${this.notes.length})</div>
      </div>
      ${this.pendingNote
        ? html`
            <div class="new-note-form">
              <div class="new-note-header">
                New note for ${this.pendingNote.file}:${this.pendingNote.line}
              </div>
              <div class="new-note-line">${this.pendingNote.lineContent}</div>
              <textarea
                class="new-note-input"
                placeholder="Enter your note here..."
                .value=${this.newNoteText}
                @input=${this.handleNoteTextChange}
                autofocus
              ></textarea>
              <div class="new-note-actions">
                <button
                  class="btn btn-primary"
                  @click=${this.handleSaveNewNote}
                  ?disabled=${!this.newNoteText.trim()}
                >
                  Save Note
                </button>
                <button class="btn btn-secondary" @click=${this.handleCancelNewNote}>
                  Cancel
                </button>
              </div>
            </div>
          `
        : ''}
      ${this.notes.length === 0 && !this.pendingNote
        ? html`
            <div class="empty-state">
              No notes yet. Click on the glyph margin (left of line numbers) in
              the diff to add a note.
            </div>
          `
        : html`
            <div class="notes-list">
        ${Array.from(groupedNotes.entries()).map(
          ([file, notes]) => html`
            <div class="note-group">
              <div class="file-name">${file}</div>
              ${notes.map(
                (note) => html`
                  <div class="note-item">
                    <div class="note-header">
                      <span class="line-number">Line ${note.line}</span>
                      <div class="note-actions">
                        <button
                          class="action-btn delete-btn"
                          @click=${() => this.handleDelete(note)}
                          title="Delete note"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                    ${note.lineContent
                      ? html`
                          <div class="line-content">${note.lineContent}</div>
                        `
                      : ''}
                    <div class="note-text">${note.text}</div>
                  </div>
                `
              )}
            </div>
          `
        )}
            </div>
          `}
    `;
  }
}
