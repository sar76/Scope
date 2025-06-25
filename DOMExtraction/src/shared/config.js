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
