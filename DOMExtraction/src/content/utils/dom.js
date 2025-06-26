/**
 * DOM utility functions for CSS path computation and element manipulation
 * Handles unique selector generation, element traversal, and DOM operations
 */

import { PERFORMANCE } from "@shared/constants.js";

/**
 * Compute unique CSS path for an element
 * @param {Element} el - DOM element
 * @returns {string} Unique CSS selector path
 */
export function computeUniqueCssPath(el) {
  if (!(el instanceof Element)) return null;
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }

  const segments = [];
  let current = el;

  while (
    current &&
    current.nodeType === Node.ELEMENT_NODE &&
    current !== document.body
  ) {
    let seg = current.tagName.toLowerCase();
    if (current.classList.length > 0) {
      seg +=
        "." +
        Array.from(current.classList)
          .map((cls) => CSS.escape(cls))
          .join(".");
    }
    const parent = current.parentNode;
    if (parent && parent.nodeType === Node.ELEMENT_NODE) {
      const same = Array.from(parent.children).filter((sib) => {
        if (sib.tagName !== current.tagName) return false;
        const a = Array.from(sib.classList).sort().join(" ");
        const b = Array.from(current.classList).sort().join(" ");
        return a === b;
      });
      if (same.length > 1) {
        const idx = Array.prototype.indexOf.call(parent.children, current) + 1;
        seg += `:nth-child(${idx})`;
      }
    }
    segments.unshift(seg);
    current = parent;
  }

  return segments.length > 0 ? `body > ${segments.join(" > ")}` : "body";
}

/**
 * Check if selector is descendant of another selector
 * @param {string} inner - Inner selector
 * @param {string} outer - Outer selector
 * @returns {boolean} True if inner is descendant of outer
 */
export function isSelectorDescendant(inner, outer) {
  return (
    inner.length > outer.length &&
    inner.startsWith(outer) &&
    inner[outer.length] === ">"
  );
}

/**
 * Wait for a specific container to be available
 * @param {string} selector - CSS selector to wait for
 * @param {number} maxAttempts - Maximum attempts to find element
 * @param {number} interval - Interval between attempts in milliseconds
 * @returns {Promise<Element>} Promise that resolves with found element
 */
export async function waitForContainer(
  selector,
  maxAttempts = PERFORMANCE.MAX_OBSERVER_ATTEMPTS,
  interval = PERFORMANCE.OBSERVER_INTERVAL
) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const element = document.querySelector(selector);
    if (element) {
      return element;
    }
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
  throw new Error(`Container not found: ${selector}`);
}

/**
 * Get element by CSS selector with error handling
 * @param {string} selector - CSS selector
 * @returns {Element|null} Found element or null
 */
export function getElementBySelector(selector) {
  try {
    return document.querySelector(selector);
  } catch (error) {
    console.warn("Invalid selector:", selector, error);
    return null;
  }
}

/**
 * Get all elements by CSS selector with error handling
 * @param {string} selector - CSS selector
 * @returns {NodeList|Array} Found elements or empty array
 */
export function getElementsBySelector(selector) {
  try {
    return document.querySelectorAll(selector);
  } catch (error) {
    console.warn("Invalid selector:", selector, error);
    return [];
  }
}

/**
 * Check if element exists in DOM
 * @param {Element} element - DOM element to check
 * @returns {boolean} True if element is in DOM
 */
export function isElementInDOM(element) {
  return element && document.contains(element);
}

/**
 * Get parent element with specific tag or class
 * @param {Element} element - Starting element
 * @param {string} selector - CSS selector for parent
 * @param {number} maxDepth - Maximum depth to search
 * @returns {Element|null} Found parent or null
 */
export function getParentBySelector(
  element,
  selector,
  maxDepth = PERFORMANCE.MAX_PARENT_DEPTH
) {
  let current = element;
  let depth = 0;

  while (current && depth < maxDepth) {
    current = current.parentElement;
    if (current && current.matches(selector)) {
      return current;
    }
    depth++;
  }

  return null;
}

/**
 * Get all child elements recursively
 * @param {Element} element - Parent element
 * @param {string} selector - CSS selector for children
 * @returns {Array} Array of child elements
 */
export function getAllChildrenBySelector(element, selector) {
  const children = [];
  const walker = document.createTreeWalker(
    element,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (node.matches(selector)) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
    false
  );

  let node;
  while ((node = walker.nextNode())) {
    children.push(node);
  }

  return children;
}

/**
 * Check if element has specific attribute
 * @param {Element} element - DOM element
 * @param {string} attribute - Attribute name
 * @param {string} value - Expected attribute value (optional)
 * @returns {boolean} True if element has the attribute
 */
export function hasAttribute(element, attribute, value = null) {
  if (!element || !element.hasAttribute) {
    return false;
  }

  if (value === null) {
    return element.hasAttribute(attribute);
  }

  return element.getAttribute(attribute) === value;
}

/**
 * Get element text content safely
 * @param {Element} element - DOM element
 * @returns {string} Text content or empty string
 */
export function getElementText(element) {
  if (!element) return "";

  try {
    return element.innerText?.trim() || element.textContent?.trim() || "";
  } catch (error) {
    console.warn("Error getting element text:", error);
    return "";
  }
}

/**
 * Check if element is scrollable
 * @param {Element} element - DOM element
 * @returns {boolean} True if element is scrollable
 */
export function isScrollable(element) {
  if (!element) return false;

  const style = window.getComputedStyle(element);
  const overflow = style.overflow + style.overflowX + style.overflowY;

  return overflow.includes("auto") || overflow.includes("scroll");
}

// Utility: Cache selector at removal time for robust debug overlays
export function cacheSelector(element) {
  if (!element) return "unknown";
  if (typeof element._scopeCachedSelector === "string")
    return element._scopeCachedSelector;
  let selector = "unknown";
  try {
    selector = computeUniqueCssPath(element);
  } catch {}
  element._scopeCachedSelector = selector;
  return selector;
}

/**
 * Extract a rich signature for deduplication from an element
 * @param {Element} el - DOM element
 * @returns {Object} Signature object
 */
export function extractElementSignature(el) {
  if (!el) return null;
  const text =
    el.innerText
      ?.trim()
      .toLowerCase()
      .replace(/[^\\w\s]/g, "") || "";
  const href = el.getAttribute("href") || el.getAttribute("data-action") || "";
  let icon = "";
  const img = el.querySelector("img");
  if (img && img.src) {
    icon = img.src;
  } else {
    const bg = window.getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none") icon = bg;
  }
  const parentPath = el.parentElement
    ? computeUniqueCssPath(el.parentElement)
    : "";
  return { el, text, href, icon, parentPath };
}
