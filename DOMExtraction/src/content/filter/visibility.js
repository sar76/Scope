/**
 * Visibility filter for comprehensive visibility analysis
 * Handles CSS visibility checks, viewport bounds, and multi-point occlusion testing
 */

import { THRESHOLDS } from "@shared/constants.js";
import {
  isTrulyVisible,
  isBasicVisible,
  isWithinViewportBounds,
} from "../visibility/visibility.js";
import { cacheSelector } from "../utils/dom.js";

/**
 * Visibility filter class for comprehensive visibility analysis
 */
export class VisibilityFilter {
  constructor() {
    this.cache = new WeakMap();
  }

  /**
   * Apply basic visibility filtering
   * @param {Array} elements - Array of elements to filter
   * @returns {Array} Filtered elements
   */
  filter(elements) {
    return elements.filter((element) => {
      if (!element || !element.getBoundingClientRect) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return isBasicVisible({ node: element, boundingRect: rect });
    });
  }

  /**
   * Apply comprehensive visibility filtering
   * @param {Array} elements - Array of elements to filter
   * @returns {Array} Filtered elements
   */
  applyComprehensiveVisibilityFiltering(elements) {
    return elements.filter((element) => {
      if (!element || !element.getBoundingClientRect) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return isTrulyVisible({ node: element, boundingRect: rect });
    });
  }

  /**
   * Filter elements by viewport bounds
   * @param {Array} elements - Array of elements to filter
   * @returns {Array} Filtered elements
   */
  filterByViewportBounds(elements) {
    return elements.filter((element) => {
      if (!element || !element.getBoundingClientRect) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return isWithinViewportBounds(rect);
    });
  }

  /**
   * Filter elements by minimum size
   * @param {Array} elements - Array of elements to filter
   * @param {number} minWidth - Minimum width in pixels
   * @param {number} minHeight - Minimum height in pixels
   * @returns {Array} Filtered elements
   */
  filterByMinimumSize(elements, minWidth = 10, minHeight = 10) {
    return elements.filter((element) => {
      if (!element || !element.getBoundingClientRect) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width >= minWidth && rect.height >= minHeight;
    });
  }

  /**
   * Filter elements by maximum size
   * @param {Array} elements - Array of elements to filter
   * @param {number} maxWidth - Maximum width in pixels
   * @param {number} maxHeight - Maximum height in pixels
   * @returns {Array} Filtered elements
   */
  filterByMaximumSize(elements, maxWidth = 1000, maxHeight = 1000) {
    return elements.filter((element) => {
      if (!element || !element.getBoundingClientRect) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      return rect.width <= maxWidth && rect.height <= maxHeight;
    });
  }

  /**
   * Filter elements by aspect ratio
   * @param {Array} elements - Array of elements to filter
   * @param {number} minRatio - Minimum aspect ratio (width/height)
   * @param {number} maxRatio - Maximum aspect ratio (width/height)
   * @returns {Array} Filtered elements
   */
  filterByAspectRatio(elements, minRatio = 0.1, maxRatio = 10) {
    return elements.filter((element) => {
      if (!element || !element.getBoundingClientRect) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      if (rect.height === 0) return false;

      const ratio = rect.width / rect.height;
      return ratio >= minRatio && ratio <= maxRatio;
    });
  }

  /**
   * Clear visibility cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Apply basic visibility filtering with reasons
   * @param {Array} elements - Array of elements to filter
   * @returns {Object} {survivors: Element[], removedReasons: Map<string, string>}
   */
  filterWithReasons(elements) {
    const survivors = [];
    const removedReasons = new Map();

    for (const element of elements) {
      if (!element || !element.getBoundingClientRect) {
        const selector = cacheSelector(element);
        removedReasons.set(selector, "Invalid element");
        continue;
      }

      const rect = element.getBoundingClientRect();
      const isVisible = isBasicVisible({ node: element, boundingRect: rect });

      if (isVisible) {
        survivors.push(element);
      } else {
        // Determine specific reason for failure
        const reason = this.getVisibilityFailureReason(element, rect);
        const selector = cacheSelector(element);
        removedReasons.set(selector, reason);
      }
    }

    return { survivors, removedReasons };
  }

  /**
   * Apply comprehensive visibility filtering with reasons (two-pass: CSS, then occlusion)
   * @param {Array} elements - Array of elements to filter
   * @returns {Object} {survivors: Element[], removedReasons: Map<string, string>}
   */
  applyComprehensiveVisibilityFilteringWithReasons(elements) {
    // --- Pass 1: Remove elements invisible due to CSS ---
    const cssSurvivors = [];
    const cssRemovedReasons = new Map();

    for (const element of elements) {
      if (!element || !element.getBoundingClientRect) {
        const selector = cacheSelector(element);
        cssRemovedReasons.set(selector, "Invalid element");
        continue;
      }
      const rect = element.getBoundingClientRect();
      const isVisible = isBasicVisible({ node: element, boundingRect: rect });
      if (isVisible) {
        cssSurvivors.push(element);
      } else {
        // Determine specific reason for failure
        const reason = this.getVisibilityFailureReason(element, rect);
        const selector = cacheSelector(element);
        cssRemovedReasons.set(selector, reason);
      }
    }

    // --- Pass 2: Occlusion/stacking checks only on CSS-visible elements ---
    const survivors = [];
    const removedReasons = new Map(cssRemovedReasons); // Start with CSS removals

    for (const element of cssSurvivors) {
      const rect = element.getBoundingClientRect();
      // Only run occlusion/stacking checks (isTrulyVisible minus isBasicVisible)
      // We'll use isTrulyVisible, but skip isBasicVisible since already passed
      // So, replicate isTrulyVisible minus the isBasicVisible check
      // (viewport bounds, occlusion, etc.)
      // --- Viewport bounds check ---
      const scrollTop =
        window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft =
        window.pageXOffset || document.documentElement.scrollLeft;
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;
      if (
        rect.bottom + scrollTop < 0 ||
        rect.top + scrollTop > viewportHeight + scrollTop ||
        rect.right + scrollLeft < 0 ||
        rect.left + scrollLeft > viewportWidth + scrollLeft
      ) {
        removedReasons.set(
          cacheSelector(element),
          "off-screen (viewport bounds)"
        );
        continue;
      }
      // --- Occlusion test (multi-point) ---
      const { generateTestPoints } = require("../visibility/geometry.js");
      const testPoints = generateTestPoints(rect);
      let visiblePoints = 0;
      for (const point of testPoints) {
        const elementAtPoint = document.elementFromPoint(point.x, point.y);
        if (
          elementAtPoint &&
          (elementAtPoint === element || element.contains(elementAtPoint))
        ) {
          visiblePoints++;
        }
      }
      // Require at least 60% of points to be visible
      const THRESHOLDS = require("@shared/constants.js").THRESHOLDS;
      if (visiblePoints / testPoints.length < THRESHOLDS.VISIBILITY_POINTS) {
        removedReasons.set(
          cacheSelector(element),
          `occluded: only ${visiblePoints}/${testPoints.length} points visible`
        );
        continue;
      }
      // If passed all checks, keep as survivor
      survivors.push(element);
    }

    return { survivors, removedReasons };
  }

  /**
   * Get selector for an element
   * @param {Element} element - DOM element
   * @returns {string} CSS selector
   */
  getSelector(element) {
    if (!element) return "unknown";
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    // Simple selector generation
    let selector = element.tagName.toLowerCase();
    if (element.className) {
      const classes = element.className.split(" ").filter((c) => c.trim());
      if (classes.length > 0) {
        selector += "." + classes.map((c) => CSS.escape(c)).join(".");
      }
    }

    return selector;
  }

  /**
   * Get specific reason for basic visibility failure
   * @param {Element} element - DOM element
   * @param {DOMRect} rect - Element's bounding rectangle
   * @returns {string} Specific failure reason
   */
  getVisibilityFailureReason(element, rect) {
    const style = window.getComputedStyle(element);

    // Check display
    if (style.display === "none") {
      return "display: none";
    }

    // Check visibility
    if (style.visibility === "hidden") {
      return "visibility: hidden";
    }

    // Check opacity
    const opacity = parseFloat(style.opacity);
    if (opacity < 0.01) {
      return `opacity: ${opacity}`;
    }

    // Check dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      return `zero dimensions: ${Math.round(rect.width)}x${Math.round(
        rect.height
      )}`;
    }

    // Check position (off-screen)
    if (
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.top > window.innerHeight
    ) {
      return "off-screen";
    }

    return "not visible";
  }

  /**
   * Get specific reason for comprehensive visibility failure
   * @param {Element} element - DOM element
   * @param {DOMRect} rect - Element's bounding rectangle
   * @returns {string} Specific failure reason
   */
  getComprehensiveVisibilityFailureReason(element, rect) {
    const style = window.getComputedStyle(element);

    // Check display
    if (style.display === "none") {
      return "display: none";
    }

    // Check visibility
    if (style.visibility === "hidden") {
      return "visibility: hidden";
    }

    // Check opacity
    const opacity = parseFloat(style.opacity);
    if (opacity < 0.01) {
      return `opacity: ${opacity}`;
    }

    // Check dimensions
    if (rect.width <= 0 || rect.height <= 0) {
      return `zero dimensions: ${Math.round(rect.width)}x${Math.round(
        rect.height
      )}`;
    }

    // Check position (off-screen)
    if (
      rect.right < 0 ||
      rect.bottom < 0 ||
      rect.left > window.innerWidth ||
      rect.top > window.innerHeight
    ) {
      return "off-screen";
    }

    // Check transform
    const transform = style.transform;
    if (
      transform &&
      (transform.includes("scale(0)") ||
        transform.includes("scaleX(0)") ||
        transform.includes("scaleY(0)"))
    ) {
      return "transform: scale(0)";
    }

    // Check clip-path
    const clipPath = style.clipPath;
    if (clipPath && clipPath !== "none") {
      return "clip-path applied";
    }

    // Check overflow hidden on parent
    let parent = element.parentElement;
    while (parent && parent !== document.body) {
      const parentStyle = window.getComputedStyle(parent);
      if (parentStyle.overflow === "hidden") {
        const parentRect = parent.getBoundingClientRect();
        if (
          rect.left >= parentRect.right ||
          rect.right <= parentRect.left ||
          rect.top >= parentRect.bottom ||
          rect.bottom <= parentRect.top
        ) {
          return "hidden by parent overflow";
        }
      }
      parent = parent.parentElement;
    }

    return "not visible";
  }
}
