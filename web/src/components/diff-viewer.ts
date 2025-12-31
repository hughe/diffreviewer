import { html, css } from 'lit';
import { DiffReviewerElement } from './diffreviewer-element.js';
import { customElement, state, property } from 'lit/decorators.js';
import { DiffFile } from '../types';
import { fetchDiff, fetchFileContent, saveFileContent } from '../services/api';
import type { DiffRange } from './range-picker';
import './monaco-view';

@customElement('diff-viewer')
export class DiffViewer extends DiffReviewerElement {
  @property({ attribute: false })
  currentRange: DiffRange | null = null;

  @state() private files: DiffFile[] = [];
  @state() private selectedFile: string = '';
  @state() private loading: boolean = true;
  @state() private error: string | null = null;
  @state() private fileContents: Map<
    string,
    { original: string; modified: string }
  > = new Map();

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }

    .header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      border-bottom: 1px solid #e5e7eb;
      background: white;
    }

    .file-selector {
      flex: 1;
      padding: 0.5rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      font-size: 0.875rem;
    }

    .file-stats {
      display: flex;
      gap: 1rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .stat-item {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .additions {
      color: #059669;
    }

    .deletions {
      color: #dc2626;
    }

    .editor-container {
      flex: 1;
      overflow: hidden;
    }

    .loading,
    .error,
    .no-files {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #6b7280;
    }

    .error {
      color: #dc2626;
    }
  `;

  async connectedCallback() {
    super.connectedCallback();
    // Don't load immediately - wait for range picker
  }

  /**
   * Public method to load diff for a specific range.
   * Called directly by app-shell instead of relying on property binding.
   * This works around Lit reactivity issues when Shadow DOM is disabled.
   */
  public async loadDiffForRange(range: DiffRange) {
    this.currentRange = range;
    await this.loadDiff();
  }

  private async loadDiff() {
    if (!this.currentRange) {
      return;
    }

    try {
      this.loading = true;
      this.error = null;
      
      // Clear file contents cache when loading new diff
      this.fileContents.clear();
      
      this.files = await fetchDiff(
        this.currentRange.from,
        this.currentRange.to
      );

      if (this.files.length > 0) {
        this.selectedFile = this.files[0].path;
        await this.loadFileContents(this.files[0]);
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load diff';
      console.error('Error loading diff:', err);
    } finally {
      this.loading = false;
      // Force update to ensure re-render after async operations
      this.requestUpdate();
    }
  }

  private async loadFileContents(file: DiffFile) {
    try {
      const cacheKey = file.path;
      if (this.fileContents.has(cacheKey)) {
        return;
      }

      const [original, modified] = await Promise.all([
        file.old_hash
          ? fetchFileContent(file.old_hash, file.old_path || file.path)
          : Promise.resolve(''),
        file.new_hash
          ? fetchFileContent(file.new_hash, file.path)
          : Promise.resolve(''),
      ]);

      this.fileContents.set(cacheKey, { original, modified });
      this.requestUpdate();
    } catch (err) {
      console.error('Error loading file contents:', err);
      this.error = 'Failed to load file contents';
    }
  }

  private async handleFileChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.selectedFile = select.value;
    this.requestUpdate();

    const file = this.files.find((f) => f.path === this.selectedFile);
    if (file) {
      await this.loadFileContents(file);
    }
  }

  private async handleMonacoSave(e: CustomEvent) {
    const { path, content } = e.detail;
    const monacoView = this.shadowRoot?.querySelector('monaco-view');

    try {
      const response = await saveFileContent(path, content);
      if (response.success) {
        console.log(`File saved: ${path}`);
        (monacoView as any)?.notifySaveComplete(true);
        
        // Update the cached modified content
        const file = this.files.find((f) => f.path === path);
        if (file) {
          const cached = this.fileContents.get(file.path);
          if (cached) {
            cached.modified = content;
            this.fileContents.set(file.path, cached);
          }
        }
      } else {
        alert(`Failed to save: ${response.error || 'Unknown error'}`);
        (monacoView as any)?.notifySaveComplete(false);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Unknown error';
      alert(`Failed to save changes to ${path}:\n\n${errorMsg}`);
      (monacoView as any)?.notifySaveComplete(false);
    }
  }

  private handleNoteAdded(_e: CustomEvent) {
    // Event already bubbles from monaco-view, no need to forward
    // Just log for debugging
    console.log('Diff-viewer saw note-added event (bubbling naturally)');
  }

  private getCurrentFile(): DiffFile | undefined {
    return this.files.find((f) => f.path === this.selectedFile);
  }

  private getTotalStats() {
    return this.files.reduce(
      (acc, file) => ({
        additions: acc.additions + file.additions,
        deletions: acc.deletions + file.deletions,
      }),
      { additions: 0, deletions: 0 }
    );
  }

  render() {
    if (this.loading) {
      return html`<div class="loading">Loading diff...</div>`;
    }

    if (this.error) {
      return html`<div class="error">${this.error}</div>`;
    }

    if (this.files.length === 0) {
      return html`<div class="no-files">No files changed</div>`;
    }

    const currentFile = this.getCurrentFile();
    const contents = currentFile
      ? this.fileContents.get(currentFile.path)
      : null;
    const totalStats = this.getTotalStats();

    return html`
      <div class="header">
        <select
          class="file-selector"
          .value=${this.selectedFile}
          @change=${this.handleFileChange}
        >
          ${this.files.map(
            (file) => html`
              <option value=${file.path}>
                ${file.path} (+${file.additions} -${file.deletions})
              </option>
            `
          )}
        </select>
        <div class="file-stats">
          <div class="stat-item">
            <span>${this.files.length} files</span>
          </div>
          <div class="stat-item additions">+${totalStats.additions}</div>
          <div class="stat-item deletions">-${totalStats.deletions}</div>
        </div>
      </div>
      <div class="editor-container">
        ${contents
          ? html`
              <monaco-view
                .originalCode=${contents.original}
                .modifiedCode=${contents.modified}
                .originalFilename=${currentFile?.old_path || ''}
                .modifiedFilename=${currentFile?.path || ''}
                .editableRight=${true}
                @monaco-save=${this.handleMonacoSave}
                @note-added=${this.handleNoteAdded}
              ></monaco-view>
            `
          : html`<div class="loading">Loading file...</div>`}
      </div>
    `;
  }
}
