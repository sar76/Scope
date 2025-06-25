/**
 * Shared types and interfaces for the DOM Extraction Chrome Extension
 * Defines common data structures used across background, content, and popup scripts
 */

/**
 * @typedef {Object} UIElement
 * @property {string} selector - CSS selector for the element
 * @property {string} tagName - HTML tag name
 * @property {string} innerText - Text content of the element
 * @property {string} role - ARIA role attribute
 * @property {Object} rect - Bounding rectangle {x, y, width, height}
 * @property {boolean} isVisible - Whether element is visible
 * @property {boolean} isInteractive - Whether element is interactive
 * @property {string} elementType - Categorized element type
 * @property {number} confidence - Confidence score for the element
 * @property {string} cssPath - Unique CSS path to the element
 */

/**
 * @typedef {Object} Rectangle
 * @property {number} x - X coordinate
 * @property {number} y - Y coordinate
 * @property {number} width - Width of rectangle
 * @property {number} height - Height of rectangle
 */

/**
 * @typedef {Object} FilterProgress
 * @property {number} step - Current step number
 * @property {string} message - Progress message
 * @property {number} percentage - Progress percentage (0-100)
 */

/**
 * @typedef {Object} LLMResponse
 * @property {string} elementType - Predicted element type
 * @property {number} confidence - Confidence score
 * @property {string} reasoning - Reasoning for the classification
 */

/**
 * @typedef {Object} MessageData
 * @property {string} action - Message action type
 * @property {*} data - Message payload
 * @property {string} [tabId] - Target tab ID
 */

/**
 * @typedef {Object} StorageData
 * @property {UIElement[]} uiData - Stored UI elements
 * @property {number} timestamp - Last update timestamp
 */

/**
 * @typedef {Object} FilterOptions
 * @property {number} iouThreshold - IoU threshold for deduplication
 * @property {number} visibilityThreshold - Visibility threshold
 * @property {boolean} includeHidden - Whether to include hidden elements
 * @property {boolean} interactiveOnly - Whether to include only interactive elements
 */

/**
 * @typedef {Object} ObserverConfig
 * @property {number} maxAttempts - Maximum observer attempts
 * @property {number} interval - Observer interval in milliseconds
 * @property {boolean} enabled - Whether observer is enabled
 */

/**
 * @typedef {Object} HighlightConfig
 * @property {string} color - Highlight color
 * @property {number} opacity - Highlight opacity
 * @property {number} duration - Highlight duration in milliseconds
 * @property {boolean} animated - Whether to animate the highlight
 */

// Export types for JSDoc usage
export const TYPES = {
  UIElement: "UIElement",
  Rectangle: "Rectangle",
  FilterProgress: "FilterProgress",
  LLMResponse: "LLMResponse",
  MessageData: "MessageData",
  StorageData: "StorageData",
  FilterOptions: "FilterOptions",
  ObserverConfig: "ObserverConfig",
  HighlightConfig: "HighlightConfig",
};
