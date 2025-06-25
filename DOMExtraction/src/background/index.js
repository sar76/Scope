/**
 * Background script entry point for DOM Extraction Chrome Extension
 * Handles message routing, storage management, and service worker lifecycle
 */

import { MESSAGE_ACTIONS } from "@shared/constants.js";
import { handleMessage } from "./messageHandler.js";
import { setupStorage } from "./storage.js";

// Initialize background script
function initialize() {
  console.log("Background script initialized");

  // Set up storage handlers
  setupStorage();

  // Set up message listeners
  chrome.runtime.onMessage.addListener(handleMessage);

  // Optional: Handle action button clicks (when popup is not set)
  chrome.action.onClicked.addListener((tab) => {
    chrome.tabs.sendMessage(tab.id, { action: MESSAGE_ACTIONS.RUN_INSPECT });
  });
}

// Initialize when service worker loads
initialize();
