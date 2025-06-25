/**
 * Highlight manager for visual feedback during element inspection
 * Handles element highlighting, overlay creation, and animation
 */

import { SELECTORS } from "@shared/constants.js";

/**
 * Highlight manager class for visual element highlighting
 */
export class HighlightManager {
  constructor() {
    this.currentHighlight = null;
    this.highlightId = SELECTORS.HIGHLIGHT_OVERLAY;
  }

  /**
   * Highlight an element with visual overlay
   * @param {Element|string} element - DOM element or CSS selector
   * @param {Object} options - Highlight options
   * @returns {Element} Created highlight element
   */
  highlightElement(element, options = {}) {
    this.removeHighlight();

    const targetElement =
      typeof element === "string" ? document.querySelector(element) : element;

    if (!targetElement) {
      console.warn("Element not found for highlighting");
      return null;
    }

    // Always scroll the element into view (centered, smooth)
    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });

    const rect = targetElement.getBoundingClientRect();
    const highlight = this.createHighlightOverlay(rect, options);

    document.body.appendChild(highlight);
    this.currentHighlight = highlight;

    // Animate in
    if (options.animated !== false) {
      this.animateHighlight(highlight, "in");
    }

    return highlight;
  }

  /**
   * Remove current highlight
   */
  removeHighlight() {
    if (this.currentHighlight) {
      if (this.currentHighlight.dataset.animated !== "false") {
        this.animateHighlight(this.currentHighlight, "out").then(() => {
          this.currentHighlight.remove();
          this.currentHighlight = null;
        });
      } else {
        this.currentHighlight.remove();
        this.currentHighlight = null;
      }
    }
  }

  /**
   * Create highlight overlay element
   * @param {Object} rect - Bounding rectangle
   * @param {Object} options - Highlight options
   * @returns {Element} Highlight overlay element
   */
  createHighlightOverlay(rect, options = {}) {
    const highlight = document.createElement("div");

    const defaultOptions = {
      color: "#007bff",
      opacity: 0.3,
      borderColor: "#007bff",
      borderWidth: "2px",
      borderStyle: "solid",
      animated: true,
      duration: 300,
      zIndex: 10000,
    };

    const config = { ...defaultOptions, ...options };

    highlight.id = this.highlightId;
    highlight.style.cssText = `
      position: fixed;
      top: ${rect.top + window.scrollY}px;
      left: ${rect.left + window.scrollX}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      background-color: ${config.color};
      opacity: ${config.opacity};
      border: ${config.borderWidth} ${config.borderStyle} ${config.borderColor};
      border-radius: 4px;
      pointer-events: none;
      z-index: ${config.zIndex};
      transition: opacity ${config.duration}ms ease-in-out;
      box-shadow: 0 0 10px rgba(0, 123, 255, 0.5);
    `;

    highlight.dataset.animated = config.animated.toString();
    highlight.dataset.duration = config.duration.toString();

    return highlight;
  }

  /**
   * Animate highlight element
   * @param {Element} highlight - Highlight element
   * @param {string} direction - Animation direction ('in' or 'out')
   * @returns {Promise} Promise that resolves when animation completes
   */
  animateHighlight(highlight, direction) {
    return new Promise((resolve) => {
      const duration = parseInt(highlight.dataset.duration) || 300;

      if (direction === "in") {
        highlight.style.opacity = "0";
        setTimeout(() => {
          highlight.style.opacity = highlight.style.opacity.replace("0", "0.3");
        }, 10);
      } else {
        highlight.style.opacity = "0";
      }

      setTimeout(resolve, duration);
    });
  }

  /**
   * Highlight multiple elements
   * @param {Array} elements - Array of elements or selectors
   * @param {Object} options - Highlight options
   * @returns {Array} Array of created highlight elements
   */
  highlightMultiple(elements, options = {}) {
    this.removeHighlight();

    const highlights = [];
    const delay = options.delay || 100;

    elements.forEach((element, index) => {
      setTimeout(() => {
        const highlight = this.highlightElement(element, {
          ...options,
          animated: false,
        });
        if (highlight) {
          highlights.push(highlight);
        }
      }, index * delay);
    });

    return highlights;
  }

  /**
   * Update highlight position and size
   * @param {Object} rect - New bounding rectangle
   */
  updateHighlight(rect) {
    if (this.currentHighlight) {
      this.currentHighlight.style.top = `${rect.top + window.scrollY}px`;
      this.currentHighlight.style.left = `${rect.left + window.scrollX}px`;
      this.currentHighlight.style.width = `${rect.width}px`;
      this.currentHighlight.style.height = `${rect.height}px`;
    }
  }

  /**
   * Check if highlight is currently active
   * @returns {boolean} True if highlight is active
   */
  isHighlighted() {
    return this.currentHighlight !== null;
  }

  /**
   * Get current highlight element
   * @returns {Element|null} Current highlight element
   */
  getCurrentHighlight() {
    return this.currentHighlight;
  }
}
