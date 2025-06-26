/**
 * Message handler for background script
 * Processes messages from content scripts and popup
 */

import { MESSAGE_ACTIONS } from "@shared/constants.js";
import { saveUIData } from "./storage.js";

/**
 * Handle incoming messages from content scripts and popup
 * @param {Object} message - Message object
 * @param {Object} sender - Sender information
 * @param {Function} sendResponse - Response callback
 * @returns {boolean} True if response will be sent asynchronously
 */
export function handleMessage(message, sender, sendResponse) {
  console.log("Background received message:", message.action);

  switch (message.action) {
    case MESSAGE_ACTIONS.COLLECTED_UI:
      // Use async IIFE to properly handle the async function
      (async () => {
        try {
          await handleCollectedUI(message.data, sendResponse);
        } catch (error) {
          console.error("Error in handleCollectedUI:", error);
          sendResponse({ success: false, error: error.message });
        }
      })();
      return true; // Will call sendResponse asynchronously

    case MESSAGE_ACTIONS.PROGRESS_UPDATE:
      handleProgressUpdate(message.data, sender.tab?.id);
      return false;

    case MESSAGE_ACTIONS.CAPTURE_VISIBLE_TAB:
      console.log(
        "[Scope] CAPTURE_VISIBLE_TAB handler called. Sender:",
        sender
      );
      handleCaptureVisibleTab(sendResponse, sender);
      return true;

    default:
      console.warn("Unknown message action:", message.action);
      sendResponse({ success: false, error: "Unknown action" });
      return false;
  }
}

/**
 * Handle UI data collected from content script
 * @param {Array} data - Collected UI elements
 * @param {Function} sendResponse - Response callback
 */
async function handleCollectedUI(data, sendResponse) {
  try {
    await saveUIData(data);
    console.log("UI data saved successfully");
    sendResponse({ success: true });
  } catch (error) {
    console.error("Error saving UI data:", error);
    sendResponse({ success: false, error: error.message });
  }
}

/**
 * Handle progress updates from content script
 * @param {Object} progressData - Progress information
 * @param {number} tabId - Source tab ID
 */
function handleProgressUpdate(progressData, tabId) {
  // Forward progress updates to popup if it's open
  chrome.runtime
    .sendMessage({
      action: MESSAGE_ACTIONS.PROGRESS_UPDATE,
      data: progressData,
      tabId: tabId,
    })
    .catch(() => {
      // Popup might not be open, ignore error
    });
}

/**
 * Handle CAPTURE_VISIBLE_TAB message
 * @param {Function} sendResponse - Response callback
 */
function handleCaptureVisibleTab(sendResponse, sender) {
  try {
    const windowId =
      sender && sender.tab && sender.tab.windowId ? sender.tab.windowId : null;
    console.log(
      "[Scope] handleCaptureVisibleTab: calling chrome.tabs.captureVisibleTab, windowId:",
      windowId
    );
    chrome.tabs.captureVisibleTab(
      windowId,
      { format: "png", quality: 100 },
      (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error(
            "[Scope] Error capturing visible tab:",
            chrome.runtime.lastError
          );
          sendResponse({
            success: false,
            error: chrome.runtime.lastError.message,
          });
        } else if (!dataUrl) {
          console.error("[Scope] captureVisibleTab returned no dataUrl");
          sendResponse({
            success: false,
            error: "No screenshot data returned",
          });
        } else {
          console.log(
            "[Scope] captureVisibleTab success, dataUrl length:",
            dataUrl.length
          );
          sendResponse({ success: true, dataUrl });
        }
      }
    );
  } catch (error) {
    console.error("[Scope] Exception in handleCaptureVisibleTab:", error);
    sendResponse({ success: false, error: error.message });
  }
}
