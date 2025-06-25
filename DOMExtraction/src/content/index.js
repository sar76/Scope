/**
 * Content script entry point for DOM Extraction Chrome Extension
 * Main orchestrator for UI element collection and filtering
 */

import { MESSAGE_ACTIONS } from "@shared/constants.js";
import {
  errorLogger,
  withErrorHandling,
  createErrorResponse,
} from "@shared/errors.js";
import { sendUIData } from "@shared/messaging.js";
import { ElementCollector } from "./utils/collector.js";
import { FilterPipeline } from "./filter/pipeline.js";
import { HighlightManager } from "./utils/highlight.js";
import { ObserverManager } from "./utils/observer.js";

// Global state
let isCollecting = false;
let collector = null;
let filterPipeline = null;
let highlightManager = null;
let observerManager = null;
let lastCollectedElements = [];

/**
 * Create a visible notification element
 * @param {string} message - Message to display
 * @param {string} type - Type of notification (info, success, error, warning)
 * @param {number} duration - Duration in milliseconds (0 for permanent)
 * @returns {HTMLElement} The notification element
 */
function createNotification(message, type = "info", duration = 3000) {
  // Remove any existing notifications
  const existing = document.getElementById("scope-extension-notification");
  if (existing) {
    existing.remove();
  }

  const notification = document.createElement("div");
  notification.id = "scope-extension-notification";
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${
      type === "error"
        ? "#dc3545"
        : type === "success"
        ? "#28a745"
        : type === "warning"
        ? "#ffc107"
        : "#007bff"
    };
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
    animation: scopeNotificationSlideIn 0.3s ease-out;
  `;

  notification.textContent = message;

  // Add CSS animation
  if (!document.getElementById("scope-notification-styles")) {
    const style = document.createElement("style");
    style.id = "scope-notification-styles";
    style.textContent = `
      @keyframes scopeNotificationSlideIn {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
      @keyframes scopeNotificationSlideOut {
        from {
          transform: translateX(0);
          opacity: 1;
        }
        to {
          transform: translateX(100%);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(notification);

  // Auto-remove after duration
  if (duration > 0) {
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = "scopeNotificationSlideOut 0.3s ease-in";
        setTimeout(() => {
          if (notification.parentNode) {
            notification.remove();
          }
        }, 300);
      }
    }, duration);
  }

  return notification;
}

/**
 * Initialize content script
 */
function initialize() {
  console.log("Content script initialized for:", window.location.href);

  // Show visible notification that content script is loaded
  createNotification("🔍 Scope Extension: Content script loaded", "info", 2000);

  try {
    // Initialize managers
    collector = new ElementCollector();
    filterPipeline = new FilterPipeline();
    highlightManager = new HighlightManager();
    observerManager = new ObserverManager();

    // Set up message listeners
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log("Content script received message:", message);
      console.log("Message action:", message.action);
      console.log("Sender:", sender);

      if (message.action === "PING") {
        console.log("Handling PING action");
        sendResponse({ success: true, message: "Content script is available" });
        return true;
      }

      if (message.action === MESSAGE_ACTIONS.RUN_INSPECT) {
        console.log("Handling RUN_INSPECT action");
        // Show visible notification
        createNotification("🔍 Starting DOM inspection...", "info", 0);

        // Use async IIFE to handle the async function properly
        (async () => {
          try {
            await handleRunInspect(sendResponse);
          } catch (error) {
            console.error("Error in handleRunInspect:", error);
            errorLogger.log(error, "error", { context: "handleRunInspect" });
            createNotification(
              `❌ Inspection failed: ${error.message}`,
              "error",
              5000
            );
            sendResponse(createErrorResponse(error));
          }
        })();
        return true;
      }

      if (message.action === MESSAGE_ACTIONS.STOP_INSPECT) {
        console.log("Handling STOP_INSPECT action");
        createNotification("⏹️ Inspection stopped", "warning", 2000);
        handleStopInspect();
        sendResponse({ success: true });
        return true;
      }

      if (message.action === MESSAGE_ACTIONS.COMPREHENSIVE_FILTER) {
        console.log("Handling COMPREHENSIVE_FILTER action");
        createNotification("🔍 Starting comprehensive filtering...", "info", 0);

        // Use async IIFE to handle the async function properly
        (async () => {
          try {
            await handleComprehensiveFilter(message.selectors, sendResponse);
          } catch (error) {
            console.error("Error in handleComprehensiveFilter:", error);
            errorLogger.log(error, "error", {
              context: "handleComprehensiveFilter",
            });
            createNotification(
              `❌ Filtering failed: ${error.message}`,
              "error",
              5000
            );
            sendResponse(createErrorResponse(error));
          }
        })();
        return true;
      }

      if (message.action === "GET_LAST_SELECTORS") {
        const selectors = Array.isArray(lastCollectedElements)
          ? lastCollectedElements.map((el) => el.selector)
          : [];
        sendResponse({ selectors });
        return true;
      }

      if (message.action === "TOGGLE_DEBUG_OVERLAY") {
        console.log("Handling TOGGLE_DEBUG_OVERLAY action");
        handleToggleDebugOverlay();
        sendResponse({ success: true });
        return true;
      }

      // Unknown action
      console.warn("Unknown message action:", message.action);
      sendResponse({ success: false, error: "Unknown action" });
      return true;
    });

    console.log("Content script managers initialized successfully");
    console.log("Message listener set up for:", Object.values(MESSAGE_ACTIONS));
  } catch (error) {
    console.error("Error initializing content script:", error);
    errorLogger.log(error, "error", { context: "contentScriptInitialize" });
    createNotification(
      `❌ Content script initialization failed: ${error.message}`,
      "error",
      5000
    );
  }
}

/**
 * Collect interactive elements by programmatically hovering over them
 * This approach discovers elements that become interactive on hover
 */
async function collectInteractiveElementsByHover(root = document) {
  const results = new Set();
  const hoveredElements = new Set();

  // Get all potential interactive elements
  const allElements = root.querySelectorAll("*");
  const candidates = Array.from(allElements).filter((el) => {
    const tag = el.tagName?.toLowerCase();
    const style = window.getComputedStyle(el);
    const rect = el.getBoundingClientRect();

    // Skip excluded elements
    if (
      [
        "svg",
        "path",
        "circle",
        "rect",
        "g",
        "style",
        "script",
        "meta",
        "link",
        "head",
        "title",
      ].includes(tag)
    ) {
      return false;
    }

    // Skip hidden or zero-size elements
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      rect.width === 0 ||
      rect.height === 0
    ) {
      return false;
    }

    // Skip elements outside viewport
    if (
      rect.bottom < 0 ||
      rect.top > window.innerHeight ||
      rect.right < 0 ||
      rect.left > window.innerWidth
    ) {
      return false;
    }

    return true;
  });

  console.log(
    `Testing ${candidates.length} candidate elements for hover interactions...`
  );

  // Test each candidate by hovering over it
  for (let i = 0; i < candidates.length; i++) {
    const el = candidates[i];

    try {
      // Skip if we already know it's interactive
      if (isElementInteractive(el)) {
        results.add(el);
        continue;
      }

      // Create and dispatch hover events
      const mouseenterEvent = new MouseEvent("mouseenter", {
        bubbles: true,
        cancelable: true,
        view: window,
      });

      const mouseoverEvent = new MouseEvent("mouseover", {
        bubbles: true,
        cancelable: true,
        view: window,
      });

      // Dispatch events
      el.dispatchEvent(mouseenterEvent);
      el.dispatchEvent(mouseoverEvent);

      // Wait a bit for any hover effects to trigger
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Check if the element became interactive after hover
      const styleAfter = window.getComputedStyle(el);
      const cursorAfter = styleAfter.cursor;

      // If cursor changed to pointer or element has hover effects, it's interactive
      if (
        cursorAfter === "pointer" ||
        styleAfter.transform !== "none" ||
        styleAfter.boxShadow !== "none" ||
        el.classList.contains("hover") ||
        el.getAttribute("data-hover") === "true"
      ) {
        results.add(el);
        hoveredElements.add(el);
      }

      // Check for newly revealed elements (like tooltips, dropdowns)
      const newlyVisible = document.querySelectorAll(
        '[style*="display: block"], [style*="visibility: visible"]'
      );
      newlyVisible.forEach((newEl) => {
        if (!hoveredElements.has(newEl) && isElementInteractive(newEl)) {
          results.add(newEl);
        }
      });

      // Clean up hover state
      const mouseleaveEvent = new MouseEvent("mouseleave", {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      el.dispatchEvent(mouseleaveEvent);
    } catch (error) {
      console.warn("Error testing element for hover:", error);
    }

    // Progress update every 50 elements
    if (i % 50 === 0) {
      console.log(
        `Hover testing progress: ${i}/${candidates.length} elements tested`
      );
    }
  }

  console.log(
    `Hover-based collection found ${results.size} interactive elements`
  );
  return Array.from(results);
}

/**
 * Check if an element is already known to be interactive
 */
function isElementInteractive(el) {
  const tag = el.tagName?.toLowerCase();
  const role = el.getAttribute("role");
  const style = window.getComputedStyle(el);

  // Native interactive elements
  if (
    ["button", "input", "select", "textarea", "a", "label", "form"].includes(
      tag
    )
  ) {
    return true;
  }

  // Elements with interactive roles
  if (
    [
      "button",
      "link",
      "menuitem",
      "tab",
      "checkbox",
      "radio",
      "textbox",
      "combobox",
      "listbox",
    ].includes(role)
  ) {
    return true;
  }

  // Elements with click handlers
  if (el.onclick || el.getAttribute("onclick")) {
    return true;
  }

  // Elements with pointer cursor
  if (style.cursor === "pointer") {
    return true;
  }

  return false;
}

/**
 * Collect interactive elements using selective logic for UI components only
 */
function collectInteractiveElements(root = document) {
  const results = [];

  // Define what we consider interactive UI elements
  const interactiveTags = new Set([
    "button",
    "input",
    "select",
    "textarea",
    "a",
    "label",
    "form",
  ]);

  const interactiveRoles = new Set([
    "button",
    "link",
    "menuitem",
    "tab",
    "checkbox",
    "radio",
    "textbox",
    "combobox",
    "listbox",
  ]);

  // Elements to explicitly exclude
  const excludeTags = new Set([
    "svg",
    "path",
    "circle",
    "rect",
    "g",
    "style",
    "script",
    "meta",
    "link",
    "head",
    "title",
  ]);

  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const tag = node.tagName?.toLowerCase();
        const role = node.getAttribute("role");
        const style = window.getComputedStyle(node);

        // Skip excluded tags
        if (excludeTags.has(tag)) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip hidden elements
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip elements with zero size
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip elements outside viewport
        if (
          rect.bottom < 0 ||
          rect.top > window.innerHeight ||
          rect.right < 0 ||
          rect.left > window.innerWidth
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        // Accept native interactive elements
        if (interactiveTags.has(tag)) {
          // For links, only accept if they have meaningful href
          if (tag === "a") {
            const href = node.getAttribute("href");
            if (!href || href === "#" || href.startsWith("javascript:")) {
              return NodeFilter.FILTER_REJECT;
            }
          }
          // For inputs, skip hidden inputs
          if (tag === "input" && node.type === "hidden") {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }

        // Accept elements with interactive roles
        if (role && interactiveRoles.has(role)) {
          return NodeFilter.FILTER_ACCEPT;
        }

        // Accept elements with click handlers
        if (node.onclick || node.getAttribute("onclick")) {
          return NodeFilter.FILTER_ACCEPT;
        }

        // Accept elements with pointer cursor (but be more selective)
        if (style.cursor === "pointer") {
          // Only accept if it has meaningful text or is reasonably sized
          const text = node.innerText?.trim();
          const area = rect.width * rect.height;
          if (text && text.length > 0 && text.length < 100 && area > 100) {
            return NodeFilter.FILTER_ACCEPT;
          }
        }

        // Accept form elements and their containers
        if (tag === "form" || node.closest("form")) {
          return NodeFilter.FILTER_ACCEPT;
        }

        // Skip everything else
        return NodeFilter.FILTER_SKIP;
      },
    },
    false
  );

  let el = walker.nextNode();
  while (el) {
    results.push(el);
    el = walker.nextNode();
  }

  // Recurse into any shadow roots
  const all = root.querySelectorAll("*");
  all.forEach((node) => {
    if (node.shadowRoot) {
      results.push(...collectInteractiveElements(node.shadowRoot));
    }
  });

  // Remove duplicates and return
  return Array.from(new Set(results));
}

/**
 * Compute a unique CSS path for an element (old logic)
 */
function computeUniqueCssPath(el) {
  if (!(el instanceof Element)) return null;
  if (el.id) {
    return `#${CSS.escape(el.id)}`;
  }
  const segments = [];
  let current = el;
  while (
    current &&
    current.nodeType === Node.ELEMENT_NODE &&
    current !== document.body
  ) {
    let seg = current.tagName.toLowerCase();
    if (current.classList.length > 0) {
      seg +=
        "." +
        Array.from(current.classList)
          .map((cls) => CSS.escape(cls))
          .join(".");
    }
    const parent = current.parentNode;
    if (parent && parent.nodeType === Node.ELEMENT_NODE) {
      const same = Array.from(parent.children).filter((sib) => {
        if (sib.tagName !== current.tagName) return false;
        const a = Array.from(sib.classList).sort().join(" ");
        const b = Array.from(current.classList).sort().join(" ");
        return a === b;
      });
      if (same.length > 1) {
        const idx = Array.prototype.indexOf.call(parent.children, current) + 1;
        seg += `:nth-child(${idx})`;
      }
    }
    segments.unshift(seg);
    current = parent;
  }
  return segments.length > 0 ? `body > ${segments.join(" > ")}` : "body";
}

/**
 * Handle run inspect command
 * @param {Function} sendResponse - Response callback
 */
const handleRunInspect = withErrorHandling(async (sendResponse) => {
  console.log("Starting RUN_INSPECT process...");

  if (isCollecting) {
    console.log("Already collecting, rejecting request");
    createNotification("⚠️ Already collecting elements", "warning", 3000);
    sendResponse({ success: false, error: "Already collecting" });
    return;
  }

  isCollecting = true;

  try {
    console.log("Starting DOM observation...");
    observerManager.startObserving();

    console.log("Collecting UI elements (hover-based)...");
    createNotification(
      "🔍 Collecting UI elements with hover detection...",
      "info",
      0
    );
    const elements = await collectInteractiveElementsByHover();
    console.log(`Collected ${elements.length} interactive elements`);

    // Map to data objects with selector, tag, text, etc.
    const collected = elements.map((el) => {
      const uniqueSelector = computeUniqueCssPath(el);
      const rect = el.getBoundingClientRect().toJSON();
      const text = el.innerText?.trim() || "";
      const role = el.getAttribute("role") || null;
      const ariaLabel = el.getAttribute("aria-label") || null;
      return {
        selector: uniqueSelector,
        tagName: el.tagName.toLowerCase(),
        text,
        boundingRect: rect,
        role,
        ariaLabel,
      };
    });
    lastCollectedElements = collected;

    // Reply to popup immediately with success
    console.log("Sending success response to popup");
    createNotification(
      `✅ Found ${collected.length} UI elements!`,
      "success",
      3000
    );
    sendResponse({ success: true, count: collected.length });

    // Display results in a floating overlay panel
    showResultsOverlay(collected);
  } finally {
    console.log("Cleaning up inspection process...");
    isCollecting = false;
    observerManager.stopObserving();
  }
}, "handleRunInspect");

/**
 * Show results in a floating overlay panel
 * @param {Array} elements - Array of filtered UI elements
 */
function showResultsOverlay(elements) {
  // Remove any existing overlay
  const existing = document.getElementById("scope-extension-results-overlay");
  if (existing) existing.remove();

  const overlay = document.createElement("div");
  overlay.id = "scope-extension-results-overlay";
  overlay.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    width: 350px;
    max-height: 60vh;
    overflow-y: auto;
    background: #fff;
    color: #222;
    border: 2px solid #007bff;
    border-radius: 10px;
    box-shadow: 0 4px 24px rgba(0,0,0,0.18);
    z-index: 999999;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    padding: 18px 18px 12px 18px;
  `;

  const title = document.createElement("div");
  title.textContent = `🔍 Scope: ${elements.length} UI Elements Found`;
  title.style.cssText =
    "font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #007bff;";
  overlay.appendChild(title);

  if (elements.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "No UI elements found.";
    overlay.appendChild(empty);
  } else {
    const list = document.createElement("ul");
    list.style.cssText =
      "list-style: none; padding: 0; margin: 0; max-height: 40vh; overflow-y: auto;";

    elements.forEach((el, idx) => {
      const li = document.createElement("li");
      li.style.cssText =
        "margin-bottom: 8px; border-bottom: 1px solid #eee; padding: 8px 4px; cursor: pointer; border-radius: 4px; transition: background-color 0.2s;";

      // Create the display text
      const displayText = `${idx + 1}. ${el.tagName || el.type || "Element"}${
        el.selector ? " (" + el.selector + ")" : ""
      }`;
      li.textContent = displayText;

      // Add hover effect
      li.addEventListener("mouseenter", () => {
        li.style.backgroundColor = "#f0f8ff";
      });

      li.addEventListener("mouseleave", () => {
        li.style.backgroundColor = "transparent";
      });

      // Add click handler to highlight the element
      li.addEventListener("click", () => {
        try {
          // Remove any existing highlight
          highlightManager.removeHighlight();

          // Try to find the element by selector
          let targetElement = null;
          if (el.selector) {
            targetElement = document.querySelector(el.selector);
          }

          if (targetElement) {
            // Highlight the element
            highlightManager.highlightElement(targetElement, {
              color: "#007bff",
              opacity: 0.3,
              borderColor: "#007bff",
              borderWidth: "3px",
              animated: true,
              duration: 300,
            });

            // Scroll the element into view
            targetElement.scrollIntoView({
              behavior: "smooth",
              block: "center",
              inline: "center",
            });

            // Show notification
            createNotification(`🔍 Highlighted: ${el.tagName}`, "info", 2000);

            // Update list item to show it's highlighted
            li.style.backgroundColor = "#e3f2fd";
            li.style.borderLeft = "4px solid #007bff";

            // Reset other list items
            list.querySelectorAll("li").forEach((otherLi) => {
              if (otherLi !== li) {
                otherLi.style.backgroundColor = "transparent";
                otherLi.style.borderLeft = "none";
              }
            });
          } else {
            createNotification(
              `❌ Element not found: ${el.selector}`,
              "error",
              3000
            );
          }
        } catch (error) {
          console.error("Error highlighting element:", error);
          createNotification(
            `❌ Error highlighting element: ${error.message}`,
            "error",
            3000
          );
        }
      });

      list.appendChild(li);
    });

    overlay.appendChild(list);
  }

  // Add clear highlight button
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear Highlight";
  clearBtn.style.cssText =
    "margin-top: 12px; margin-right: 8px; background: #6c757d; color: #fff; border: none; border-radius: 5px; padding: 6px 16px; font-size: 13px; cursor: pointer;";
  clearBtn.onclick = () => {
    highlightManager.removeHighlight();
    // Reset all list items
    const listItems = overlay.querySelectorAll("li");
    listItems.forEach((li) => {
      li.style.backgroundColor = "transparent";
      li.style.borderLeft = "none";
    });
    createNotification("🧹 Highlight cleared", "info", 2000);
  };
  overlay.appendChild(clearBtn);

  // Add close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close";
  closeBtn.style.cssText =
    "margin-top: 12px; float: right; background: #007bff; color: #fff; border: none; border-radius: 5px; padding: 6px 16px; font-size: 13px; cursor: pointer;";
  closeBtn.onclick = () => {
    highlightManager.removeHighlight();
    overlay.remove();
  };
  overlay.appendChild(closeBtn);

  document.body.appendChild(overlay);
}

/**
 * Handle stop inspect command
 */
function handleStopInspect() {
  isCollecting = false;
  observerManager.stopObserving();
  highlightManager.removeHighlight();
  console.log("Inspection stopped");
}

/**
 * Handle toggle debug overlay
 */
function handleToggleDebugOverlay() {
  const debugOverlay = document.getElementById("scope-filter-debug-overlay");
  if (debugOverlay) {
    // Toggle visibility
    const isVisible = debugOverlay.style.display !== "none";
    debugOverlay.style.display = isVisible ? "none" : "block";
    console.log(`Debug overlay ${isVisible ? "hidden" : "shown"}`);
    createNotification(
      `🔍 Debug overlay ${isVisible ? "hidden" : "shown"}`,
      "info",
      2000
    );
  } else {
    console.log("No debug overlay found to toggle");
    createNotification("No debug overlay available", "warning", 2000);
  }
}

/**
 * Handle comprehensive filtering
 * @param {Array} selectors - Selectors to filter
 * @param {Function} sendResponse - Response callback
 */
const handleComprehensiveFilter = withErrorHandling(
  async (selectors, sendResponse) => {
    // Convert selectors to DOM elements, filter out nulls
    const elements = selectors
      .map((selector) => {
        try {
          return document.querySelector(selector);
        } catch {
          return null;
        }
      })
      .filter((el) => el && el.tagName);

    const filtered = await filterPipeline.applyComprehensiveFiltering(elements);
    createNotification(
      `✅ Filtered to ${filtered.length} elements`,
      "success",
      3000
    );
    // Update overlay with filtered results
    lastCollectedElements = filtered.map((el) => {
      // If the filter pipeline returns DOM elements, map to data objects
      if (el instanceof Element) {
        const uniqueSelector = computeUniqueCssPath(el);
        const rect = el.getBoundingClientRect().toJSON();
        const text = el.innerText?.trim() || "";
        const role = el.getAttribute("role") || null;
        const ariaLabel = el.getAttribute("aria-label") || null;
        return {
          selector: uniqueSelector,
          tagName: el.tagName.toLowerCase(),
          text,
          boundingRect: rect,
          role,
          ariaLabel,
        };
      }
      // If already a data object, return as is
      return el;
    });
    showResultsOverlay(lastCollectedElements);
    sendResponse({ success: true, filtered });
  },
  "handleComprehensiveFilter"
);

// Initialize when content script loads
initialize();

// Test alert to verify content script is running (remove this after testing)
console.log("Content script loaded and initialized successfully!");

// Add a very visible console message to confirm content script is working
console.log(
  "%c🔍 SCOPE EXTENSION: Content script is ACTIVE and ready!",
  "color: #007bff; font-size: 16px; font-weight: bold; background: #f8f9fa; padding: 8px; border-radius: 4px;"
);
console.log(
  "%cYou should see a notification in the top-right corner of this page.",
  "color: #28a745; font-size: 14px;"
);
