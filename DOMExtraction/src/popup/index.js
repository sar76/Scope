/**
 * Popup entry point for DOM Extraction Chrome Extension
 * Handles UI interactions and data management for the popup interface
 */

import { PopupController } from "./components/popupController.js";
import { StorageService } from "./services/storage.js";
import { MessagingService } from "./services/messaging.js";

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  const storageService = new StorageService();
  const messagingService = new MessagingService();
  const popupController = new PopupController(storageService, messagingService);

  popupController.initialize();
});
