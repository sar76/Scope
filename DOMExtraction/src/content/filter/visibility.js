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
}
