/**
 * Popup controller component for managing UI interactions and state
 * Handles button clicks, data loading, and UI updates
 */

import { MESSAGE_ACTIONS } from "@shared/constants.js";
import { getDownloadPath, getFormattedFilename } from "@shared/config.js";
import JSZip from "jszip";

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
    this.downloadComponentsBtn = null;
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
    this.downloadComponentsBtn = document.getElementById(
      "downloadComponentsBtn"
    );
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

    // Download Components: capture and download screenshots
    this.downloadComponentsBtn.addEventListener("click", () =>
      this.handleDownloadComponents()
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
   * Handle Download Components button click
   */
  async handleDownloadComponents() {
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
          "Content script not available on this page. Please try on a regular web page."
        );
        return;
      }

      // Set longer timeout for screenshot operations
      this.messagingService.setTimeout(60000); // 60 seconds for screenshot capture

      console.log("[Scope] Popup: Starting screenshot capture process...");

      // Send CAPTURE_SCREENSHOTS message
      const response = await this.messagingService.sendMessageToTab(
        tabs[0].id,
        {
          action: "CAPTURE_SCREENSHOTS",
        }
      );

      console.log("[Scope] Popup: Received screenshot response:", response);

      if (response && response.success) {
        // Download the screenshots as a zip file
        if (response.downloadData) {
          console.log("[Scope] Popup: Starting download with downloadData...");
          await this.downloadScreenshotsZip(response.downloadData);
        } else if (response.results && response.results.downloadData) {
          console.log(
            "[Scope] Popup: Starting download with results.downloadData..."
          );
          await this.downloadScreenshotsZip(response.results.downloadData);
        } else {
          console.error(
            "[Scope] Popup: No download data found in response:",
            response
          );
          this.showError("No screenshots to download.");
        }

        this.showSuccess(
          `Screenshots captured: ${response.results?.capturedCount || 0}/${
            response.results?.totalElements || 0
          }`
        );
      } else {
        console.error("[Scope] Popup: Screenshot capture failed:", response);
        this.showError(
          "Screenshot capture failed: " + (response?.error || "Unknown error")
        );
      }
    } catch (error) {
      console.error("[Scope] Popup: Error in handleDownloadComponents:", error);
      this.showError("Error downloading components: " + error.message);
    } finally {
      // Reset timeout to default
      this.messagingService.setTimeout(30000);
      this.setLoading(false);
    }
  }

  /**
   * Download screenshots as a zip file
   * @param {Object} downloadData - Download data object
   */
  async downloadScreenshotsZip(downloadData) {
    try {
      console.log("[Scope] Popup: Starting downloadScreenshotsZip with data:", {
        folderName: downloadData.folderName,
        screenshotCount: downloadData.screenshots.length,
      });

      // Create a zip file using JSZip
      console.log("[Scope] Popup: Loading JSZip...");
      const JSZip = await this.loadJSZip();
      console.log("[Scope] Popup: JSZip loaded successfully");

      const zip = new JSZip();
      console.log("[Scope] Popup: Created new JSZip instance");

      // Create folder structure
      const folder = zip.folder(downloadData.folderName);
      console.log("[Scope] Popup: Created folder:", downloadData.folderName);

      // Add each screenshot to the zip
      console.log("[Scope] Popup: Adding screenshots to zip...");
      downloadData.screenshots.forEach((screenshot, index) => {
        console.log(
          `[Scope] Popup: Adding screenshot ${index + 1}/${
            downloadData.screenshots.length
          }:`,
          screenshot.filename
        );
        // Convert data URL to blob
        const base64Data = screenshot.dataUrl.split(",")[1];
        folder.file(screenshot.filename, base64Data, { base64: true });
      });

      // Generate zip file
      console.log("[Scope] Popup: Generating zip file...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      console.log(
        "[Scope] Popup: Zip blob created, size:",
        zipBlob.size,
        "bytes"
      );

      // Use Chrome downloads API
      console.log("[Scope] Popup: Using Chrome downloads API...");
      const url = URL.createObjectURL(zipBlob);
      console.log("[Scope] Popup: Created blob URL:", url);

      const filename = `${downloadData.folderName}_screenshots.zip`;
      console.log("[Scope] Popup: Download filename:", filename);

      // Use Chrome downloads API to save to specific folder
      console.log("[Scope] Popup: Initiating Chrome download...");

      const downloadPromise = new Promise((resolve, reject) => {
        chrome.downloads.download(
          {
            url: url,
            filename: filename,
            saveAs: false,
          },
          (downloadId) => {
            if (chrome.runtime.lastError) {
              console.error(
                "[Scope] Popup: Chrome download error:",
                chrome.runtime.lastError
              );
              reject(new Error(chrome.runtime.lastError.message));
            } else {
              console.log(
                "[Scope] Popup: Chrome download started with ID:",
                downloadId
              );
              resolve(downloadId);
            }
          }
        );
      });

      // Add timeout protection for the download
      const downloadTimeout = 30000; // 30 seconds
      const downloadId = await Promise.race([
        downloadPromise,
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Download timeout")),
            downloadTimeout
          )
        ),
      ]);

      console.log(
        "[Scope] Popup: Chrome download completed successfully with ID:",
        downloadId
      );

      // Clean up the blob URL
      URL.revokeObjectURL(url);
      console.log("[Scope] Popup: Blob URL revoked");

      console.log(
        `[Scope] Popup: Successfully initiated download for ${downloadData.screenshots.length} screenshots`
      );
      return true;
    } catch (error) {
      console.error("[Scope] Popup: Error downloading screenshots:", error);
      console.error("[Scope] Popup: Error stack:", error.stack);
      throw error;
    }
  }

  /**
   * Load JSZip library
   * @returns {Promise<JSZip>} Promise that resolves with JSZip instance
   */
  async loadJSZip() {
    // JSZip should be available from the bundle
    if (typeof JSZip !== "undefined") {
      return JSZip;
    }

    // If not available, try to load it dynamically
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js";
      script.onload = () => {
        if (typeof JSZip !== "undefined") {
          resolve(JSZip);
        } else {
          reject(new Error("JSZip failed to load"));
        }
      };
      script.onerror = () => reject(new Error("Failed to load JSZip"));
      document.head.appendChild(script);
    });
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
   * Set loading state for UI elements
   * @param {boolean} isLoading - Whether to show loading state
   */
  setLoading(isLoading) {
    this.isProcessing = isLoading;

    // Update button states
    this.runInspectBtn.disabled = isLoading;
    this.stopInspectBtn.disabled = !isLoading;
    this.refreshBtn.disabled = isLoading;
    this.filterBtn.disabled = isLoading;
    this.toggleDebugBtn.disabled = isLoading;
    this.downloadComponentsBtn.disabled = isLoading;

    // Update button text
    if (isLoading) {
      this.runInspectBtn.textContent = "Processing...";
    } else {
      this.runInspectBtn.textContent = "Run Inspect";
    }
  }

  /**
   * Show success message
   * @param {string} message - Success message to display
   */
  showSuccess(message) {
    // Create a temporary success notification
    const notification = document.createElement("div");
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 999999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 300px;
      word-wrap: break-word;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.remove();
      }
    }, 3000);
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

      // Enable download button when filtering is completed (step 24)
      if (step >= 24) {
        this.downloadComponentsBtn.disabled = false;
        this.hideFilteringProgress();
      }
    }
  }

  /**
   * Render the list of UI elements in the popup
   * @param {Array} uiData - Array of UI element objects
   */
  renderUIList(uiData) {
    const listContainerId = "scopeResultsList";
    let listContainer = document.getElementById(listContainerId);
    if (!listContainer) {
      // Create the container if it doesn't exist
      listContainer = document.createElement("div");
      listContainer.id = listContainerId;
      listContainer.style.marginTop = "16px";
      // Insert after the header or at the top
      const header = document.querySelector(".scope-header") || document.body;
      header.parentNode.insertBefore(listContainer, header.nextSibling);
    }
    // Clear previous content
    listContainer.innerHTML = "";

    if (!uiData || uiData.length === 0) {
      listContainer.textContent = "No UI elements found.";
      return;
    }

    // Render each UI element in debugger-style summary
    uiData.forEach((el, idx) => {
      const item = document.createElement("div");
      item.className = "scope-ui-list-item";
      item.style.cssText = `
        padding: 8px 16px;
        border-bottom: 1px solid #f0f0f0;
        cursor: pointer;
        font-size: 14px;
        background: #fff;
        transition: background 0.2s;
        line-height: 1.5;
      `;
      // Build summary line
      const tagName = el.tagName || el.tag || "ELEMENT";
      let size = "";
      if (el.boundingRect && el.boundingRect.width && el.boundingRect.height) {
        size = ` (${Math.round(el.boundingRect.width)}x${Math.round(
          el.boundingRect.height
        )})`;
      }
      const role = el.role ? ` [role=\"${el.role}\"]` : "";
      let selector = el.selector || el.xpath || "";
      if (selector.length > 40) selector = selector.substring(0, 40) + "...";
      selector = selector ? ` - ${selector}` : "";
      let text = el.text || "";
      if (text.length > 30) text = text.substring(0, 30) + "...";
      text = text ? ` - \"${text}\"` : "";
      let ariaLabel = el.ariaLabel || "";
      if (ariaLabel && ariaLabel !== el.text) {
        if (ariaLabel.length > 20)
          ariaLabel = ariaLabel.substring(0, 20) + "...";
        ariaLabel = ` [aria-label=\"${ariaLabel}\"]`;
      } else {
        ariaLabel = "";
      }
      item.textContent = `${
        idx + 1
      }. ${tagName}${size}${role}${selector}${text}${ariaLabel}`;
      item.title = el.selector || el.xpath || "";
      // Highlight on hover/click
      item.addEventListener("mouseenter", () => {
        this.highlightElement(el);
      });
      item.addEventListener("mouseleave", () => {
        this.unhighlightElement(el);
      });
      item.addEventListener("click", () => {
        this.highlightElement(el, true);
      });
      listContainer.appendChild(item);
    });
  }

  /**
   * Highlight a UI element in the page
   * @param {Object} el - UI element object
   * @param {boolean} scrollIntoView - Whether to scroll to the element
   */
  highlightElement(el, scrollIntoView = false) {
    // Send a message to the content script to highlight the element
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "HIGHLIGHT_ELEMENT",
        element: el,
        scrollIntoView,
      });
    });
  }

  /**
   * Remove highlight from a UI element
   * @param {Object} el - UI element object
   */
  unhighlightElement(el) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (!tabs[0]) return;
      chrome.tabs.sendMessage(tabs[0].id, {
        action: "UNHIGHLIGHT_ELEMENT",
        element: el,
      });
    });
  }
}
