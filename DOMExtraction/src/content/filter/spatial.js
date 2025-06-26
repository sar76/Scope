/**
 * Spatial filter for spatial analysis and filtering
 * Handles top-level filtering and spatial relationships
 */

import { THRESHOLDS } from "@shared/constants.js";
import { calculateIoU, calculateArea } from "../visibility/geometry.js";

/**
 * Spatial filter class for spatial analysis and filtering
 */
export class SpatialFilter {
  constructor() {
    this.cache = new WeakMap();
  }

  /**
   * Filter top-level elements using fixpoint iteration
   * @param {Array} elements - Array of elements to filter
   * @returns {Array} Top-level elements
   */
  filterTopLevelElements(elements) {
    const rects = elements.map((element) => ({
      element,
      rect: element.getBoundingClientRect(),
    }));

    const topLevel = [];

    for (let i = 0; i < rects.length; i++) {
      let isTopLevel = true;

      for (let j = 0; j < rects.length; j++) {
        if (i === j) continue;

        const iou = calculateIoU(rects[i].rect, rects[j].rect);
        if (iou > THRESHOLDS.IOU_CONTAINMENT) {
          // Check if element i is contained within element j
          const areaI = calculateArea(rects[i].rect);
          const areaJ = calculateArea(rects[j].rect);

          if (areaI < areaJ) {
            isTopLevel = false;
            break;
          }
        }
      }

      if (isTopLevel) {
        topLevel.push(rects[i].element);
      }
    }

    return topLevel;
  }

  /**
   * Filter elements by minimum area
   * @param {Array} elements - Array of elements to filter
   * @param {number} minArea - Minimum area in square pixels
   * @returns {Array} Filtered elements
   */
  filterByMinimumArea(elements, minArea = 100) {
    return elements.filter((element) => {
      if (!element || !element.getBoundingClientRect) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      const area = calculateArea(rect);
      return area >= minArea;
    });
  }

  /**
   * Filter elements by maximum area
   * @param {Array} elements - Array of elements to filter
   * @param {number} maxArea - Maximum area in square pixels
   * @returns {Array} Filtered elements
   */
  filterByMaximumArea(elements, maxArea = 100000) {
    return elements.filter((element) => {
      if (!element || !element.getBoundingClientRect) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      const area = calculateArea(rect);
      return area <= maxArea;
    });
  }

  /**
   * Filter elements by distance from viewport center
   * @param {Array} elements - Array of elements to filter
   * @param {number} maxDistance - Maximum distance from center in pixels
   * @returns {Array} Filtered elements
   */
  filterByDistanceFromCenter(elements, maxDistance = 1000) {
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    return elements.filter((element) => {
      if (!element || !element.getBoundingClientRect) {
        return false;
      }

      const rect = element.getBoundingClientRect();
      const elementCenterX = rect.left + rect.width / 2;
      const elementCenterY = rect.top + rect.height / 2;

      const distance = Math.sqrt(
        Math.pow(elementCenterX - centerX, 2) +
          Math.pow(elementCenterY - centerY, 2)
      );

      return distance <= maxDistance;
    });
  }

  /**
   * Filter elements by position (top, bottom, left, right)
   * @param {Array} elements - Array of elements to filter
   * @param {string} position - Position to filter by ('top', 'bottom', 'left', 'right')
   * @param {number} threshold - Threshold distance from edge in pixels
   * @returns {Array} Filtered elements
   */
  filterByPosition(elements, position, threshold = 50) {
    return elements.filter((element) => {
      if (!element || !element.getBoundingClientRect) {
        return false;
      }

      const rect = element.getBoundingClientRect();

      switch (position) {
        case "top":
          return rect.top <= threshold;
        case "bottom":
          return rect.bottom >= window.innerHeight - threshold;
        case "left":
          return rect.left <= threshold;
        case "right":
          return rect.right >= window.innerWidth - threshold;
        default:
          return true;
      }
    });
  }

  /**
   * Filter elements that are not heavily overlapped
   * @param {Array} elements - Array of elements to filter
   * @param {number} maxOverlap - Maximum overlap ratio (0-1)
   * @returns {Array} Filtered elements
   */
  filterByOverlap(elements, maxOverlap = 0.8) {
    const filtered = [];

    for (let i = 0; i < elements.length; i++) {
      let hasHighOverlap = false;
      const rectA = elements[i].getBoundingClientRect();

      for (let j = 0; j < filtered.length; j++) {
        const rectB = filtered[j].getBoundingClientRect();
        const iou = calculateIoU(rectA, rectB);

        if (iou > maxOverlap) {
          hasHighOverlap = true;
          break;
        }
      }

      if (!hasHighOverlap) {
        filtered.push(elements[i]);
      }
    }

    return filtered;
  }

  /**
   * Clear spatial cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Filter elements by minimum area with reasons
   * @param {Array} elements - Array of elements to filter
   * @param {number} minArea - Minimum area in square pixels
   * @returns {Object} {survivors: Element[], removedReasons: Map<string, string>}
   */
  filterByMinimumAreaWithReasons(elements, minArea = 100) {
    const survivors = [];
    const removedReasons = new Map();

    for (const element of elements) {
      if (!element || !element.getBoundingClientRect) {
        const selector = this.getSelector(element);
        removedReasons.set(selector, "Invalid element");
        continue;
      }

      const rect = element.getBoundingClientRect();
      const area = calculateArea(rect);

      if (area >= minArea) {
        survivors.push(element);
      } else {
        const selector = this.getSelector(element);
        removedReasons.set(
          selector,
          `area too small: ${Math.round(area)}px² (min: ${minArea}px²)`
        );
      }
    }

    return { survivors, removedReasons };
  }

  /**
   * Filter elements by maximum area with reasons
   * @param {Array} elements - Array of elements to filter
   * @param {number} maxArea - Maximum area in square pixels
   * @returns {Object} {survivors: Element[], removedReasons: Map<string, string>}
   */
  filterByMaximumAreaWithReasons(elements, maxArea = 100000) {
    const survivors = [];
    const removedReasons = new Map();

    for (const element of elements) {
      if (!element || !element.getBoundingClientRect) {
        const selector = this.getSelector(element);
        removedReasons.set(selector, "Invalid element");
        continue;
      }

      const rect = element.getBoundingClientRect();
      const area = calculateArea(rect);

      if (area <= maxArea) {
        survivors.push(element);
      } else {
        const selector = this.getSelector(element);
        removedReasons.set(
          selector,
          `area too large: ${Math.round(area)}px² (max: ${maxArea}px²)`
        );
      }
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
}
