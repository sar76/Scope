/**
 * Screenshot service for capturing element screenshots
 * Handles element screenshot capture, folder organization, and download
 */

/**
 * Screenshot service class for capturing and organizing element screenshots
 */
export class ScreenshotService {
  constructor() {
    this.isCapturing = false;
    this.capturedCount = 0;
    this.totalCount = 0;
  }

  /**
   * Capture screenshots of filtered elements
   * @param {Array} elements - Array of filtered elements
   * @param {Function} progressCallback - Progress callback function
   * @param {string} pageUrl - The actual page URL (optional, falls back to window.location.href)
   * @returns {Promise<Object>} Promise that resolves with screenshot results
   */
  async captureElementScreenshots(
    elements,
    progressCallback = null,
    pageUrl = null
  ) {
    if (this.isCapturing) {
      throw new Error("Screenshot capture already in progress");
    }

    this.isCapturing = true;
    this.capturedCount = 0;
    this.totalCount = elements.length;

    try {
      console.log(
        `Starting screenshot capture for ${elements.length} elements`
      );

      // Get current page URL for folder naming - use provided pageUrl or fallback safely
      let urlObj;
      try {
        const urlToUse = pageUrl || window.location.href;
        urlObj = new URL(urlToUse);
      } catch (error) {
        console.warn(
          "Invalid URL for folder naming, using fallback:",
          pageUrl || window.location.href
        );
        // Fallback to a safe default
        urlObj = {
          hostname: "unknown_site",
          pathname: "",
        };
      }

      const domain = urlObj.hostname.replace(/[^a-zA-Z0-9]/g, "_");
      const path = urlObj.pathname
        .replace(/[^a-zA-Z0-9]/g, "_")
        .substring(0, 50);
      const folderName = `${domain}${path}`;

      // Create folder structure
      const folderPath = `webuicomponents/${folderName}`;

      // Capture screenshots for each element
      const screenshots = [];
      const errors = [];

      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];

        try {
          if (progressCallback) {
            progressCallback(
              i + 1,
              elements.length,
              `Capturing ${element.tagName || "element"} ${i + 1}/${
                elements.length
              }`
            );
          }

          const screenshot = await this.captureElementScreenshot(
            element,
            i,
            folderPath
          );
          if (screenshot) {
            screenshots.push(screenshot);
            this.capturedCount++;
          }
        } catch (error) {
          console.error(`Error capturing screenshot for element ${i}:`, error);
          errors.push({
            index: i,
            element: element,
            error: error.message,
          });
        }

        // Small delay to prevent overwhelming the system
        await this.delay(100);
      }

      const results = {
        success: true,
        folderPath: folderPath,
        totalElements: elements.length,
        capturedCount: this.capturedCount,
        screenshots: screenshots,
        errors: errors,
        downloadData: this.prepareDownloadData(screenshots, folderName),
      };

      console.log(
        `Screenshot capture completed: ${this.capturedCount}/${elements.length} captured`
      );
      return results;
    } catch (error) {
      console.error("Error in screenshot capture:", error);
      throw error;
    } finally {
      this.isCapturing = false;
    }
  }

  /**
   * Capture screenshot of a single element
   * @param {Object} elementData - Element data object
   * @param {number} index - Element index
   * @param {string} folderPath - Folder path for organization
   * @returns {Promise<Object>} Promise that resolves with screenshot data
   */
  async captureElementScreenshot(elementData, index, folderPath) {
    let targetElement = null;

    // Try to find the element using the selector
    if (elementData.selector && elementData.selector !== "unknown") {
      try {
        targetElement = document.querySelector(elementData.selector);
      } catch (error) {
        console.warn(
          "Could not find element with selector:",
          elementData.selector,
          error
        );
      }
    }

    // Fallback to stored element reference
    if (!targetElement && elementData.element) {
      targetElement = elementData.element;
    }

    if (!targetElement) {
      console.warn("No target element found for screenshot:", elementData);
      return null;
    }

    // Check if element has getBoundingClientRect
    if (!targetElement.getBoundingClientRect) {
      console.warn(
        "Element does not have getBoundingClientRect method:",
        targetElement
      );
      return null;
    }

    try {
      // Scroll element into view
      targetElement.scrollIntoView({
        behavior: "instant",
        block: "center",
        inline: "center",
      });

      // Wait for scroll to complete
      await this.delay(200);

      const rect = targetElement.getBoundingClientRect();

      // Check if element has valid dimensions
      if (rect.width <= 0 || rect.height <= 0) {
        console.warn("Element has zero or negative dimensions:", {
          width: rect.width,
          height: rect.height,
          element: targetElement,
        });
        return null;
      }

      // Capture the screenshot using chrome.tabs.captureVisibleTab
      const screenshotData = await this.captureVisibleTab();

      if (!screenshotData) {
        console.warn("Failed to capture visible tab");
        return null;
      }

      // Crop the screenshot to the element bounds
      const croppedScreenshot = await this.cropScreenshot(
        screenshotData,
        rect,
        window.scrollX,
        window.scrollY
      );

      if (!croppedScreenshot) {
        console.warn("Failed to crop screenshot");
        return null;
      }

      // Generate filename
      const tagName =
        elementData.tagName || targetElement.tagName.toLowerCase() || "element";
      const size = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      const text = elementData.text || targetElement.innerText?.trim() || "";
      const sanitizedText = text.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 20);

      const filename = `${index + 1}_${tagName}_${size}_${sanitizedText}.png`;

      const screenshotInfo = {
        index: index,
        filename: filename,
        folderPath: folderPath,
        fullPath: `${folderPath}/${filename}`,
        elementData: elementData,
        bounds: {
          x: rect.left + window.scrollX,
          y: rect.top + window.scrollY,
          width: rect.width,
          height: rect.height,
        },
        dataUrl: croppedScreenshot,
        tagName: tagName,
        size: size,
        text: text,
      };

      console.log(`Screenshot captured: ${filename}`);
      return screenshotInfo;
    } catch (error) {
      console.error("Error capturing element screenshot:", error);
      return null;
    }
  }

  /**
   * Request a screenshot of the visible tab from the background script
   * @returns {Promise<string>} Promise that resolves with screenshot data URL
   */
  async captureVisibleTab() {
    return new Promise((resolve, reject) => {
      try {
        chrome.runtime.sendMessage(
          { action: "CAPTURE_VISIBLE_TAB" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "[Scope] Content: Error requesting visible tab screenshot:",
                chrome.runtime.lastError
              );
              reject(new Error(chrome.runtime.lastError.message));
            } else if (!response || !response.success) {
              console.error(
                "[Scope] Content: Background failed to capture visible tab:",
                response && response.error
              );
              reject(
                new Error(
                  response && response.error ? response.error : "Unknown error"
                )
              );
            } else {
              console.log(
                "[Scope] Content: Received screenshot dataUrl, length:",
                response.dataUrl && response.dataUrl.length
              );
              resolve(response.dataUrl);
            }
          }
        );
      } catch (error) {
        console.error(
          "[Scope] Content: Exception in captureVisibleTab request:",
          error
        );
        reject(error);
      }
    });
  }

  /**
   * Crop screenshot to element bounds
   * @param {string} screenshotDataUrl - Screenshot data URL
   * @param {Object} elementRect - Element bounding rectangle
   * @param {number} scrollX - Horizontal scroll offset
   * @param {number} scrollY - Vertical scroll offset
   * @returns {Promise<string>} Promise that resolves with cropped screenshot data URL
   */
  async cropScreenshot(screenshotDataUrl, elementRect, scrollX, scrollY) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");

          // Device pixel ratio scaling
          const scale = window.devicePixelRatio || 1;
          const cropX = (elementRect.left + scrollX) * scale;
          const cropY = (elementRect.top + scrollY) * scale;
          const cropWidth = elementRect.width * scale;
          const cropHeight = elementRect.height * scale;

          // Set canvas size to element size in CSS pixels
          canvas.width = elementRect.width;
          canvas.height = elementRect.height;

          // Draw cropped portion
          ctx.drawImage(
            img,
            cropX,
            cropY,
            cropWidth,
            cropHeight, // Source rectangle in device px
            0,
            0,
            elementRect.width,
            elementRect.height // Destination rectangle in CSS px
          );

          // Convert to data URL
          const croppedDataUrl = canvas.toDataURL("image/png");
          resolve(croppedDataUrl);
        } catch (error) {
          console.error("Error cropping screenshot:", error);
          resolve(null);
        }
      };

      img.onerror = () => {
        console.error("Error loading screenshot image");
        resolve(null);
      };

      img.src = screenshotDataUrl;
    });
  }

  /**
   * Prepare download data for all screenshots
   * @param {Array} screenshots - Array of screenshot data
   * @param {string} folderName - Folder name
   * @returns {Object} Download data object
   */
  prepareDownloadData(screenshots, folderName) {
    const downloadData = {
      folderName: folderName,
      timestamp: new Date().toISOString(),
      screenshots: screenshots.map((screenshot) => ({
        filename: screenshot.filename,
        dataUrl: screenshot.dataUrl,
        elementInfo: {
          tagName: screenshot.tagName,
          size: screenshot.size,
          text: screenshot.text,
          selector: screenshot.elementData.selector,
        },
      })),
    };

    return downloadData;
  }

  /**
   * Download all screenshots as a zip file
   * @param {Object} downloadData - Download data object
   */
  async downloadScreenshots(downloadData) {
    try {
      console.log("[Scope] Starting downloadScreenshots with data:", {
        folderName: downloadData.folderName,
        screenshotCount: downloadData.screenshots.length,
        timestamp: downloadData.timestamp,
      });

      // Create a zip file using JSZip
      console.log("[Scope] Loading JSZip...");
      const JSZip = await this.loadJSZip();
      console.log("[Scope] JSZip loaded successfully");

      const zip = new JSZip();
      console.log("[Scope] Created new JSZip instance");

      // Create folder structure
      const folder = zip.folder(downloadData.folderName);
      console.log("[Scope] Created folder:", downloadData.folderName);

      // Add each screenshot to the zip
      console.log("[Scope] Adding screenshots to zip...");
      downloadData.screenshots.forEach((screenshot, index) => {
        console.log(
          `[Scope] Adding screenshot ${index + 1}/${
            downloadData.screenshots.length
          }:`,
          screenshot.filename
        );
        // Convert data URL to blob
        const base64Data = screenshot.dataUrl.split(",")[1];
        folder.file(screenshot.filename, base64Data, { base64: true });
      });

      // Generate zip file
      console.log("[Scope] Generating zip file...");
      const zipBlob = await zip.generateAsync({ type: "blob" });
      console.log("[Scope] Zip blob created, size:", zipBlob.size, "bytes");

      // Create download link
      console.log("[Scope] Creating download URL...");
      const url = URL.createObjectURL(zipBlob);
      console.log("[Scope] Created blob URL:", url);

      const a = document.createElement("a");
      a.href = url;
      a.download = `${downloadData.folderName}_screenshots.zip`;
      console.log("[Scope] Download filename:", a.download);

      document.body.appendChild(a);
      console.log("[Scope] Triggering download...");
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log(
        `[Scope] Successfully downloaded ${downloadData.screenshots.length} screenshots as zip file`
      );
      return true;
    } catch (error) {
      console.error("[Scope] Error downloading screenshots:", error);
      console.error("[Scope] Error stack:", error.stack);
      throw error;
    }
  }

  /**
   * Load JSZip library dynamically
   * @returns {Promise<Object>} Promise that resolves with JSZip object
   */
  async loadJSZip() {
    // Try to load from CDN if not already loaded
    if (typeof JSZip !== "undefined") {
      return JSZip;
    }

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
   * Delay execution
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Promise that resolves after delay
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Check if screenshot capture is in progress
   * @returns {boolean} True if capture is in progress
   */
  isCapturingInProgress() {
    return this.isCapturing;
  }

  /**
   * Get capture progress
   * @returns {Object} Progress object with current and total counts
   */
  getProgress() {
    return {
      current: this.capturedCount,
      total: this.totalCount,
      percentage:
        this.totalCount > 0
          ? Math.round((this.capturedCount / this.totalCount) * 100)
          : 0,
    };
  }
}
