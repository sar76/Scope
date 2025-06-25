/**
 * Storage service for popup to manage Chrome storage operations
 * Handles data retrieval and storage for UI elements
 */

/**
 * Storage service class for popup storage operations
 */
export class StorageService {
  constructor() {
    this.cache = new Map();
  }

  /**
   * Get UI data from Chrome storage
   * @returns {Promise<Object>} Promise that resolves with stored data
   */
  async getUIData() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.get(["uiData", "timestamp"], (result) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve({
            uiData: result.uiData || [],
            timestamp: result.timestamp || 0,
          });
        }
      });
    });
  }

  /**
   * Save UI data to Chrome storage
   * @param {Array} data - UI elements data to save
   * @returns {Promise} Promise that resolves when data is saved
   */
  async saveUIData(data) {
    return new Promise((resolve, reject) => {
      const storageData = {
        uiData: data,
        timestamp: Date.now(),
      };

      chrome.storage.local.set(storageData, () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Clear UI data from Chrome storage
   * @returns {Promise} Promise that resolves when data is cleared
   */
  async clearUIData() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.remove(["uiData", "timestamp"], () => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get storage usage information
   * @returns {Promise<Object>} Promise that resolves with storage usage
   */
  async getStorageUsage() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.getBytesInUse(null, (bytesInUse) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve({
            bytesInUse: bytesInUse,
            quotaBytes: chrome.storage.local.QUOTA_BYTES,
          });
        }
      });
    });
  }

  /**
   * Check if storage is available
   * @returns {Promise<boolean>} Promise that resolves to true if storage is available
   */
  async isStorageAvailable() {
    try {
      await this.getStorageUsage();
      return true;
    } catch (error) {
      console.warn("Storage not available:", error);
      return false;
    }
  }

  /**
   * Clear storage cache
   */
  clearCache() {
    this.cache.clear();
  }
}
