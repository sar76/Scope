/**
 * Error handling and logging system for the DOM Extraction Chrome Extension
 * Provides consistent error handling across all modules
 */

/**
 * Custom error classes for different types of errors
 */
export class ExtensionError extends Error {
  constructor(message, code, details = {}) {
    super(message);
    this.name = "ExtensionError";
    this.code = code;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export class CollectionError extends ExtensionError {
  constructor(message, details = {}) {
    super(message, "COLLECTION_ERROR", details);
    this.name = "CollectionError";
  }
}

export class FilterError extends ExtensionError {
  constructor(message, details = {}) {
    super(message, "FILTER_ERROR", details);
    this.name = "FilterError";
  }
}

export class MessagingError extends ExtensionError {
  constructor(message, details = {}) {
    super(message, "MESSAGING_ERROR", details);
    this.name = "MessagingError";
  }
}

export class StorageError extends ExtensionError {
  constructor(message, details = {}) {
    super(message, "STORAGE_ERROR", details);
    this.name = "StorageError";
  }
}

export class APIError extends ExtensionError {
  constructor(message, details = {}) {
    super(message, "API_ERROR", details);
    this.name = "APIError";
  }
}

/**
 * Error codes for consistent error handling
 */
export const ERROR_CODES = {
  // Collection errors
  ELEMENT_NOT_FOUND: "ELEMENT_NOT_FOUND",
  INVALID_SELECTOR: "INVALID_SELECTOR",
  COLLECTION_TIMEOUT: "COLLECTION_TIMEOUT",

  // Filter errors
  FILTER_CONFIG_INVALID: "FILTER_CONFIG_INVALID",
  FILTER_PIPELINE_FAILED: "FILTER_PIPELINE_FAILED",

  // Messaging errors
  MESSAGE_TIMEOUT: "MESSAGE_TIMEOUT",
  INVALID_MESSAGE_FORMAT: "INVALID_MESSAGE_FORMAT",
  RESPONSE_FAILED: "RESPONSE_FAILED",

  // Storage errors
  STORAGE_QUOTA_EXCEEDED: "STORAGE_QUOTA_EXCEEDED",
  STORAGE_ACCESS_DENIED: "STORAGE_ACCESS_DENIED",
  DATA_CORRUPTION: "DATA_CORRUPTION",

  // API errors
  API_RATE_LIMIT: "API_RATE_LIMIT",
  API_AUTHENTICATION_FAILED: "API_AUTHENTICATION_FAILED",
  API_TIMEOUT: "API_TIMEOUT",
  API_INVALID_RESPONSE: "API_INVALID_RESPONSE",
};

/**
 * Error logger with different log levels
 */
export class ErrorLogger {
  constructor(options = {}) {
    this.enableConsole = options.enableConsole !== false;
    this.enableStorage = options.enableStorage !== false;
    this.maxLogEntries = options.maxLogEntries || 100;
  }

  /**
   * Log an error with appropriate level
   * @param {Error} error - Error to log
   * @param {string} level - Log level (error, warn, info, debug)
   * @param {object} context - Additional context
   */
  log(error, level = "error", context = {}) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      error: {
        name: error.name,
        message: error.message,
        code: error.code || "UNKNOWN",
        stack: error.stack,
        details: error.details || {},
      },
      context,
    };

    if (this.enableConsole) {
      this.logToConsole(logEntry);
    }

    if (this.enableStorage) {
      this.logToStorage(logEntry);
    }
  }

  /**
   * Log to console with appropriate formatting
   * @param {object} logEntry - Log entry to output
   */
  logToConsole(logEntry) {
    const { level, error, context } = logEntry;

    const consoleMethod =
      level === "error"
        ? "error"
        : level === "warn"
        ? "warn"
        : level === "info"
        ? "info"
        : "log";

    console[consoleMethod](
      `[${logEntry.timestamp}] ${level.toUpperCase()}: ${error.name}: ${
        error.message
      }`,
      { code: error.code, details: error.details, context }
    );
  }

  /**
   * Log to storage for persistence
   * @param {object} logEntry - Log entry to store
   */
  async logToStorage(logEntry) {
    try {
      const logs = await this.getStoredLogs();
      logs.push(logEntry);

      // Keep only the most recent logs
      if (logs.length > this.maxLogEntries) {
        logs.splice(0, logs.length - this.maxLogEntries);
      }

      await chrome.storage.local.set({ errorLogs: logs });
    } catch (storageError) {
      console.error("Failed to store error log:", storageError);
    }
  }

  /**
   * Get stored error logs
   * @returns {Array} Array of stored log entries
   */
  async getStoredLogs() {
    try {
      const result = await chrome.storage.local.get("errorLogs");
      return result.errorLogs || [];
    } catch (error) {
      console.error("Failed to retrieve error logs:", error);
      return [];
    }
  }

  /**
   * Clear stored error logs
   */
  async clearLogs() {
    try {
      await chrome.storage.local.remove("errorLogs");
    } catch (error) {
      console.error("Failed to clear error logs:", error);
    }
  }
}

/**
 * Global error logger instance
 */
export const errorLogger = new ErrorLogger({
  enableConsole: true,
  enableStorage: true,
  maxLogEntries: 100,
});

/**
 * Error handler wrapper for async functions
 * @param {Function} fn - Function to wrap
 * @param {string} context - Context for error logging
 * @returns {Function} Wrapped function with error handling
 */
export function withErrorHandling(fn, context = "") {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (error) {
      errorLogger.log(error, "error", { context, args });
      throw error;
    }
  };
}

/**
 * Create a standardized error response
 * @param {Error} error - Error object
 * @returns {object} Standardized error response
 */
export function createErrorResponse(error) {
  return {
    success: false,
    error: {
      message: error.message,
      code: error.code || "UNKNOWN_ERROR",
      name: error.name,
    },
    timestamp: new Date().toISOString(),
  };
}
