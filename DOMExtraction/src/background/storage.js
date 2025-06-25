/**
 * Storage utilities for background script
 * Manages Chrome storage operations for UI data
 */

/**
 * Save UI data to Chrome storage
 * @param {Array} data - UI elements data to save
 * @returns {Promise} Promise that resolves when data is saved
 */
export function saveUIData(data) {
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
 * Get UI data from Chrome storage
 * @returns {Promise<Object>} Promise that resolves with stored data
 */
export function getUIData() {
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
 * Clear UI data from Chrome storage
 * @returns {Promise} Promise that resolves when data is cleared
 */
export function clearUIData() {
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
 * Set up storage change listeners
 */
export function setupStorage() {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local") {
      console.log("Storage changed:", changes);

      // Notify popup of storage changes
      chrome.runtime
        .sendMessage({
          action: "STORAGE_CHANGED",
          changes: changes,
        })
        .catch(() => {
          // Popup might not be open, ignore error
        });
    }
  });
}
