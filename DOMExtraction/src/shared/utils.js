/**
 * Shared utilities for the DOM Extraction Chrome Extension
 * Common functions used across different modules
 */

/**
 * Deep clone an object
 * @param {any} obj - Object to clone
 * @returns {any} Cloned object
 */
export function deepClone(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime());
  }

  if (obj instanceof Array) {
    return obj.map((item) => deepClone(item));
  }

  if (typeof obj === "object") {
    const cloned = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        cloned[key] = deepClone(obj[key]);
      }
    }
    return cloned;
  }

  return obj;
}

/**
 * Debounce function execution
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function execution
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
  let inThrottle;
  return function executedFunction(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

/**
 * Generate a unique ID
 * @returns {string} Unique ID
 */
export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Check if element is visible in viewport
 * @param {Element} element - DOM element to check
 * @returns {boolean} True if element is visible
 */
export function isElementVisible(element) {
  if (!element) return false;

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return (
    rect.width > 0 &&
    rect.height > 0 &&
    style.visibility !== "hidden" &&
    style.display !== "none" &&
    style.opacity !== "0"
  );
}

/**
 * Get element's computed styles
 * @param {Element} element - DOM element
 * @returns {object} Computed styles object
 */
export function getElementStyles(element) {
  if (!element) return {};

  const computed = window.getComputedStyle(element);
  const styles = {};

  for (let i = 0; i < computed.length; i++) {
    const property = computed[i];
    styles[property] = computed.getPropertyValue(property);
  }

  return styles;
}

/**
 * Calculate intersection over union (IoU) between two rectangles
 * @param {object} rect1 - First rectangle {x, y, width, height}
 * @param {object} rect2 - Second rectangle {x, y, width, height}
 * @returns {number} IoU value between 0 and 1
 */
export function calculateIoU(rect1, rect2) {
  const x1 = Math.max(rect1.x, rect2.x);
  const y1 = Math.max(rect1.y, rect2.y);
  const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
  const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);

  if (x2 <= x1 || y2 <= y1) return 0;

  const intersection = (x2 - x1) * (y2 - y1);
  const area1 = rect1.width * rect1.height;
  const area2 = rect2.width * rect2.height;
  const union = area1 + area2 - intersection;

  return intersection / union;
}

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise} Promise that resolves after the delay
 */
export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Promise that resolves with the function result
 */
export async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt === maxRetries) {
        throw error;
      }

      const delay = baseDelay * Math.pow(2, attempt);
      await sleep(delay);
    }
  }

  throw lastError;
}

/**
 * Validate URL format
 * @param {string} url - URL to validate
 * @returns {boolean} True if URL is valid
 */
export function isValidUrl(url) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize string for safe storage/transmission
 * @param {string} str - String to sanitize
 * @returns {string} Sanitized string
 */
export function sanitizeString(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[<>]/g, "").trim();
}

/**
 * Format bytes to human readable format
 * @param {number} bytes - Number of bytes
 * @returns {string} Formatted string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Get current timestamp
 * @returns {string} ISO timestamp string
 */
export function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Check if running in extension context
 * @returns {boolean} True if running in extension
 */
export function isExtensionContext() {
  return typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.id;
}
