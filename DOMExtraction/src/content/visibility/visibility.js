/**
 * Visibility utilities for checking element visibility and occlusion
 * Handles CSS visibility checks, viewport bounds, and multi-point occlusion testing
 */

import { THRESHOLDS } from "@shared/constants.js";
import { generateTestPoints } from "./geometry.js";

// Style cache to avoid repeated getComputedStyle calls
const styleCache = new WeakMap();

/**
 * Check if an element is truly visible using comprehensive visibility analysis
 * @param {Object} item - UI element item with node and boundingRect
 * @returns {boolean} True if element is truly visible
 */
export function isTrulyVisible(item) {
  const { node, boundingRect: r } = item;

  // Basic CSS visibility checks
  if (!isBasicVisible(item)) {
    return false;
  }

  // Multi-point occlusion testing (more robust than single center point)
  const testPoints = generateTestPoints(r);

  // Check if at least 60% of test points are not occluded
  let visiblePoints = 0;
  for (const point of testPoints) {
    const elementAtPoint = document.elementFromPoint(point.x, point.y);
    if (
      elementAtPoint &&
      (elementAtPoint === node || node.contains(elementAtPoint))
    ) {
      visiblePoints++;
    }
  }

  // Require at least 60% of points to be visible
  return visiblePoints / testPoints.length >= THRESHOLDS.VISIBILITY_POINTS;
}

/**
 * Basic visibility check for CSS properties and viewport bounds
 * @param {Object} item - UI element item with node and boundingRect
 * @returns {boolean} True if element passes basic visibility checks
 */
export function isBasicVisible(item) {
  const { node, boundingRect: r } = item;

  // Primary check: Bounding box area threshold
  const area = r.width * r.height;
  if (area < THRESHOLDS.MIN_AREA) {
    return false;
  }

  // Essential CSS property checks for edge cases where bounding boxes exist but element is hidden
  const style = getCachedComputedStyle(node);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  // Occlusion check removed
  return true;
}

/**
 * Check if CSS transform makes element invisible
 * @param {string} transform - CSS transform value
 * @returns {boolean} True if transform is visible
 */
export function isTransformVisible(transform) {
  if (!transform || transform === "none") {
    return true;
  }

  // Check if transform makes element invisible (scale 0, translate off-screen, etc.)
  if (
    transform.includes("scale(0)") ||
    transform.includes("scaleX(0)") ||
    transform.includes("scaleY(0)")
  ) {
    return false;
  }

  return true;
}

/**
 * Check if CSS clip-path makes element invisible
 * @param {string} clipPath - CSS clip-path value
 * @returns {boolean} True if clip-path is visible
 */
export function isClipPathVisible(clipPath) {
  if (!clipPath || clipPath === "none") {
    return true;
  }

  // If clip-path is inset(100%) or similar, element is hidden
  if (
    clipPath.includes("inset(100%") ||
    clipPath.includes("inset(0 0 0 100%")
  ) {
    return false;
  }

  return true;
}

/**
 * Test occlusion at a specific point
 * @param {Object} point - Point {x, y} to test
 * @param {Element} targetNode - Target element to check occlusion for
 * @returns {boolean} True if point is not occluded for target element
 */
export function testOcclusionAtPoint(point, targetNode) {
  const elementAtPoint = document.elementFromPoint(point.x, point.y);
  return (
    elementAtPoint &&
    (elementAtPoint === targetNode || targetNode.contains(elementAtPoint))
  );
}

/**
 * Get computed style for an element with caching
 * @param {Element} node - DOM element
 * @returns {CSSStyleDeclaration} Computed style object
 */
export function getCachedComputedStyle(node) {
  // Check cache first
  if (styleCache.has(node)) {
    return styleCache.get(node);
  }

  // Get computed style and cache it
  const style = window.getComputedStyle(node);
  styleCache.set(node, style);

  return style;
}

/**
 * Check if element is interactive based on CSS properties
 * @param {Element} node - DOM element
 * @returns {boolean} True if element appears interactive
 */
export function isInteractiveElement(node) {
  const style = getCachedComputedStyle(node);
  return (
    style.cursor === "pointer" ||
    style.cursor === "grab" ||
    style.cursor === "zoom-in" ||
    style.cursor === "zoom-out"
  );
}

/**
 * Clear the style cache
 */
export function clearStyleCache() {
  styleCache.clear();
}
