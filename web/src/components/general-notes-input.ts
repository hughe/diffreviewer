import { html, css } from 'lit';
import { DiffReviewerElement } from './diffreviewer-element.js';
import { customElement, property } from 'lit/decorators.js';

@customElement('general-notes-input')
export class GeneralNotesInput extends DiffReviewerElement {
  @property({ type: String }) value = '';

  private debounceTimeout: number | null = null;

  static styles = css`
    /* No custom styles needed - using Tailwind classes */
  `;

  private handleInput(e: Event) {
    const textarea = e.target as HTMLTextAreaElement;
    this.value = textarea.value;

    // Debounce the change event
    if (this.debounceTimeout) {
      clearTimeout(this.debounceTimeout);
    }

    this.debounceTimeout = window.setTimeout(() => {
      const event = new CustomEvent('notes-change', {
        detail: { text: this.value },
        bubbles: true,
        composed: true,
      });
      this.dispatchEvent(event);
    }, 500);
  }

  render() {
    return html`
      <textarea
        class="w-full min-h-[100px] p-3 border border-gray-300 rounded-md text-sm resize-vertical flex-1 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-300 placeholder-gray-400"
        .value=${this.value}
        @input=${this.handleInput}
        placeholder="Add general review notes here..."
      ></textarea>
    `;
  }
}
