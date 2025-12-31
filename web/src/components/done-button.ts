import { html, css } from 'lit';
import { DiffReviewerElement } from './diffreviewer-element.js';
import { customElement } from 'lit/decorators.js';

@customElement('done-button')
export class DoneButton extends DiffReviewerElement {
  static styles = css`
    /* No custom styles needed - using Tailwind classes */
  `;

  private handleClick() {
    const event = new CustomEvent('done', {
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  render() {
    return html`<button 
      @click=${this.handleClick}
      class="px-8 py-3 bg-blue-600 text-white border-none rounded-lg text-base font-semibold cursor-pointer transition-all duration-200 shadow-md hover:bg-blue-700 hover:shadow-lg hover:-translate-y-0.5 active:bg-blue-800 active:translate-y-0 whitespace-nowrap"
    >Done</button>`;
  }
}
