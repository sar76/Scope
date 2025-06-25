/**
 * Element collector utility for DOM traversal and element collection
 * Handles interactive element detection, CSS path computation, and data extraction
 */

import {
  ALLOWED_TAGS,
  ALLOWED_ROLES,
  INTERACTIVE_TAGS,
  PERFORMANCE,
} from "@shared/constants.js";
import { computeUniqueCssPath } from "./dom.js";
import { isTrulyVisible } from "../visibility/visibility.js";

// Style cache to avoid repeated getComputedStyle calls
const styleCache = new WeakMap();

/**
 * Element collector class for gathering UI elements from the DOM
 */
export class ElementCollector {
  constructor() {
    this.styleCache = new WeakMap();
  }

  /**
   * Collect all relevant UI elements from the DOM
   * @returns {Promise<Array>} Promise that resolves with collected elements
   */
  async collectElements() {
    console.log("Starting element collection...");

    const elements = [];

    // Collect interactive elements
    const interactiveElements = this.collectInteractiveElements();
    elements.push(...interactiveElements);

    // Collect elements with ARIA roles
    const roleElements = this.collectRoleElements();
    elements.push(...roleElements);

    // Collect structural elements
    const structuralElements = this.collectStructuralElements();
    elements.push(...structuralElements);

    // Remove duplicates and extract data
    const uniqueElements = this.deduplicateElements(elements);
    const extractedData = await this.extractElementData(uniqueElements);

    console.log(`Collected ${extractedData.length} unique elements`);
    return extractedData;
  }

  /**
   * Collect interactive elements from the DOM
   * @returns {Array} Array of interactive DOM elements
   */
  collectInteractiveElements() {
    const results = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const style = this.getCachedComputedStyle(node);
          const tag = node.tagName?.toLowerCase();
          const hasCursor = style.cursor === "pointer";
          const hasClick =
            typeof node.onclick === "function" || node.getAttribute("onclick");
          const isNative = INTERACTIVE_TAGS.has(tag);
          const hasRoleBtn = node.getAttribute("role") === "button";
          const isLink = tag === "a" && node.hasAttribute("href");

          if (isNative || isLink || hasRoleBtn || hasClick || hasCursor) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        },
      },
      false
    );

    let el = walker.nextNode();
    while (el) {
      results.push(el);
      el = walker.nextNode();
    }

    // Recurse into shadow roots
    const all = document.querySelectorAll("*");
    all.forEach((node) => {
      if (node.shadowRoot) {
        results.push(...this.collectInteractiveElements(node.shadowRoot));
      }
    });

    return results;
  }

  /**
   * Collect elements with ARIA roles
   * @returns {Array} Array of elements with ARIA roles
   */
  collectRoleElements() {
    const results = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const role = node.getAttribute("role");
          if (role && ALLOWED_ROLES.has(role)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        },
      },
      false
    );

    let el = walker.nextNode();
    while (el) {
      results.push(el);
      el = walker.nextNode();
    }

    return results;
  }

  /**
   * Collect structural elements
   * @returns {Array} Array of structural DOM elements
   */
  collectStructuralElements() {
    const results = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node) => {
          const tag = node.tagName?.toLowerCase();
          if (ALLOWED_TAGS.has(tag)) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        },
      },
      false
    );

    let el = walker.nextNode();
    while (el) {
      results.push(el);
      el = walker.nextNode();
    }

    return results;
  }

  /**
   * Remove duplicate elements based on CSS selector
   * @param {Array} elements - Array of DOM elements
   * @returns {Array} Array of unique elements
   */
  deduplicateElements(elements) {
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
   * Extract data from DOM elements
   * @param {Array} elements - Array of DOM elements
   * @returns {Promise<Array>} Promise that resolves with extracted data
   */
  async extractElementData(elements) {
    const data = [];

    for (const element of elements) {
      try {
        const elementData = this.extractSingleElementData(element);
        if (elementData) {
          data.push(elementData);
        }
      } catch (error) {
        console.warn("Error extracting data from element:", error);
      }
    }

    return data;
  }

  /**
   * Extract data from a single DOM element
   * @param {Element} element - DOM element
   * @returns {Object|null} Extracted element data or null if invalid
   */
  extractSingleElementData(element) {
    if (!element || !element.getBoundingClientRect) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const selector = computeUniqueCssPath(element);
    const tagName = element.tagName.toLowerCase();
    const innerText = element.innerText?.trim() || "";
    const role = element.getAttribute("role") || null;
    const ariaLabel = element.getAttribute("aria-label") || null;

    return {
      selector,
      tagName,
      innerText,
      role,
      ariaLabel,
      rect: {
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      },
      isVisible: isTrulyVisible({ node: element, boundingRect: rect }),
      isInteractive: this.isInteractiveElement(element),
      elementType: this.getElementType(element),
      confidence: 1.0,
      cssPath: selector,
    };
  }

  /**
   * Check if element is interactive
   * @param {Element} element - DOM element
   * @returns {boolean} True if element is interactive
   */
  isInteractiveElement(element) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const style = this.getCachedComputedStyle(element);

    return (
      INTERACTIVE_TAGS.has(tag) ||
      role === "button" ||
      role === "link" ||
      style.cursor === "pointer" ||
      typeof element.onclick === "function" ||
      element.getAttribute("onclick")
    );
  }

  /**
   * Get element type classification
   * @param {Element} element - DOM element
   * @returns {string} Element type
   */
  getElementType(element) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");

    if (tag === "button" || role === "button") return "button";
    if (tag === "input") return "input";
    if (tag === "a" || role === "link") return "link";
    if (tag === "nav" || role === "navigation") return "navigation";
    if (tag === "header" || role === "banner") return "header";
    if (tag === "footer" || role === "contentinfo") return "footer";
    if (tag === "main" || role === "main") return "main";
    if (tag === "form") return "form";
    if (tag === "section" || tag === "article") return "content";

    return "container";
  }

  /**
   * Get computed style with caching
   * @param {Element} node - DOM element
   * @returns {CSSStyleDeclaration} Computed style
   */
  getCachedComputedStyle(node) {
    if (this.styleCache.has(node)) {
      return this.styleCache.get(node);
    }

    const style = window.getComputedStyle(node);
    this.styleCache.set(node, style);
    return style;
  }

  /**
   * Clear style cache
   */
  clearStyleCache() {
    this.styleCache.clear();
  }
}
