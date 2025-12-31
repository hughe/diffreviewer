import { html, css } from 'lit';
import { DiffReviewerElement } from './diffreviewer-element.js';
import { customElement, state } from 'lit/decorators.js';
import { fetchNotes, updateGeneralNotes } from '../services/notes';
import { shutdown } from '../services/api';
import './diff-viewer';
import './general-notes-input';
import './done-button';
import './range-picker';
import type { DiffRange } from './range-picker';

@customElement('app-shell')
export class AppShell extends DiffReviewerElement {
  @state() private generalNotes: string = '';
  @state() private currentRange: DiffRange | null = null;

  static styles = css`
    /* No custom styles needed - using Tailwind classes */
  `;

  async connectedCallback() {
    super.connectedCallback();
    await this.loadGeneralNotes();
  }

  private async loadGeneralNotes() {
    try {
      const notesResponse = await fetchNotes();
      this.generalNotes = notesResponse.generalNotes;
    } catch (err) {
      console.error('Error loading notes:', err);
    }
  }

  private async handleNoteAdded(e: CustomEvent) {
    // When a note is added from monaco-view, append it to general notes
    const { formattedNote } = e.detail;
    console.log('Note added:', formattedNote);
    
    // Append to general notes with a newline separator
    if (this.generalNotes.trim()) {
      this.generalNotes += '\n\n' + formattedNote;
    } else {
      this.generalNotes = formattedNote;
    }
    
    this.requestUpdate();
    
    // Manually update the general-notes-input component
    const notesInput = this.querySelector('general-notes-input') as any;
    if (notesInput) {
      notesInput.value = this.generalNotes;
      notesInput.requestUpdate();
    }
    
    // Save to backend immediately
    try {
      await updateGeneralNotes(this.generalNotes);
    } catch (err) {
      console.error('Error saving note to backend:', err);
    }
  }

  private handleRangeChange(e: CustomEvent) {
    this.currentRange = e.detail.range;
    console.log('Range changed:', this.currentRange);
    
    // Call loadDiffForRange directly instead of relying on property binding
    // This works around Lit reactivity issues when Shadow DOM is disabled
    const diffViewer = this.querySelector('diff-viewer') as any;
    if (diffViewer && diffViewer.loadDiffForRange) {
      diffViewer.loadDiffForRange(this.currentRange);
    }
  }

  private async handleGeneralNotesChange(e: CustomEvent) {
    this.generalNotes = e.detail.text;
    try {
      await updateGeneralNotes(this.generalNotes);
    } catch (err) {
      console.error('Error saving general notes:', err);
    }
  }

  private async handleDone() {
    if (!confirm('Save notes and exit DiffReviewer?')) {
      return;
    }

    try {
      // Save general notes to server before shutdown
      await updateGeneralNotes(this.generalNotes);
      await shutdown(this.generalNotes);

      // Try to close the window immediately
      window.close();

      // If we reach here, window.close() didn't work (window is still open)
      // Show a message instructing the user to close manually
      setTimeout(() => {
        if (!window.closed) {
          document.body.innerHTML =
            '<div style="display: flex; align-items: center; justify-content: center; height: 100vh; font-size: 1.5rem; color: #6b7280; text-align: center; flex-direction: column; gap: 1rem;">' +
            '<div>✓ Notes saved successfully!</div>' +
            '<div style="font-size: 1.2rem;">Please close this window.</div>' +
            '</div>';
        }
      }, 100);
    } catch (err) {
      alert('Error during shutdown: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  }

  render() {
    return html`
      <div class="flex items-center justify-between p-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div class="text-2xl font-semibold text-gray-900">DiffReviewer</div>
      </div>
      <div class="flex flex-1 overflow-hidden">
        <div class="flex-1 flex flex-col overflow-hidden">
          <range-picker @range-change=${this.handleRangeChange}></range-picker>
          <diff-viewer
            .currentRange=${this.currentRange}
            @note-added=${this.handleNoteAdded}
          ></diff-viewer>
          <div class="border-t border-gray-200 bg-white flex-shrink-0 flex justify-center items-stretch p-8 gap-4">
            <general-notes-input
              class="flex-1 max-w-[1000px]"
              .value=${this.generalNotes}
              @notes-change=${this.handleGeneralNotesChange}
            ></general-notes-input>
            <done-button @done=${this.handleDone}></done-button>
          </div>
        </div>
      </div>
    `;
  }
}
