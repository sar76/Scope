/**
 * Configuration management for the DOM Extraction Chrome Extension
 * Handles environment variables, API keys, and runtime configuration
 */

import { LLM_CONFIG } from "./constants.js";

/**
 * Get environment variable with fallback
 * @param {string} key - Environment variable key
 * @param {string} defaultValue - Default value if not found
 * @returns {string} Environment variable value or default
 */
function getEnvVar(key, defaultValue = "") {
  // In browser extension context, we need to handle this differently
  // For now, we'll use a simple approach that can be enhanced later
  return defaultValue;
}

/**
 * Configuration object with environment-aware settings
 */
export const CONFIG = {
  // API Configuration
  api: {
    openai: {
      apiKey: getEnvVar("OPENAI_API_KEY", ""),
      model: LLM_CONFIG.openai.model,
      maxTokens: LLM_CONFIG.openai.maxTokens,
      temperature: LLM_CONFIG.openai.temperature,
      endpoint: LLM_CONFIG.openai.endpoint,
    },
  },

  // Environment
  env: {
    isDevelopment: getEnvVar("NODE_ENV", "production") === "development",
    isProduction: getEnvVar("NODE_ENV", "production") === "production",
    debug: getEnvVar("DEBUG", "false") === "true",
  },

  // Build Configuration
  build: {
    mode: getEnvVar("BUILD_MODE", "production"),
    version: "1.0.0",
  },
};

/**
 * Validate configuration
 * @returns {boolean} True if configuration is valid
 */
export function validateConfig() {
  const errors = [];

  if (!CONFIG.api.openai.apiKey && CONFIG.env.isProduction) {
    errors.push("OpenAI API key is required in production");
  }

  if (errors.length > 0) {
    console.warn("Configuration validation errors:", errors);
    return false;
  }

  return true;
}

/**
 * Get configuration for a specific module
 * @param {string} module - Module name
 * @returns {object} Module-specific configuration
 */
export function getModuleConfig(module) {
  const moduleConfigs = {
    llm: CONFIG.api.openai,
    debug: CONFIG.env,
    build: CONFIG.build,
  };

  return moduleConfigs[module] || {};
}

/**
 * User-configurable settings for the DOM Extraction Chrome Extension
 * Users can modify these settings to customize the extension behavior
 */

// Download Configuration
export const DOWNLOAD_CONFIG = {
  // Default download folder relative to user's home directory
  // Users can modify this to change where screenshots are saved
  DEFAULT_FOLDER: "Desktop/Scope/webuicomponents",

  // Alternative download locations (users can uncomment and modify)
  // ALTERNATIVE_FOLDERS: [
  //   "Documents/Scope/Screenshots",
  //   "Downloads/Scope",
  //   "Desktop/WebComponents"
  // ],

  // File naming configuration
  FILENAME_PREFIX: "scope_",
  FILENAME_SUFFIX: "_screenshots",

  // ZIP file configuration
  ZIP_COMPRESSION: true,
  ZIP_LEVEL: 6, // 0-9, higher = more compression but slower
};

// UI Configuration
export const UI_CONFIG = {
  // Highlight colors
  HIGHLIGHT_COLOR: "#007bff",
  HIGHLIGHT_BORDER_COLOR: "#0056b3",
  HIGHLIGHT_OPACITY: 0.3,

  // Debug overlay colors
  DEBUG_COLOR: "#ff6b6b",
  DEBUG_BORDER_COLOR: "#e74c3c",
  DEBUG_OPACITY: 0.2,

  // Animation settings
  ANIMATION_DURATION: 300,
  HIGHLIGHT_FADE_IN: 200,
  HIGHLIGHT_FADE_OUT: 150,
};

// Performance Configuration
export const PERFORMANCE_CONFIG = {
  // Screenshot capture settings
  SCREENSHOT_DELAY: 100, // ms between screenshots
  SCREENSHOT_TIMEOUT: 5000, // ms timeout for screenshot capture

  // Processing settings
  BATCH_SIZE: 5,
  DELAY_BETWEEN_BATCHES: 100,

  // Memory management
  MAX_SCREENSHOTS_IN_MEMORY: 50,
  CLEANUP_INTERVAL: 30000, // ms
};

// Feature Configuration
export const FEATURE_CONFIG = {
  // Enable/disable features
  ENABLE_SCREENSHOTS: true,
  ENABLE_DEBUG_MODE: true,
  ENABLE_PROGRESS_BAR: true,
  ENABLE_AUTO_SAVE: true,

  // Screenshot quality settings
  SCREENSHOT_QUALITY: 0.9, // 0-1, higher = better quality but larger files
  SCREENSHOT_FORMAT: "image/png", // "image/png" or "image/jpeg"

  // Organization settings
  CREATE_SUBFOLDERS: true,
  USE_SITE_URL_AS_FOLDER: true,
  INCLUDE_TIMESTAMP: true,
};

// Export all configurations
export const USER_CONFIG = {
  download: DOWNLOAD_CONFIG,
  ui: UI_CONFIG,
  performance: PERFORMANCE_CONFIG,
  features: FEATURE_CONFIG,
};

// Helper function to get download path
export function getDownloadPath() {
  return DOWNLOAD_CONFIG.DEFAULT_FOLDER;
}

// Helper function to get formatted filename
export function getFormattedFilename(siteUrl, timestamp = null) {
  const url = new URL(siteUrl);
  const hostname = url.hostname.replace(/[^a-zA-Z0-9]/g, "_");
  const timeStr =
    timestamp || new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

  return `${DOWNLOAD_CONFIG.FILENAME_PREFIX}${hostname}${DOWNLOAD_CONFIG.FILENAME_SUFFIX}_${timeStr}`;
}
