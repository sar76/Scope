/**
 * Messaging utilities for Chrome extension communication
 * Handles message sending between content script, background script, and popup
 */

import { MESSAGE_ACTIONS } from "./constants.js";
import { errorLogger, MessagingError, ERROR_CODES } from "./errors.js";

/**
 * Send UI data to background script
 * @param {Array} data - UI elements data
 * @returns {Promise} Promise that resolves when data is sent
 */
export function sendUIData(data) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: MESSAGE_ACTIONS.COLLECTED_UI,
        data: data,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          const error = new MessagingError(chrome.runtime.lastError.message, {
            action: MESSAGE_ACTIONS.COLLECTED_UI,
          });
          errorLogger.log(error, "error", { context: "sendUIData" });
          reject(error);
        } else if (response && response.success) {
          resolve(response);
        } else {
          const error = new MessagingError(response?.error || "Unknown error", {
            action: MESSAGE_ACTIONS.COLLECTED_UI,
            response,
          });
          errorLogger.log(error, "error", { context: "sendUIData" });
          reject(error);
        }
      }
    );
  });
}

/**
 * Send progress update to background script
 * @param {Object} progressData - Progress information
 * @returns {Promise} Promise that resolves when progress is sent
 */
export function sendProgressUpdate(progressData) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        action: MESSAGE_ACTIONS.PROGRESS_UPDATE,
        data: progressData,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          // Progress updates are optional, don't reject on error
          errorLogger.log(
            new MessagingError(chrome.runtime.lastError.message),
            "warn",
            { context: "sendProgressUpdate" }
          );
          resolve();
        } else {
          resolve(response);
        }
      }
    );
  });
}

/**
 * Send message to background script with timeout
 * @param {Object} message - Message to send
 * @param {number} timeout - Timeout in milliseconds
 * @returns {Promise} Promise that resolves with response or rejects on timeout
 */
export function sendMessageWithTimeout(message, timeout = 10000) {
  return Promise.race([
    new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          const error = new MessagingError(chrome.runtime.lastError.message, {
            action: message.action,
          });
          errorLogger.log(error, "error", {
            context: "sendMessageWithTimeout",
          });
          reject(error);
        } else {
          resolve(response);
        }
      });
    }),
    new Promise((_, reject) => {
      setTimeout(() => {
        const error = new MessagingError("Message timeout", {
          action: message.action,
          timeout,
        });
        errorLogger.log(error, "error", { context: "sendMessageWithTimeout" });
        reject(error);
      }, timeout);
    }),
  ]);
}

/**
 * Check if background script is available
 * @returns {Promise<boolean>} Promise that resolves to true if background is available
 */
export function isBackgroundAvailable() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ action: "PING" }, (response) => {
      resolve(!chrome.runtime.lastError);
    });
  });
}

/**
 * Send message to content script
 * @param {number} tabId - Target tab ID
 * @param {Object} message - Message to send
 * @returns {Promise} Promise that resolves with response
 */
export function sendMessageToContent(tabId, message) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, message, (response) => {
      if (chrome.runtime.lastError) {
        const error = new MessagingError(chrome.runtime.lastError.message, {
          tabId,
          action: message.action,
        });
        errorLogger.log(error, "error", { context: "sendMessageToContent" });
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}

/**
 * Send message to popup
 * @param {Object} message - Message to send
 * @returns {Promise} Promise that resolves with response
 */
export function sendMessageToPopup(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        const error = new MessagingError(chrome.runtime.lastError.message, {
          action: message.action,
        });
        errorLogger.log(error, "error", { context: "sendMessageToPopup" });
        reject(error);
      } else {
        resolve(response);
      }
    });
  });
}
