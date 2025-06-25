/**
 * Deduplication filter for removing duplicate elements
 * Handles IoU-based deduplication, light deduplication, and final deduplication
 */

import { THRESHOLDS } from "@shared/constants.js";
import { calculateIoU, calculateArea } from "../visibility/geometry.js";
import { computeUniqueCssPath } from "../utils/dom.js";

/**
 * Deduplication filter class for removing duplicate elements
 */
export class DeduplicationFilter {
  constructor() {
    this.cache = new WeakMap();
  }

  /**
   * Apply light deduplication based on selector similarity
   * @param {Array} elements - Array of elements to deduplicate
   * @param {number} threshold - Similarity threshold (default: 0.95)
   * @returns {Array} Deduplicated elements
   */
  applyLightDeduplication(elements, threshold = THRESHOLDS.LIGHT_DEDUPE) {
    const seen = new Set();
    const unique = [];

    for (const element of elements) {
      const selector = computeUniqueCssPath(element);
      if (!seen.has(selector)) {
        seen.add(selector);
        unique.push(element);
      }
    }

    return unique;
  }

  /**
   * Apply IoU-based deduplication
   * @param {Array} elements - Array of elements to deduplicate
   * @param {number} threshold - IoU threshold (default: 0.9)
   * @returns {Array} Deduplicated elements
   */
  applyIoUDeduplication(elements, threshold = THRESHOLDS.IOU_DEDUPE) {
    const unique = [];

    for (let i = 0; i < elements.length; i++) {
      let isDuplicate = false;
      const rectA = elements[i].getBoundingClientRect();

      for (let j = 0; j < unique.length; j++) {
        const rectB = unique[j].getBoundingClientRect();
        const iou = calculateIoU(rectA, rectB);

        if (iou > threshold) {
          // Keep the larger element
          const areaA = calculateArea(rectA);
          const areaB = calculateArea(rectB);

          if (areaA > areaB) {
            unique[j] = elements[i];
          }
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(elements[i]);
      }
    }

    return unique;
  }

  /**
   * Apply containment-based deduplication
   * @param {Array} elements - Array of elements to deduplicate
   * @param {number} threshold - Containment threshold (default: 0.7)
   * @returns {Array} Deduplicated elements
   */
  applyContainmentDeduplication(
    elements,
    threshold = THRESHOLDS.IOU_CONTAINMENT
  ) {
    const unique = [];

    for (let i = 0; i < elements.length; i++) {
      let isContained = false;
      const rectA = elements[i].getBoundingClientRect();

      for (let j = 0; j < unique.length; j++) {
        const rectB = unique[j].getBoundingClientRect();

        // Check if element A is contained in element B
        if (this.isContained(rectA, rectB)) {
          const containment = this.calculateContainment(rectA, rectB);
          if (containment > threshold) {
            isContained = true;
            break;
          }
        }

        // Check if element B is contained in element A
        if (this.isContained(rectB, rectA)) {
          const containment = this.calculateContainment(rectB, rectA);
          if (containment > threshold) {
            // Replace the smaller element with the larger one
            unique[j] = elements[i];
            isContained = true;
            break;
          }
        }
      }

      if (!isContained) {
        unique.push(elements[i]);
      }
    }

    return unique;
  }

  /**
   * Apply final deduplication combining multiple strategies
   * @param {Array} elements - Array of elements to deduplicate
   * @returns {Array} Final deduplicated elements
   */
  applyFinalDeduplication(elements) {
    // Step 1: Light deduplication
    let deduplicated = this.applyLightDeduplication(elements);

    // Step 2: IoU-based deduplication
    deduplicated = this.applyIoUDeduplication(deduplicated);

    // Step 3: Containment-based deduplication
    deduplicated = this.applyContainmentDeduplication(deduplicated);

    // Step 4: Text-based deduplication
    deduplicated = this.applyTextBasedDeduplication(deduplicated);

    return deduplicated;
  }

  /**
   * Apply text-based deduplication
   * @param {Array} elements - Array of elements to deduplicate
   * @param {number} threshold - Text similarity threshold (default: 0.8)
   * @returns {Array} Deduplicated elements
   */
  applyTextBasedDeduplication(elements, threshold = 0.8) {
    const unique = [];

    for (let i = 0; i < elements.length; i++) {
      let isDuplicate = false;
      const textA = elements[i].innerText?.trim().toLowerCase() || "";

      for (let j = 0; j < unique.length; j++) {
        const textB = unique[j].innerText?.trim().toLowerCase() || "";

        if (textA === textB && textA.length > 0) {
          // Keep the element with better positioning (closer to top-left)
          const rectA = elements[i].getBoundingClientRect();
          const rectB = unique[j].getBoundingClientRect();

          const scoreA = rectA.top + rectA.left;
          const scoreB = rectB.top + rectB.left;

          if (scoreA < scoreB) {
            unique[j] = elements[i];
          }
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        unique.push(elements[i]);
      }
    }

    return unique;
  }

  /**
   * Check if one rectangle is contained within another
   * @param {Object} inner - Inner rectangle
   * @param {Object} outer - Outer rectangle
   * @returns {boolean} True if inner is contained in outer
   */
  isContained(inner, outer) {
    return (
      inner.x >= outer.x &&
      inner.y >= outer.y &&
      inner.x + inner.width <= outer.x + outer.width &&
      inner.y + inner.height <= outer.y + outer.height
    );
  }

  /**
   * Calculate containment ratio
   * @param {Object} inner - Inner rectangle
   * @param {Object} outer - Outer rectangle
   * @returns {number} Containment ratio between 0 and 1
   */
  calculateContainment(inner, outer) {
    const intersection = this.calculateIntersection(inner, outer);
    const areaInner = calculateArea(inner);

    return areaInner > 0 ? intersection / areaInner : 0;
  }

  /**
   * Calculate intersection area between two rectangles
   * @param {Object} rectA - First rectangle
   * @param {Object} rectB - Second rectangle
   * @returns {number} Intersection area
   */
  calculateIntersection(rectA, rectB) {
    const left = Math.max(rectA.x, rectB.x);
    const top = Math.max(rectA.y, rectB.y);
    const right = Math.min(rectA.x + rectA.width, rectB.x + rectB.width);
    const bottom = Math.min(rectA.y + rectA.height, rectB.y + rectB.height);

    if (left >= right || top >= bottom) {
      return 0;
    }

    return (right - left) * (bottom - top);
  }

  /**
   * Clear deduplication cache
   */
  clearCache() {
    this.cache.clear();
  }
}
