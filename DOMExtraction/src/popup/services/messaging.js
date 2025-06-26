/**
 * Messaging service for popup to handle communication with content scripts
 * Manages message sending and response handling
 */

/**
 * Messaging service class for popup communication
 */
export class MessagingService {
  constructor() {
    this.timeout = 30000; // 30 second timeout (increased from 10)
  }

  /**
   * Send message to active tab
   * @param {number} tabId - Target tab ID
   * @param {Object} message - Message to send
   * @returns {Promise} Promise that resolves with response
   */
  async sendMessageToTab(tabId, message) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, this.timeout);

      chrome.tabs.sendMessage(tabId, message, (response) => {
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Send message to background script
   * @param {Object} message - Message to send
   * @returns {Promise} Promise that resolves with response
   */
  async sendMessageToBackground(message) {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error("Message timeout"));
      }, this.timeout);

      chrome.runtime.sendMessage(message, (response) => {
        clearTimeout(timeoutId);

        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Get active tab information
   * @returns {Promise<Object>} Promise that resolves with active tab
   */
  async getActiveTab() {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  /**
   * Check if content script is available on active tab
   * @returns {Promise<boolean>} Promise that resolves to true if content script is available
   */
  async isContentScriptAvailable() {
    try {
      const tab = await this.getActiveTab();
      if (!tab) return false;

      // Try to send a ping message
      await this.sendMessageToTab(tab.id, { action: "PING" });
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Send message with retry logic
   * @param {number} tabId - Target tab ID
   * @param {Object} message - Message to send
   * @param {number} maxRetries - Maximum number of retries
   * @returns {Promise} Promise that resolves with response
   */
  async sendMessageWithRetry(tabId, message, maxRetries = 3) {
    let lastError;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.sendMessageToTab(tabId, message);
      } catch (error) {
        lastError = error;
        console.warn(`Message attempt ${attempt} failed:`, error);

        if (attempt < maxRetries) {
          // Wait before retrying
          await this.delay(1000 * attempt);
        }
      }
    }

    throw lastError;
  }

  /**
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set message timeout
   * @param {number} timeout - Timeout in milliseconds
   */
  setTimeout(timeout) {
    this.timeout = timeout;
  }
}
