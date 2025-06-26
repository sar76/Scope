/**
 * Highlight manager for visual feedback during element inspection
 * Handles element highlighting, overlay creation, and animation
 * Now properly handles scrolling, resizing, and dynamic content changes
 */

import { SELECTORS } from "@shared/constants.js";

/**
 * Highlight manager class for visual element highlighting
 */
export class HighlightManager {
  constructor() {
    this.currentHighlight = null;
    this.highlightId = SELECTORS.HIGHLIGHT_OVERLAY;
    this.targetElement = null;
    this.scrollListener = null;
    this.resizeListener = null;
    this.mutationObserver = null;
    this.updateTimeout = null;
    this.isUpdating = false;
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
      console.warn("Element not found for highlighting:", element);
      return null;
    }

    // Check if element has getBoundingClientRect
    if (!targetElement.getBoundingClientRect) {
      console.warn(
        "Element does not have getBoundingClientRect method:",
        targetElement
      );
      return null;
    }

    this.targetElement = targetElement;

    // Always scroll the element into view (centered, smooth)
    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });

    // Wait a bit for scroll to complete, then create highlight
    setTimeout(() => {
      try {
        this.createHighlight(options);
        this.setupEventListeners();
        this.startObserving();
      } catch (error) {
        console.error("Error creating highlight in HighlightManager:", error);
      }
    }, 100); // Small delay to ensure scroll completes

    return this.currentHighlight;
  }

  /**
   * Create highlight overlay
   * @param {Object} options - Highlight options
   */
  createHighlight(options = {}) {
    if (!this.targetElement) return;

    const rect = this.targetElement.getBoundingClientRect();

    // Debug logging
    console.log("HighlightManager highlighting element:", {
      tagName: this.targetElement.tagName,
      rect: {
        top: rect.top,
        left: rect.left,
        width: rect.width,
        height: rect.height,
        area: rect.width * rect.height,
      },
      scrollY: window.scrollY,
      scrollX: window.scrollX,
    });

    // Check if element has valid dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      console.warn("Element has zero or negative dimensions:", {
        width: rect.width,
        height: rect.height,
        element: this.targetElement,
      });
      return;
    }

    // Check if element is in viewport
    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      console.warn("Element is outside viewport:", {
        rect,
        viewport: { width: window.innerWidth, height: window.innerHeight },
      });
    }

    const highlight = this.createHighlightOverlay(rect, options);

    document.body.appendChild(highlight);
    this.currentHighlight = highlight;

    // Animate in
    if (options.animated !== false) {
      this.animateHighlight(highlight, "in");
    }

    console.log(
      "HighlightManager created highlight successfully for:",
      this.targetElement.tagName
    );
  }

  /**
   * Set up event listeners for scroll and resize
   */
  setupEventListeners() {
    // Remove existing listeners
    this.removeEventListeners();

    // Scroll listener
    this.scrollListener = () => {
      this.debouncedUpdate();
    };

    // Resize listener
    this.resizeListener = () => {
      this.debouncedUpdate();
    };

    // Add listeners
    window.addEventListener("scroll", this.scrollListener, { passive: true });
    window.addEventListener("resize", this.resizeListener, { passive: true });

    // Also listen for scroll events on scrollable containers
    this.addScrollableContainerListeners();
  }

  /**
   * Add scroll listeners to scrollable containers
   */
  addScrollableContainerListeners() {
    const scrollableContainers = this.findScrollableContainers(
      this.targetElement
    );

    scrollableContainers.forEach((container) => {
      container.addEventListener("scroll", this.scrollListener, {
        passive: true,
      });
    });
  }

  /**
   * Find all scrollable containers that contain the target element
   * @param {Element} element - Target element
   * @returns {Array} Array of scrollable containers
   */
  findScrollableContainers(element) {
    const containers = [];
    let current = element.parentElement;

    while (current && current !== document.body) {
      const style = window.getComputedStyle(current);
      const overflow = style.overflow + style.overflowX + style.overflowY;

      if (overflow.includes("scroll") || overflow.includes("auto")) {
        containers.push(current);
      }

      current = current.parentElement;
    }

    return containers;
  }

  /**
   * Remove event listeners
   */
  removeEventListeners() {
    if (this.scrollListener) {
      window.removeEventListener("scroll", this.scrollListener);
      this.scrollListener = null;
    }

    if (this.resizeListener) {
      window.removeEventListener("resize", this.resizeListener);
      this.resizeListener = null;
    }

    // Remove scrollable container listeners
    if (this.targetElement) {
      const scrollableContainers = this.findScrollableContainers(
        this.targetElement
      );
      scrollableContainers.forEach((container) => {
        container.removeEventListener("scroll", this.scrollListener);
      });
    }
  }

  /**
   * Debounced update function
   */
  debouncedUpdate() {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    this.updateTimeout = setTimeout(() => {
      this.updateHighlightPosition();
    }, 16); // ~60fps
  }

  /**
   * Update highlight position
   */
  updateHighlightPosition() {
    if (!this.currentHighlight || !this.targetElement || this.isUpdating) {
      return;
    }

    this.isUpdating = true;

    try {
      // Check if target element still exists
      if (!document.contains(this.targetElement)) {
        console.warn("Target element no longer exists, removing highlight");
        this.removeHighlight();
        return;
      }

      const rect = this.targetElement.getBoundingClientRect();

      // Update highlight position using absolute positioning
      this.currentHighlight.style.top = `${rect.top + window.scrollY}px`;
      this.currentHighlight.style.left = `${rect.left + window.scrollX}px`;
      this.currentHighlight.style.width = `${rect.width}px`;
      this.currentHighlight.style.height = `${rect.height}px`;

      // Check if element is still visible
      if (rect.width <= 0 || rect.height <= 0) {
        this.currentHighlight.style.opacity = "0.1";
      } else {
        this.currentHighlight.style.opacity = "0.3";
      }
    } catch (error) {
      console.error("Error updating highlight position:", error);
    } finally {
      this.isUpdating = false;
    }
  }

  /**
   * Start observing DOM changes
   */
  startObserving() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
    }

    this.mutationObserver = new MutationObserver((mutations) => {
      let shouldUpdate = false;

      mutations.forEach((mutation) => {
        // Check if our target element or its ancestors were affected
        if (mutation.type === "childList") {
          if (mutation.removedNodes) {
            for (let node of mutation.removedNodes) {
              if (node.contains && node.contains(this.targetElement)) {
                shouldUpdate = true;
                break;
              }
            }
          }
        } else if (mutation.type === "attributes") {
          // Check if the mutation affects our target element or its positioning
          if (
            mutation.target === this.targetElement ||
            mutation.target.contains(this.targetElement)
          ) {
            const attr = mutation.attributeName;
            if (["class", "style", "hidden"].includes(attr)) {
              shouldUpdate = true;
            }
          }
        }
      });

      if (shouldUpdate) {
        this.debouncedUpdate();
      }
    });

    this.mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "hidden"],
    });
  }

  /**
   * Stop observing DOM changes
   */
  stopObserving() {
    if (this.mutationObserver) {
      this.mutationObserver.disconnect();
      this.mutationObserver = null;
    }
  }

  /**
   * Remove current highlight
   */
  removeHighlight() {
    this.removeEventListeners();
    this.stopObserving();

    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
      this.updateTimeout = null;
    }

    if (this.currentHighlight) {
      if (this.currentHighlight.dataset.animated !== "false") {
        this.animateHighlight(this.currentHighlight, "out").then(() => {
          this.currentHighlight.remove();
          this.currentHighlight = null;
          this.targetElement = null;
        });
      } else {
        this.currentHighlight.remove();
        this.currentHighlight = null;
        this.targetElement = null;
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

    // Use absolute positioning instead of fixed for better scroll handling
    highlight.id = this.highlightId;
    highlight.style.cssText = `
      position: absolute;
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
   * @param {Array} elements - Array of elements to highlight
   * @param {Object} options - Highlight options
   * @returns {Array} Array of created highlight elements
   */
  highlightMultiple(elements, options = {}) {
    this.removeHighlight();

    const highlights = [];
    elements.forEach((element, index) => {
      const highlight = this.highlightElement(element, {
        ...options,
        color: options.color || `hsl(${(index * 137.5) % 360}, 70%, 50%)`,
      });
      if (highlight) {
        highlights.push(highlight);
      }
    });

    return highlights;
  }

  /**
   * Update highlight with new rectangle
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
   * Check if element is currently highlighted
   * @returns {boolean} True if element is highlighted
   */
  isHighlighted() {
    return this.currentHighlight !== null;
  }

  /**
   * Get current highlight element
   * @returns {Element|null} Current highlight element or null
   */
  getCurrentHighlight() {
    return this.currentHighlight;
  }

  /**
   * Get target element
   * @returns {Element|null} Target element or null
   */
  getTargetElement() {
    return this.targetElement;
  }
}
