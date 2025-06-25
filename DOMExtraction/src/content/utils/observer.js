/**
 * Observer manager for monitoring DOM changes during inspection
 * Handles MutationObserver setup, DOM change detection, and cleanup
 */

import { PERFORMANCE } from "@shared/constants.js";

/**
 * Observer manager class for DOM change monitoring
 */
export class ObserverManager {
  constructor() {
    this.observer = null;
    this.isObserving = false;
    this.mutationCallback = null;
    this.observerConfig = {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-*"],
      characterData: false,
    };
  }

  /**
   * Start observing DOM changes
   * @param {Function} callback - Callback function for mutations
   */
  startObserving(callback = null) {
    if (this.isObserving) {
      console.warn("Observer is already running");
      return;
    }

    this.mutationCallback = callback || this.defaultMutationCallback;

    try {
      this.observer = new MutationObserver((mutations) => {
        this.handleMutations(mutations);
      });

      this.observer.observe(document.body, this.observerConfig);
      this.isObserving = true;

      console.log("DOM observer started");
    } catch (error) {
      console.error("Error starting DOM observer:", error);
    }
  }

  /**
   * Stop observing DOM changes
   */
  stopObserving() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.isObserving = false;
    this.mutationCallback = null;

    console.log("DOM observer stopped");
  }

  /**
   * Handle DOM mutations
   * @param {Array} mutations - Array of mutation records
   */
  handleMutations(mutations) {
    if (!this.mutationCallback) return;

    const relevantMutations = mutations.filter((mutation) => {
      // Filter out irrelevant mutations
      return this.isRelevantMutation(mutation);
    });

    if (relevantMutations.length > 0) {
      this.mutationCallback(relevantMutations);
    }
  }

  /**
   * Check if mutation is relevant for UI inspection
   * @param {MutationRecord} mutation - Mutation record
   * @returns {boolean} True if mutation is relevant
   */
  isRelevantMutation(mutation) {
    // Skip mutations on our own highlight elements
    if (mutation.target.id === "__uiInspectorHighlight") {
      return false;
    }

    // Skip mutations on script and style elements
    if (
      mutation.target.tagName === "SCRIPT" ||
      mutation.target.tagName === "STYLE"
    ) {
      return false;
    }

    // Skip mutations on hidden elements
    if (mutation.target.offsetParent === null) {
      return false;
    }

    // Consider attribute changes on interactive elements
    if (mutation.type === "attributes") {
      const target = mutation.target;
      const tag = target.tagName.toLowerCase();

      // Check if it's an interactive element
      const isInteractive =
        ["button", "input", "select", "textarea", "a"].includes(tag) ||
        target.getAttribute("role") === "button" ||
        target.getAttribute("role") === "link";

      return isInteractive;
    }

    // Consider child list changes
    if (mutation.type === "childList") {
      // Check if added/removed nodes contain interactive elements
      const hasInteractiveNodes = [
        ...mutation.addedNodes,
        ...mutation.removedNodes,
      ].some((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          const tag = node.tagName.toLowerCase();
          return (
            ["button", "input", "select", "textarea", "a"].includes(tag) ||
            node.getAttribute("role") === "button" ||
            node.getAttribute("role") === "link"
          );
        }
        return false;
      });

      return hasInteractiveNodes;
    }

    return false;
  }

  /**
   * Default mutation callback
   * @param {Array} mutations - Array of relevant mutations
   */
  defaultMutationCallback(mutations) {
    console.log(`DOM changed: ${mutations.length} relevant mutations detected`);

    // Log details about the mutations
    mutations.forEach((mutation) => {
      if (mutation.type === "attributes") {
        console.log(
          `Attribute change: ${mutation.attributeName} on`,
          mutation.target
        );
      } else if (mutation.type === "childList") {
        console.log(
          `Child list change: ${mutation.addedNodes.length} added, ${mutation.removedNodes.length} removed`
        );
      }
    });
  }

  /**
   * Set custom observer configuration
   * @param {Object} config - Observer configuration
   */
  setObserverConfig(config) {
    this.observerConfig = { ...this.observerConfig, ...config };

    // Restart observer if currently running
    if (this.isObserving) {
      this.stopObserving();
      this.startObserving(this.mutationCallback);
    }
  }

  /**
   * Check if observer is currently running
   * @returns {boolean} True if observer is running
   */
  isRunning() {
    return this.isObserving;
  }

  /**
   * Get current observer instance
   * @returns {MutationObserver|null} Current observer or null
   */
  getObserver() {
    return this.observer;
  }

  /**
   * Pause observer temporarily
   */
  pause() {
    if (this.observer) {
      this.observer.disconnect();
      console.log("DOM observer paused");
    }
  }

  /**
   * Resume observer after pause
   */
  resume() {
    if (this.observer && this.isObserving) {
      this.observer.observe(document.body, this.observerConfig);
      console.log("DOM observer resumed");
    }
  }
}
