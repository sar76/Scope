/**
 * Shared constants and configuration for the DOM Extraction Chrome Extension
 * Centralized configuration for selectors, thresholds, and behavior settings
 */

// DOM Selectors
export const SELECTORS = {
  EDITOR_CONTAINER: "div[data-test-id='editor-container']",
  EDITOR_ROOT: "div[class*='editor-root']",
  HIGHLIGHT_OVERLAY: "__uiInspectorHighlight",
};

// Filtering Thresholds
export const THRESHOLDS = {
  IOU_CONTAINMENT: 0.7,
  IOU_DEDUPE: 0.9,
  VISIBILITY_POINTS: 0.6,
  SEMANTIC_SIMILARITY: 0.8,
  FUNCTIONAL_SIMILARITY: 0.9,
  LIGHT_DEDUPE: 0.95,
  REPEATED_CONTAINERS: 3,
  VIEWPORT_MARGIN: 50,
  MIN_SURVIVORS_PER_STAGE: 3,
  MIN_AREA: 100, // Minimum bounding box area in square pixels
};

// Element Collections
export const ALLOWED_TAGS = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "nav",
  "header",
  "footer",
  "section",
  "article",
  "aside",
  "main",
  "a",
  "label",
  "form",
  "fieldset",
  "legend",
  "optgroup",
  "option",
  "div",
  "span",
]);

export const ALLOWED_ROLES = new Set([
  "button",
  "link",
  "navigation",
  "search",
  "banner",
  "contentinfo",
  "main",
  "menuitem",
  "tab",
  "checkbox",
  "radio",
  "textbox",
  "combobox",
  "listbox",
  "option",
  "menubar",
  "toolbar",
  "grid",
  "tree",
  "treeitem",
]);

export const INTERACTIVE_TAGS = new Set([
  "button",
  "input",
  "select",
  "textarea",
  "a",
  "label",
]);

// Performance Settings
export const PERFORMANCE = {
  BATCH_SIZE: 5,
  DELAY_BETWEEN_BATCHES: 100,
  MAX_OBSERVER_ATTEMPTS: 10,
  OBSERVER_INTERVAL: 300,
  MAX_PARENT_DEPTH: 5,
};

// Debug Settings
export const DEBUG = {
  TOP_LEVEL_FILTER: false,
  ENABLE_LOGGING: true,
};

// LLM Configuration
export const LLM_CONFIG = {
  provider: "openai",
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    model: "gpt-3.5-turbo",
    maxTokens: 10,
    temperature: 0.1,
    endpoint: "https://api.openai.com/v1/chat/completions",
  },
  fallback: {
    enabled: true,
    useRuleBased: true,
    logWarnings: true,
  },
  performance: {
    batchSize: 1,
    delayBetweenBatches: 2000,
    timeout: 10000,
    retryAttempts: 3,
  },
};

// Message Actions
export const MESSAGE_ACTIONS = {
  RUN_INSPECT: "RUN_INSPECT",
  STOP_INSPECT: "STOP_INSPECT",
  COLLECTED_UI: "COLLECTED_UI",
  COMPREHENSIVE_FILTER: "COMPREHENSIVE_FILTER",
  PROGRESS_UPDATE: "PROGRESS_UPDATE",
  CAPTURE_SCREENSHOTS: "CAPTURE_SCREENSHOTS",
  CAPTURE_VISIBLE_TAB: "CAPTURE_VISIBLE_TAB",
};
