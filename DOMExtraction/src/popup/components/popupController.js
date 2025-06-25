/**
 * Popup controller component for managing UI interactions and state
 * Handles button clicks, data loading, and UI updates
 */

import { MESSAGE_ACTIONS } from "@shared/constants.js";

/**
 * Popup controller class for managing UI interactions
 */
export class PopupController {
  constructor(storageService, messagingService) {
    this.storageService = storageService;
    this.messagingService = messagingService;
    this.isProcessing = false;
    this.lastSelectors = [];
    // Only keep button references
    this.runInspectBtn = null;
    this.stopInspectBtn = null;
    this.refreshBtn = null;
    this.filterBtn = null;
    this.toggleDebugBtn = null;
  }

  /**
   * Initialize popup controller
   */
  initialize() {
    this.initializeElements();
    this.setupEventListeners();
    this.loadUIData(); // Initial data load
  }

  /**
   * Initialize DOM element references
   */
  initializeElements() {
    this.runInspectBtn = document.getElementById("runInspectBtn");
    this.stopInspectBtn = document.getElementById("stopInspectBtn");
    this.refreshBtn = document.getElementById("refreshBtn");
    this.filterBtn = document.getElementById("filterBtn");
    this.toggleDebugBtn = document.getElementById("toggleDebugBtn");
  }

  /**
   * Set up event listeners for UI interactions
   */
  setupEventListeners() {
    // Run Inspect: send RUN_INSPECT to content script
    this.runInspectBtn.addEventListener("click", () => this.handleRunInspect());

    // Stop Inspect: send STOP_INSPECT to content script
    this.stopInspectBtn.addEventListener("click", () =>
      this.handleStopInspect()
    );

    // Refresh: reload storage data
    this.refreshBtn.addEventListener("click", () => this.handleRefresh());

    // Filter Visible: send current selectors to content script, then re-render
    this.filterBtn.addEventListener("click", () => this.handleFilter());

    // Toggle Debug: show/hide debug overlay
    this.toggleDebugBtn.addEventListener("click", () =>
      this.handleToggleDebug()
    );

    // Storage change listener
    chrome.storage.onChanged.addListener((changes, area) =>
      this.handleStorageChange(changes, area)
    );

    // Progress update listener for comprehensive filtering
    chrome.runtime.onMessage.addListener((message) =>
      this.handleProgressUpdate(message)
    );
  }

  /**
   * Handle Run Inspect button click
   */
  async handleRunInspect() {
    if (this.isProcessing) return;
    this.setLoading(true);
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]) {
        this.setLoading(false);
        this.showError("No active tab found");
        return;
      }
      const isContentScriptAvailable =
        await this.messagingService.isContentScriptAvailable();
      if (!isContentScriptAvailable) {
        this.setLoading(false);
        this.showError(
          "Content script not available on this page. Please try on a regular web page (not chrome://, chrome-extension://, or other restricted pages)."
        );
        return;
      }
      // Send RUN_INSPECT
      const response = await this.messagingService.sendMessageToTab(
        tabs[0].id,
        { action: MESSAGE_ACTIONS.RUN_INSPECT }
      );
      if (response && response.success) {
        // Save selectors for filtering
        // We'll ask the content script for the selectors after scan
        this.lastSelectors = null; // Will be set by a new message
        // Enable filter button
        this.filterBtn.disabled = false;
      } else {
        this.showError(
          "Inspection failed: " + (response?.error || "Unknown error")
        );
      }
    } catch (error) {
      this.showError("Error running inspect: " + error.message);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Handle Stop Inspect button click
   */
  async handleStopInspect() {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]) return;

      await this.messagingService.sendMessageToTab(tabs[0].id, {
        action: MESSAGE_ACTIONS.STOP_INSPECT,
      });
      this.setLoading(false);
    } catch (error) {
      console.error("Error stopping inspect:", error);
    }
  }

  /**
   * Handle Refresh button click
   */
  handleRefresh() {
    if (this.isProcessing) return;
    this.loadUIData();
  }

  /**
   * Handle Filter button click with comprehensive filtering and loading bar
   */
  async handleFilter() {
    if (this.isProcessing) return;
    this.setLoading(true);
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]) {
        this.setLoading(false);
        return;
      }
      // Ask the content script for the selectors from the last scan
      // We'll use a new message type to get the selectors
      const selectorsResp = await this.messagingService.sendMessageToTab(
        tabs[0].id,
        { action: "GET_LAST_SELECTORS" }
      );
      const selectors =
        selectorsResp && Array.isArray(selectorsResp.selectors)
          ? selectorsResp.selectors
          : [];
      if (selectors.length === 0) {
        this.setLoading(false);
        this.showError("No selectors available to filter. Run Inspect first.");
        return;
      }
      // Send COMPREHENSIVE_FILTER
      await this.messagingService.sendMessageToTab(tabs[0].id, {
        action: MESSAGE_ACTIONS.COMPREHENSIVE_FILTER,
        selectors: selectors,
      });
      // Disable filter button until next scan
      this.filterBtn.disabled = true;
    } catch (error) {
      this.showError("Error running filter: " + error.message);
    } finally {
      this.setLoading(false);
    }
  }

  /**
   * Handle Toggle Debug button click
   */
  async handleToggleDebug() {
    try {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tabs[0]) return;

      await this.messagingService.sendMessageToTab(tabs[0].id, {
        action: "TOGGLE_DEBUG_OVERLAY",
      });
    } catch (error) {
      console.error("Error toggling debug overlay:", error);
    }
  }

  /**
   * Show filtering progress bar with step updates
   */
  showFilteringProgress() {
    const progressContainer = document.createElement("div");
    progressContainer.id = "filteringProgress";
    progressContainer.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #007bff;
      color: white;
      padding: 8px;
      text-align: center;
      font-size: 12px;
      z-index: 1000;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    `;

    const progressBar = document.createElement("div");
    progressBar.id = "progressBar";
    progressBar.style.cssText = `
      width: 0%;
      height: 4px;
      background: #fff;
      margin-top: 4px;
      transition: width 0.3s ease;
    `;

    const progressText = document.createElement("div");
    progressText.id = "progressText";
    progressText.textContent = "Starting comprehensive filtering...";

    progressContainer.appendChild(progressText);
    progressContainer.appendChild(progressBar);
    document.body.appendChild(progressContainer);

    // Start progress updates
    this.updateFilteringProgress(
      0,
      "Step 1: Top-level filtering with fixpoint iteration..."
    );
  }

  /**
   * Update filtering progress
   * @param {number} step - Current step (0-24)
   * @param {string} message - Progress message
   */
  updateFilteringProgress(step, message) {
    const progressText = document.getElementById("progressText");
    const progressBar = document.getElementById("progressBar");

    if (progressText && progressBar) {
      progressText.textContent = message;
      const percentage = Math.round((step / 24) * 100);
      progressBar.style.width = `${percentage}%`;
    }
  }

  /**
   * Hide filtering progress bar
   */
  hideFilteringProgress() {
    const progressContainer = document.getElementById("filteringProgress");
    if (progressContainer) {
      progressContainer.remove();
    }
  }

  /**
   * Handle storage changes
   * @param {Object} changes - Storage changes
   * @param {string} area - Storage area
   */
  handleStorageChange(changes, area) {
    if (area === "local" && changes.uiData) {
      console.log("Storage changed, updating UI...");
      this.loadUIData();
    }
  }

  /**
   * Set loading state
   * @param {boolean} isLoading - Whether to show loading state
   */
  setLoading(isLoading) {
    this.isProcessing = isLoading;

    this.runInspectBtn.disabled = isLoading;
    this.stopInspectBtn.disabled = !isLoading;
    this.refreshBtn.disabled = isLoading;

    if (isLoading) {
      this.runInspectBtn.innerHTML =
        '<span class="loading"></span>Processing...';
    } else {
      this.runInspectBtn.innerHTML = "Run Inspect";
    }
  }

  /**
   * Load UI data from storage
   */
  async loadUIData() {
    try {
      const data = await this.storageService.getUIData();
      this.latestUIData = data.uiData || [];
      this.renderUIList(this.latestUIData);

      // Enable filter button if we have data
      this.filterBtn.disabled = this.latestUIData.length === 0;
    } catch (error) {
      console.error("Error loading UI data:", error);
      this.renderUIList([]);
    }
  }

  /**
   * Show error message to user
   * @param {string} message - Error message to display
   */
  showError(message) {
    // Create error element
    const errorDiv = document.createElement("div");
    errorDiv.style.cssText = `
      position: fixed;
      top: 10px;
      left: 10px;
      right: 10px;
      background: #dc3545;
      color: white;
      padding: 12px;
      border-radius: 6px;
      font-size: 14px;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    `;
    errorDiv.textContent = message;
    errorDiv.id = "errorMessage";

    // Add to body
    document.body.appendChild(errorDiv);

    // Remove after 5 seconds
    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.remove();
      }
    }, 5000);
  }

  /**
   * Handle progress update messages
   * @param {Object} message - Progress message
   */
  handleProgressUpdate(message) {
    if (message.action === MESSAGE_ACTIONS.PROGRESS_UPDATE) {
      const { step, message: progressMessage } = message.data;
      this.updateFilteringProgress(step, progressMessage);
    }
  }
}
