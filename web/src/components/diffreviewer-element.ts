import { LitElement } from 'lit';

/**
 * Base class for diffreviewer components that disables Shadow DOM.
 * This allows document-level CSS (including Monaco Editor styles) to reach
 * elements inside the component, similar to Sketch's SketchTailwindElement.
 */
export class DiffReviewerElement extends LitElement {
  createRenderRoot() {
    return this;
  }
}
