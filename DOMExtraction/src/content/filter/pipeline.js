/**
 * Filter pipeline for applying various filtering strategies to collected elements
 * Handles visibility filtering, deduplication, and comprehensive filtering
 */

import { THRESHOLDS, MESSAGE_ACTIONS } from "@shared/constants.js";
import { sendProgressUpdate } from "@shared/messaging.js";
import { VisibilityFilter } from "./visibility.js";
import { DeduplicationFilter } from "./deduplication.js";
import { SpatialFilter } from "./spatial.js";
import { LLMService } from "../services/llm.js";
import { calculateIoU, calculateArea } from "../visibility/geometry.js";
import { cacheSelector, extractElementSignature } from "../utils/dom.js";
import { embedText, cosineSimilarity } from "../services/embedding.js";

/**
 * Filter pipeline class for comprehensive element filtering
 */
export class FilterPipeline {
  constructor() {
    this.visibilityFilter = new VisibilityFilter();
    this.deduplicationFilter = new DeduplicationFilter();
    this.spatialFilter = new SpatialFilter();
    this.llmService = new LLMService();
  }

  /**
   * Apply basic filtering to collected elements
   * @param {Array} elements - Array of collected elements
   * @returns {Promise<Array>} Promise that resolves with filtered elements
   */
  async applyBasicFiltering(elements) {
    console.log(`Applying basic filtering to ${elements.length} elements`);

    // Reset debug state at the start
    clearDebugData();

    // Type guard to ensure we're working with Elements
    if (elements.length > 0 && !(elements[0] instanceof Element)) {
      console.error(
        "applyBasicFiltering expects Element array, got:",
        elements[0]
      );
      return [];
    }

    let filtered = elements;

    // Step 1: Visibility filtering
    const {
      survivors: visibilitySurvivors,
      removedReasons: visibilityReasons,
    } = this.visibilityFilter.filterWithReasons(filtered);
    showFilterDebugOverlay(
      "Basic Visibility Filtering",
      Array.from(visibilityReasons.keys()).map(createRichElementObject),
      "Visibility failures",
      1,
      "Basic visibility filtering",
      visibilityReasons
    );
    filtered = visibilitySurvivors;
    console.log(`After visibility filtering: ${filtered.length} elements`);

    // Step 2: Basic deduplication
    const { survivors: dedupeSurvivors, removedReasons: dedupeReasons } =
      this.deduplicationFilter.applyLightDeduplicationWithReasons(filtered);
    showFilterDebugOverlay(
      "Basic Deduplication",
      Array.from(dedupeReasons.keys()).map(createRichElementObject),
      "Deduplicated",
      2,
      "Basic deduplication",
      dedupeReasons
    );
    filtered = dedupeSurvivors;
    console.log(`After deduplication: ${filtered.length} elements`);

    return filtered;
  }

  /**
   * Ensure minimum number of elements survive each filtering stage
   * @param {Array} elements - Array of elements
   * @param {Array} originalElements - Original array before filtering
   * @param {string} stageName - Name of the filtering stage
   * @returns {Array} Elements with minimum survivors guaranteed
   */
  ensureMinimumSurvivors(elements, originalElements, stageName) {
    const minSurvivors = THRESHOLDS.MIN_SURVIVORS_PER_STAGE;

    if (elements.length >= minSurvivors) {
      return elements;
    }

    console.warn(
      `${stageName}: Only ${elements.length} elements survived, keeping at least ${minSurvivors}`
    );

    // If we have some elements, keep them plus some from original
    if (elements.length > 0) {
      const needed = minSurvivors - elements.length;
      const additional = originalElements
        .filter((el) => !elements.includes(el))
        .slice(0, needed);
      return [...elements, ...additional];
    }

    // If no elements survived, keep the first few from original
    return originalElements.slice(0, minSurvivors);
  }

  /**
   * Apply comprehensive filtering with LLM analysis
   * @param {Array} selectors - Array of element selectors
   * @returns {Promise<Array>} Promise that resolves with comprehensively filtered elements
   */
  async applyComprehensiveFiltering(selectors) {
    console.log(
      `Applying comprehensive filtering to ${selectors.length} selectors`
    );

    // Reset debug state at the start
    clearDebugData();

    const totalSteps = 25;
    let currentStep = 0;
    let elements = []; // Declare elements outside try block

    const updateProgress = (step, message) => {
      currentStep = step;
      const percentage = Math.round((step / totalSteps) * 100);
      sendProgressUpdate({
        step: step,
        message: message,
        percentage: percentage,
      });
    };

    try {
      // Step 1: Convert selectors to elements
      updateProgress(1, "Converting selectors to elements...");
      let {
        elements: convertedElements,
        removedSelectors,
        removalReasons,
      } = this.convertSelectorsToElements(selectors);
      elements = convertedElements; // Assign to outer scope variable
      console.log(`Found ${elements.length} elements from selectors`);
      let prev = elements.slice();

      // Step 2: Top-level filtering with fixpoint iteration
      updateProgress(
        2,
        "Step 1: Top-level filtering with fixpoint iteration..."
      );
      const beforeTopLevel = elements.slice();
      const { survivors: topLevelSurvivors, removedReasons: topLevelReasons } =
        this.applyTopLevelFilteringWithReasons(elements);
      // Show actual filtering before ensureMinimumSurvivors
      showFilterDebugOverlay(
        "Top-level Filtering",
        Array.from(topLevelReasons.keys()).map(createRichElementObject),
        "Not top-level",
        10,
        "Top-level filtering",
        topLevelReasons
      );
      elements = this.ensureMinimumSurvivors(
        topLevelSurvivors,
        prev,
        "Top-level filtering"
      );
      prev = elements.slice();
      console.log(`After top-level filtering: ${elements.length} elements`);

      // Step 3: Visibility filtering
      updateProgress(3, "Step 2: Comprehensive visibility analysis...");
      const {
        survivors: visibilitySurvivors,
        removedReasons: visibilityReasons,
      } =
        this.visibilityFilter.applyComprehensiveVisibilityFilteringWithReasons(
          elements
        );
      // Show actual filtering before ensureMinimumSurvivors
      showFilterDebugOverlay(
        "Visibility Filtering",
        Array.from(visibilityReasons.keys()).map(createRichElementObject),
        "Not visible",
        11,
        "Visibility filtering",
        visibilityReasons
      );
      elements = this.ensureMinimumSurvivors(
        visibilitySurvivors,
        prev,
        "Visibility filtering"
      );
      prev = elements.slice();
      console.log(`After visibility filtering: ${elements.length} elements`);

      // Step 4: IoU-based deduplication
      updateProgress(4, "Step 3: IoU-based deduplication...");
      const { survivors: iouSurvivors, removedReasons: iouReasons } =
        this.deduplicationFilter.applyIoUDeduplicationWithReasons(
          elements,
          THRESHOLDS.IOU_DEDUPE
        );
      // Show actual filtering before ensureMinimumSurvivors
      showFilterDebugOverlay(
        "IoU Deduplication",
        Array.from(iouReasons.keys()).map(createRichElementObject),
        "Deduplicated",
        12,
        "IoU deduplication",
        iouReasons
      );
      elements = this.ensureMinimumSurvivors(
        iouSurvivors,
        prev,
        "IoU deduplication"
      );
      prev = elements.slice();
      console.log(`After IoU deduplication: ${elements.length} elements`);

      // Step 5: Structural filtering
      updateProgress(5, "Step 4: Structural element filtering...");
      const {
        survivors: structuralSurvivors,
        removedReasons: structuralReasons,
      } = this.filterStructuralElementsWithReasons(elements);
      // Show actual filtering before ensureMinimumSurvivors
      showFilterDebugOverlay(
        "Structural Filtering",
        Array.from(structuralReasons.keys()).map(createRichElementObject),
        "Not structural/interactive",
        13,
        "Structural filtering",
        structuralReasons
      );
      elements = this.ensureMinimumSurvivors(
        structuralSurvivors,
        prev,
        "Structural filtering"
      );
      prev = elements.slice();
      console.log(`After structural filtering: ${elements.length} elements`);

      // Step 6: Interactive element prioritization
      updateProgress(6, "Step 5: Interactive element prioritization...");
      elements = this.prioritizeInteractiveElements(elements);
      // This step doesn't remove, just reorders
      // prev = elements.slice();
      console.log(
        `After interactive prioritization: ${elements.length} elements`
      );

      // Step 7: Cluster-based deduplication (replaces semantic/functional dedupe)
      updateProgress(7, "Step 6: Cluster-based deduplication...");
      elements = await this.clusterDeduplicateElements(elements);
      prev = elements.slice();
      console.log(
        `After cluster-based deduplication: ${elements.length} elements`
      );

      // Step 8: LLM-based analysis (batched)
      updateProgress(9, "Step 8: LLM-based element classification...");
      elements = await this.applyLLMAnalysis(elements, updateProgress, 10, 20);
      // LLM analysis doesn't filter, just analyzes and adds metadata
      prev = elements.slice();
      console.log(`After LLM analysis: ${elements.length} elements`);

      // Step 10: Final quality filtering
      updateProgress(21, "Step 9: Final quality assessment...");
      const { survivors: finalSurvivors, removedReasons: finalReasons } =
        this.applyFinalQualityFilteringWithReasons(elements);
      // Show actual filtering before ensureMinimumSurvivors
      showFilterDebugOverlay(
        "Final Quality Filtering",
        Array.from(finalReasons.keys()).map(createRichElementObject),
        "Not fundamental UI",
        17,
        "Final quality filtering",
        finalReasons
      );
      elements = this.ensureMinimumSurvivors(
        finalSurvivors,
        prev,
        "Final quality filtering"
      );
      prev = elements.slice();
      console.log(`After final filtering: ${elements.length} elements`);

      // Step 11: Confidence scoring
      updateProgress(22, "Step 10: Confidence scoring...");
      elements = this.applyConfidenceScoring(elements);
      prev = elements.slice();
      console.log(`After confidence scoring: ${elements.length} elements`);

      // Step 12: Sort by relevance
      updateProgress(23, "Step 11: Sorting by relevance...");
      elements = this.sortByRelevance(elements);
      prev = elements.slice();
      console.log(`After sorting: ${elements.length} elements`);

      // Step 13: Final deduplication
      updateProgress(24, "Step 12: Final deduplication...");
      const {
        survivors: finalDedupSurvivors,
        removedReasons: finalDedupReasons,
      } = this.deduplicationFilter.applyFinalDeduplicationWithReasons(elements);
      showFilterDebugOverlay(
        "Final Deduplication",
        Array.from(finalDedupReasons.keys()).map(createRichElementObject),
        "Deduplicated",
        18,
        "Final deduplication",
        finalDedupReasons
      );
      elements = finalDedupSurvivors;
      prev = elements.slice();
      console.log(`After final deduplication: ${elements.length} elements`);

      // Step 14: Final validation and cleanup
      updateProgress(25, "Step 13: Final validation...");

      // Final validation - ensure all elements are still valid
      const finalElements = elements.filter((element) => {
        try {
          if (!element || !element.getBoundingClientRect) {
            return false;
          }
          const rect = element.getBoundingClientRect();
          return rect && rect.width !== undefined && rect.height !== undefined;
        } catch (error) {
          console.warn("Final validation: Element no longer valid:", element);
          return false;
        }
      });

      console.log(`Final validation: ${finalElements.length} valid elements`);
      return finalElements;
    } catch (error) {
      console.error("Comprehensive filtering failed:", error);

      // If we have any elements at all, return them as a fallback
      if (elements && elements.length > 0) {
        console.warn("Returning available elements as fallback");
        return elements.filter((element) => {
          try {
            return element && element.getBoundingClientRect;
          } catch {
            return false;
          }
        });
      }

      throw error;
    }
  }

  /**
   * Convert selectors to elements, keeping selectors immutable
   * @param {Array} selectors - Array of selector strings
   * @returns {Object} {elements: Element[], removedSelectors: string[], removalReasons: Map<string, string>}
   */
  convertSelectorsToElements(selectors) {
    const elements = [];
    const removedSelectors = [];
    const removalReasons = new Map();

    console.log(`Converting ${selectors.length} selectors to elements...`);
    console.log("Sample selectors:", selectors.slice(0, 5));

    for (const selector of selectors) {
      // Type guard to ensure we're working with strings
      if (typeof selector !== "string") {
        console.error("Expected selector string, got", selector);
        removedSelectors.push(selector);
        removalReasons.set(selector, "Invalid selector type");
        continue;
      }

      try {
        console.log(`Trying to find element with selector: "${selector}"`);
        const element = document.querySelector(selector);
        if (element) {
          console.log(`✓ Found element: ${element.tagName}`, element);
          elements.push(element);
        } else {
          console.log(`✗ Selector not found: "${selector}"`);
          removedSelectors.push(selector);
          removalReasons.set(selector, "Element not found in DOM");
          console.warn(`Selector not found: ${selector}`);
        }
      } catch (error) {
        console.log(`✗ Invalid selector: "${selector}" - ${error.message}`);
        removedSelectors.push(selector);
        removalReasons.set(selector, `Invalid selector: ${error.message}`);
        console.warn(`Invalid selector: ${selector}`, error);
      }
    }

    console.log(
      `Successfully converted ${elements.length}/${selectors.length} selectors`
    );
    if (removedSelectors.length > 0) {
      console.warn(`Failed selectors:`, removedSelectors);
      // Create mock element objects for failed selectors
      const failedElementObjects = removedSelectors.map((selector) => ({
        selector: selector,
        tagName: "unknown",
        className: "",
        id: "",
        role: "",
        ariaLabel: "",
        innerText: "",
        rect: { width: 0, height: 0, top: 0, left: 0 },
        isRemoved: true,
        removalReason: removalReasons.get(selector) || "Unknown error",
      }));

      // Show debug overlay for failed selectors
      showFilterDebugOverlay(
        "Selector Conversion",
        failedElementObjects,
        "Invalid or not found",
        10,
        "Selector conversion",
        removalReasons
      );
    }

    return { elements, removedSelectors, removalReasons };
  }

  /**
   * Apply top-level filtering with reasons
   * @param {Array} elements - Array of elements
   * @returns {Object} {survivors: Element[], removedReasons: Map<string, string>}
   */
  applyTopLevelFilteringWithReasons(elements) {
    // Type guard to ensure we're working with Elements
    if (elements.length > 0 && !(elements[0] instanceof Element)) {
      console.error(
        "applyTopLevelFilteringWithReasons expects Element array, got:",
        elements[0]
      );
      return { survivors: [], removedReasons: new Map() };
    }

    const survivors = [];
    const removedReasons = new Map();

    // Filter out elements that are no longer in the DOM
    const validElements = elements.filter((element) => {
      try {
        // Check if element is still in the DOM
        if (!element || !element.getBoundingClientRect) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        // Check if rect is valid and has dimensions
        return rect && rect.width !== undefined && rect.height !== undefined;
      } catch (error) {
        console.warn("Element no longer in DOM:", element);
        return false;
      }
    });

    if (validElements.length === 0) {
      console.warn("No valid elements found for top-level filtering");
      return { survivors: [], removedReasons: new Map() };
    }

    const rects = validElements
      .map((element) => {
        try {
          return {
            element,
            rect: element.getBoundingClientRect(),
          };
        } catch (error) {
          console.warn(
            "Error getting bounding rect for element:",
            element,
            error
          );
          return null;
        }
      })
      .filter(Boolean); // Remove null entries

    for (let i = 0; i < rects.length; i++) {
      let isTopLevel = true;
      let containedBy = null;

      for (let j = 0; j < rects.length; j++) {
        if (i === j) continue;

        try {
          const iou = calculateIoU(rects[i].rect, rects[j].rect);
          if (iou > THRESHOLDS.IOU_CONTAINMENT) {
            // Check if element i is contained within element j
            const areaI = calculateArea(rects[i].rect);
            const areaJ = calculateArea(rects[j].rect);

            if (areaI < areaJ) {
              isTopLevel = false;
              containedBy = rects[j].element;
              break;
            }
          }
        } catch (error) {
          console.warn("Error calculating IoU or area:", error);
          continue;
        }
      }

      if (isTopLevel) {
        survivors.push(rects[i].element);
      } else {
        const selector = cacheSelector(rects[i].element);
        const containerSelector = containedBy
          ? cacheSelector(containedBy)
          : "unknown";
        removedReasons.set(
          selector,
          `contained by larger element: ${containerSelector}`
        );
      }
    }

    return { survivors, removedReasons };
  }

  /**
   * Filter structural elements with reasons
   * @param {Array} elements - Array of elements
   * @returns {Object} {survivors: Element[], removedReasons: Map<string, string>}
   */
  filterStructuralElementsWithReasons(elements) {
    // Type guard to ensure we're working with Elements
    if (elements.length > 0 && !(elements[0] instanceof Element)) {
      console.error(
        "filterStructuralElementsWithReasons expects Element array, got:",
        elements[0]
      );
      return { survivors: [], removedReasons: new Map() };
    }

    const survivors = [];
    const removedReasons = new Map();

    for (const element of elements) {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute("role");
      const className = element.className || "";
      const id = element.id || "";

      // Keep interactive elements
      if (this.isInteractiveElement(element)) {
        survivors.push(element);
        continue;
      }

      // Keep structural elements
      if (
        [
          "nav",
          "header",
          "footer",
          "main",
          "section",
          "article",
          "aside",
        ].includes(tag)
      ) {
        survivors.push(element);
        continue;
      }

      // Keep elements with meaningful roles
      if (
        role &&
        [
          "navigation",
          "banner",
          "contentinfo",
          "main",
          "search",
          "menuitem",
          "tab",
        ].includes(role)
      ) {
        survivors.push(element);
        continue;
      }

      // Keep divs and spans that have UI-like attributes
      if (tag === "div" || tag === "span") {
        // Keep if it has data attributes (common in modern frameworks)
        if (element.hasAttribute("data-")) {
          survivors.push(element);
          continue;
        }
        // Keep if it has common UI class patterns
        if (
          className.includes("btn") ||
          className.includes("button") ||
          className.includes("nav") ||
          className.includes("menu") ||
          className.includes("header") ||
          className.includes("footer") ||
          className.includes("sidebar") ||
          className.includes("modal") ||
          className.includes("dropdown") ||
          className.includes("tab")
        ) {
          survivors.push(element);
          continue;
        }
        // Keep if it has meaningful ID
        if (
          id &&
          (id.includes("btn") ||
            id.includes("nav") ||
            id.includes("menu") ||
            id.includes("header") ||
            id.includes("footer"))
        ) {
          survivors.push(element);
          continue;
        }
        // Keep if it has click handlers or event listeners
        if (element.onclick || element.getAttribute("onclick")) {
          survivors.push(element);
          continue;
        }
        // Keep if it has cursor pointer
        const style = window.getComputedStyle(element);
        if (style.cursor === "pointer") {
          survivors.push(element);
          continue;
        }
      }

      // Keep form elements
      if (["form", "fieldset", "legend", "optgroup", "option"].includes(tag)) {
        survivors.push(element);
        continue;
      }

      // Keep elements with text content (likely meaningful)
      if (element.innerText && element.innerText.trim().length > 0) {
        survivors.push(element);
        continue;
      }

      // If we get here, the element is not structural
      const violations = [];

      if (!this.isInteractiveElement(element)) {
        violations.push("not interactive");
      }

      if (
        ![
          "nav",
          "header",
          "footer",
          "main",
          "section",
          "article",
          "aside",
        ].includes(tag)
      ) {
        violations.push(`not structural tag (${tag})`);
      }

      if (
        !role ||
        ![
          "navigation",
          "banner",
          "contentinfo",
          "main",
          "search",
          "menuitem",
          "tab",
        ].includes(role)
      ) {
        violations.push(`no meaningful role (${role || "none"})`);
      }

      if (tag === "div" || tag === "span") {
        if (!element.hasAttribute("data-"))
          violations.push("no data attributes");
        if (
          !className.includes("btn") &&
          !className.includes("button") &&
          !className.includes("nav") &&
          !className.includes("menu") &&
          !className.includes("header") &&
          !className.includes("footer") &&
          !className.includes("sidebar") &&
          !className.includes("modal") &&
          !className.includes("dropdown") &&
          !className.includes("tab")
        )
          violations.push("no UI class patterns");
        if (
          !id ||
          (!id.includes("btn") &&
            !id.includes("nav") &&
            !id.includes("menu") &&
            !id.includes("header") &&
            !id.includes("footer"))
        )
          violations.push("no meaningful ID");
        if (!element.onclick && !element.getAttribute("onclick"))
          violations.push("no click handlers");
        const style = window.getComputedStyle(element);
        if (style.cursor !== "pointer") violations.push("no pointer cursor");
      }

      if (!["form", "fieldset", "legend", "optgroup", "option"].includes(tag)) {
        violations.push("not form element");
      }

      if (!element.innerText || element.innerText.trim().length === 0) {
        violations.push("no text content");
      }

      const selector = cacheSelector(element);
      removedReasons.set(selector, `not structural: ${violations.join(", ")}`);
    }

    console.log(
      `Structural filtering: ${elements.length} → ${survivors.length} elements`
    );

    // Ensure we keep at least some elements
    if (survivors.length === 0 && elements.length > 0) {
      console.warn(
        "Structural filtering removed all elements, keeping first 3"
      );
      const fallbackElements = elements.slice(0, Math.min(3, elements.length));
      return { survivors: fallbackElements, removedReasons: new Map() };
    }

    return { survivors, removedReasons };
  }

  /**
   * Get selector for an element
   * @param {Element} element - DOM element
   * @returns {string} CSS selector
   */
  getSelector(element) {
    if (!element) return "unknown";
    if (element.id) {
      return `#${CSS.escape(element.id)}`;
    }

    // Simple selector generation
    let selector = element.tagName.toLowerCase();
    if (element.className) {
      const classes = element.className.split(" ").filter((c) => c.trim());
      if (classes.length > 0) {
        selector += "." + classes.map((c) => CSS.escape(c)).join(".");
      }
    }

    return selector;
  }

  /**
   * Prioritize interactive elements
   * @param {Array} elements - Array of elements
   * @returns {Array} Reordered elements with interactive elements first
   */
  prioritizeInteractiveElements(elements) {
    const interactive = [];
    const nonInteractive = [];

    for (const element of elements) {
      if (this.isInteractiveElement(element)) {
        interactive.push(element);
      } else {
        nonInteractive.push(element);
      }
    }

    return [...interactive, ...nonInteractive];
  }

  /**
   * Cluster-based deduplication using rich signatures and embeddings
   * @param {Array<Element>} elements
   * @returns {Promise<Array<Element>>} Deduped elements
   */
  async clusterDeduplicateElements(elements) {
    // 1. Extract signatures
    const items = elements.map((el) => extractElementSignature(el));
    // 2. Compute embeddings
    for (const item of items) {
      item.vec = await embedText(item.text);
    }
    // 3. Cluster
    const clusters = [];
    for (const item of items) {
      let placed = false;
      for (const cluster of clusters) {
        const rep = cluster[0];
        if (item.href === rep.href && item.icon === rep.icon) {
          const sim = cosineSimilarity(item.vec, rep.vec);
          if (sim >= 0.9) {
            cluster.push(item);
            placed = true;
            break;
          }
        }
      }
      if (!placed) clusters.push([item]);
    }
    // 4. Collapse
    return clusters.map((c) => c[0].el);
  }

  /**
   * Apply LLM analysis to elements
   * @param {Array} elements - Array of elements
   * @param {Function} updateProgress - Progress update function
   * @param {number} startStep - Starting step number
   * @param {number} endStep - Ending step number
   * @returns {Promise<Array>} Promise that resolves with analyzed elements
   */
  async applyLLMAnalysis(elements, updateProgress, startStep, endStep) {
    // Type guard to ensure we're working with Elements
    if (elements.length > 0 && !(elements[0] instanceof Element)) {
      console.error(
        "applyLLMAnalysis expects Element array, got:",
        elements[0]
      );
      return [];
    }

    const batchSize = 5;
    const batches = Math.ceil(elements.length / batchSize);
    const stepIncrement = (endStep - startStep) / batches;

    const analyzed = [];

    for (let i = 0; i < batches; i++) {
      const batchStart = i * batchSize;
      const batchEnd = Math.min(batchStart + batchSize, elements.length);
      const batch = elements.slice(batchStart, batchEnd);

      const currentStep = startStep + Math.round(i * stepIncrement);
      updateProgress(currentStep, `LLM analysis: batch ${i + 1}/${batches}...`);

      try {
        const batchResults = await this.llmService.analyzeElements(batch);

        // Ensure we return DOM elements with attached metadata, not plain objects
        const processedResults = batchResults.map((result, index) => {
          const originalElement = batch[index];
          if (originalElement instanceof Element) {
            // Attach LLM analysis metadata to the original DOM element
            originalElement.llmAnalysis = result;
            return originalElement;
          } else {
            // If LLM service returned something unexpected, use fallback
            return this.fallbackAnalysis(originalElement);
          }
        });

        analyzed.push(...processedResults);
      } catch (error) {
        console.warn(`Error in LLM batch ${i + 1}:`, error);
        // Fallback to rule-based analysis - keep original DOM elements
        const fallbackResults = batch.map((element) => {
          const analysis = this.fallbackAnalysis(element);
          // Attach fallback analysis to the original element
          if (element instanceof Element) {
            element.llmAnalysis = analysis;
            return element;
          }
          return analysis;
        });
        analyzed.push(...fallbackResults);
      }
    }

    return analyzed;
  }

  /**
   * Apply final quality filtering with reasons
   * @param {Array} elements - Array of elements
   * @returns {Object} {survivors: Element[], removedReasons: Map<string, string>}
   */
  applyFinalQualityFilteringWithReasons(elements) {
    // Type guard to ensure we're working with Elements
    if (elements.length > 0 && !(elements[0] instanceof Element)) {
      console.error(
        "applyFinalQualityFilteringWithReasons expects Element array, got:",
        elements[0]
      );
      return { survivors: [], removedReasons: new Map() };
    }

    const survivors = [];
    const removedReasons = new Map();

    for (const element of elements) {
      // Check if element is fundamental UI component
      const analysis = this.isFundamentalUIComponent(element);

      if (analysis.isFundamental) {
        survivors.push(element);
      } else {
        const selector = cacheSelector(element);
        removedReasons.set(selector, analysis.reason);
      }
    }

    return { survivors, removedReasons };
  }

  /**
   * Apply final quality filtering
   * @param {Array} elements - Array of elements
   * @returns {Array} Filtered elements
   */
  applyFinalQualityFiltering(elements) {
    const originalCount = elements.length;
    const removedElements = [];
    const removalReasons = new Map(); // element -> reason

    const filteredElements = elements.filter((element) => {
      // Check if element is fundamental UI component
      const analysis = this.isFundamentalUIComponent(element);

      if (!analysis.isFundamental) {
        removedElements.push(element);
        removalReasons.set(element, analysis.reason);
      }

      return analysis.isFundamental;
    });

    // Show debug overlay for removed elements
    if (removedElements.length > 0) {
      showFilterDebugOverlay(
        "Final Quality Filtering",
        removedElements,
        "Element not considered fundamental UI component",
        17, // Step 17 for final quality filtering
        "applyFinalQualityFiltering",
        removalReasons // Pass specific reasons
      );
    }

    return filteredElements;
  }

  /**
   * Apply confidence scoring
   * @param {Array} elements - Array of elements
   * @returns {Array} Elements with confidence scores
   */
  applyConfidenceScoring(elements) {
    return elements.map((element) => {
      const confidence = this.calculateConfidence(element);
      return { ...element, confidence };
    });
  }

  /**
   * Sort elements by relevance
   * @param {Array} elements - Array of elements
   * @returns {Array} Sorted elements
   */
  sortByRelevance(elements) {
    return elements.sort((a, b) => {
      // Sort by confidence first
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }

      // Then by interactivity
      const aInteractive = this.isInteractiveElement(a);
      const bInteractive = this.isInteractiveElement(b);
      if (aInteractive !== bInteractive) {
        return bInteractive ? 1 : -1;
      }

      // Then by area (larger elements first)
      let aArea = 0;
      let bArea = 0;

      try {
        // Check if elements have rect property (from previous processing)
        if (a.rect && b.rect) {
          aArea = a.rect.width * a.rect.height;
          bArea = b.rect.width * b.rect.height;
        } else {
          // Fallback to getBoundingClientRect
          const aRect = a.getBoundingClientRect();
          const bRect = b.getBoundingClientRect();
          aArea = aRect.width * aRect.height;
          bArea = bRect.width * bRect.height;
        }
      } catch (error) {
        console.warn("Error calculating area for sorting:", error);
        // If we can't calculate area, keep original order
        return 0;
      }

      return bArea - aArea;
    });
  }

  /**
   * Check if element is interactive
   * @param {Element} element - DOM element
   * @returns {boolean} True if element is interactive
   */
  isInteractiveElement(element) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");

    return (
      ["button", "input", "select", "textarea", "a"].includes(tag) ||
      role === "button" ||
      role === "link" ||
      element.onclick ||
      element.getAttribute("onclick")
    );
  }

  /**
   * Calculate semantic similarity between two elements
   * @param {Element} elementA - First element
   * @param {Element} elementB - Second element
   * @returns {number} Similarity score between 0 and 1
   */
  calculateSemanticSimilarity(elementA, elementB) {
    const textA = elementA.innerText?.trim().toLowerCase() || "";
    const textB = elementB.innerText?.trim().toLowerCase() || "";

    if (textA === textB) return 1.0;
    if (textA.length === 0 || textB.length === 0) return 0.0;

    // Simple text similarity (can be improved with more sophisticated algorithms)
    const wordsA = textA.split(/\s+/);
    const wordsB = textB.split(/\s+/);
    const commonWords = wordsA.filter((word) => wordsB.includes(word));

    return commonWords.length / Math.max(wordsA.length, wordsB.length);
  }

  /**
   * Calculate functional similarity between two elements
   * @param {Element} elementA - First element
   * @param {Element} elementB - Second element
   * @returns {number} Similarity score between 0 and 1
   */
  calculateFunctionalSimilarity(elementA, elementB) {
    const tagA = elementA.tagName.toLowerCase();
    const tagB = elementB.tagName.toLowerCase();
    const roleA = elementA.getAttribute("role");
    const roleB = elementB.getAttribute("role");

    // Same tag and role
    if (tagA === tagB && roleA === roleB) return 1.0;

    // Same role
    if (roleA && roleA === roleB) return 0.8;

    // Same tag
    if (tagA === tagB) return 0.6;

    // Both interactive
    if (
      this.isInteractiveElement(elementA) &&
      this.isInteractiveElement(elementB)
    ) {
      return 0.4;
    }

    return 0.0;
  }

  /**
   * Fallback analysis when LLM is not available
   * @param {Element} element - DOM element
   * @returns {Object} Analysis result
   */
  fallbackAnalysis(element) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const text = element.innerText?.trim() || "";

    let elementType = "container";
    let confidence = 0.5;

    if (tag === "button" || role === "button") {
      elementType = "button";
      confidence = 0.9;
    } else if (tag === "input") {
      elementType = "input";
      confidence = 0.9;
    } else if (tag === "a" || role === "link") {
      elementType = "link";
      confidence = 0.8;
    } else if (tag === "nav" || role === "navigation") {
      elementType = "navigation";
      confidence = 0.8;
    } else if (text.length > 0) {
      elementType = "text";
      confidence = 0.6;
    }

    return { ...element, elementType, confidence };
  }

  /**
   * Check if element is a fundamental UI component
   * @param {Element} element - DOM element
   * @returns {Object} {isFundamental: boolean, reason: string} - Analysis result
   */
  isFundamentalUIComponent(element) {
    // Check if element is still valid
    if (!element || !element.getBoundingClientRect) {
      return { isFundamental: false, reason: "Element no longer in DOM" };
    }

    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const text = element.innerText?.trim() || "";

    let rect;
    let area = 0;
    try {
      rect = element.getBoundingClientRect();
      area = rect.width * rect.height;
    } catch (error) {
      console.warn("Error getting bounding rect for element:", element, error);
      return { isFundamental: false, reason: "Cannot get element dimensions" };
    }

    // Interactive elements are fundamental
    if (this.isInteractiveElement(element)) {
      return { isFundamental: true, reason: "Interactive element" };
    }

    // Elements with meaningful text are fundamental (removed upper bound)
    if (text.length > 0) {
      return {
        isFundamental: true,
        reason: `Has text content (${text.length} chars)`,
      };
    }

    // Expanded structural elements are fundamental
    const structuralTags = [
      "nav",
      "header",
      "footer",
      "main",
      "section",
      "article",
      "aside",
    ];
    if (structuralTags.includes(tag)) {
      return { isFundamental: true, reason: `Structural tag: ${tag}` };
    }

    // Expanded meaningful roles are fundamental
    const landmarkRoles = [
      "navigation",
      "banner",
      "contentinfo",
      "main",
      "region",
      "complementary",
      "search",
      "form",
      "application",
      "document",
      "content",
      "note",
      "log",
      "marquee",
      "status",
      "timer",
      "toolbar",
    ];
    if (role && landmarkRoles.includes(role)) {
      return { isFundamental: true, reason: `Landmark role: ${role}` };
    }

    // Large containers with significant area are fundamental
    if (area > 50000) {
      // 50,000 px² threshold
      return {
        isFundamental: true,
        reason: `Large area: ${Math.round(area)}px²`,
      };
    }

    // Elements with many visible child elements are fundamental
    let visibleChildren = [];
    try {
      visibleChildren = Array.from(element.children).filter((child) => {
        try {
          const childRect = child.getBoundingClientRect();
          const style = window.getComputedStyle(child);
          return (
            childRect.width > 0 &&
            childRect.height > 0 &&
            style.display !== "none" &&
            style.visibility !== "hidden"
          );
        } catch (error) {
          return false;
        }
      });
    } catch (error) {
      console.warn("Error checking visible children:", error);
      visibleChildren = [];
    }

    if (visibleChildren.length >= 5) {
      // 5+ visible children threshold
      return {
        isFundamental: true,
        reason: `Many visible children: ${visibleChildren.length}`,
      };
    }

    // Elements with ARIA landmarks or regions
    if (
      element.hasAttribute("aria-label") ||
      element.hasAttribute("aria-labelledby") ||
      element.hasAttribute("aria-describedby")
    ) {
      return { isFundamental: true, reason: "Has ARIA attributes" };
    }

    // Form containers and form-related elements
    if (tag === "form" || element.closest("form")) {
      return { isFundamental: true, reason: "Form-related element" };
    }

    // Elements with data attributes (common in modern frameworks)
    if (element.hasAttribute("data-")) {
      return { isFundamental: true, reason: "Has data attributes" };
    }

    // Elements with meaningful IDs
    const id = element.id || "";
    if (
      id &&
      (id.includes("main") ||
        id.includes("content") ||
        id.includes("container") ||
        id.includes("wrapper") ||
        id.includes("section") ||
        id.includes("panel"))
    ) {
      return { isFundamental: true, reason: `Meaningful ID: ${id}` };
    }

    // If we get here, the element is not fundamental
    const violations = [];

    if (text.length === 0) {
      violations.push("no text content");
    }

    if (!structuralTags.includes(tag)) {
      violations.push(`not a structural tag (${tag})`);
    }

    if (!role || !landmarkRoles.includes(role)) {
      violations.push(`no landmark role (${role || "none"})`);
    }

    if (area <= 50000) {
      violations.push(`small area: ${Math.round(area)}px²`);
    }

    if (visibleChildren.length < 5) {
      violations.push(`few visible children: ${visibleChildren.length}`);
    }

    if (
      !element.hasAttribute("aria-label") &&
      !element.hasAttribute("aria-labelledby") &&
      !element.hasAttribute("aria-describedby")
    ) {
      violations.push("no ARIA attributes");
    }

    if (tag !== "form" && !element.closest("form")) {
      violations.push("not form-related");
    }

    if (!element.hasAttribute("data-")) {
      violations.push("no data attributes");
    }

    if (
      !id ||
      (!id.includes("main") &&
        !id.includes("content") &&
        !id.includes("container") &&
        !id.includes("wrapper") &&
        !id.includes("section") &&
        !id.includes("panel"))
    ) {
      violations.push("no meaningful ID");
    }

    return {
      isFundamental: false,
      reason: `not fundamental: ${violations.join(", ")}`,
    };
  }

  /**
   * Calculate confidence score for an element
   * @param {Element} element - DOM element
   * @returns {number} Confidence score between 0 and 1
   */
  calculateConfidence(element) {
    let confidence = 0.5;

    // Boost confidence for interactive elements
    if (this.isInteractiveElement(element)) {
      confidence += 0.3;
    }

    // Boost confidence for elements with text
    if (element.innerText?.trim()) {
      confidence += 0.2;
    }

    // Boost confidence for elements with roles
    if (element.getAttribute("role")) {
      confidence += 0.1;
    }

    // Boost confidence for larger elements
    const area = element.rect.width * element.rect.height;
    if (area > 1000) {
      confidence += 0.1;
    }

    return Math.min(confidence, 1.0);
  }
}

// Global tracking for debug overlay
let debugStepData = new Map(); // stepNumber -> { stepName, reason, functionName, elements: [] }
let debugOverlay = null;
let highlightOverlay = null; // New: overlay for highlighting elements on hover

// Debug overlay for filtering steps - more efficient approach
function showFilterDebugOverlay(
  stepName,
  removedElements,
  reason,
  stepNumber = null,
  functionName = null,
  removalReasons = null // New parameter for specific reasons
) {
  if (!removedElements || removedElements.length === 0) return;

  // Ensure every removed element has a specific reason
  if (removalReasons) {
    removedElements.forEach((el) => {
      const selector =
        el._scopeCachedSelector ||
        el.selector ||
        (el.element && computeUniqueCssPath(el.element)) ||
        "unknown";
      if (!removalReasons.has(selector)) {
        removalReasons.set(
          selector,
          `No specific reason recorded (step: ${stepName})`
        );
      }
    });
  }

  // Store step data
  if (stepNumber !== null) {
    debugStepData.set(stepNumber, {
      stepName,
      reason,
      functionName,
      elements: removedElements.map(createRichElementObject),
      removalReasons: removalReasons, // Store specific reasons
    });
  }

  // Create or update the debug overlay
  if (!debugOverlay) {
    debugOverlay = document.createElement("div");
    debugOverlay.id = "scope-filter-debug-overlay";
    debugOverlay.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      background: #222;
      color: #fff;
      border: 2px solid #ffc107;
      border-radius: 10px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.18);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 18px 18px 12px 18px;
      font-size: 13px;
    `;
    document.body.appendChild(debugOverlay);
  }

  // Create highlight overlay for hover effects
  if (!highlightOverlay) {
    highlightOverlay = document.createElement("div");
    highlightOverlay.id = "scope-highlight-overlay";
    highlightOverlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 999998;
    `;
    document.body.appendChild(highlightOverlay);
  }

  // Clear and rebuild the overlay content
  debugOverlay.innerHTML = "";

  // Add title
  const title = document.createElement("div");
  title.style.cssText =
    "font-size: 16px; font-weight: bold; color: #ffc107; margin-bottom: 15px; border-bottom: 1px solid #444; padding-bottom: 8px;";
  title.textContent = "🔍 Filtering Debug - Elements Removed by Step";
  debugOverlay.appendChild(title);

  // Add close button
  const closeBtn = document.createElement("button");
  closeBtn.textContent = "Close Debug Overlay";
  closeBtn.style.cssText =
    "position: absolute; top: 15px; right: 15px; background: #ffc107; color: #222; border: none; border-radius: 5px; padding: 6px 12px; font-size: 12px; cursor: pointer;";
  closeBtn.onclick = () => {
    debugOverlay.remove();
    debugOverlay = null;
    if (highlightOverlay) {
      highlightOverlay.remove();
      highlightOverlay = null;
    }
  };
  debugOverlay.appendChild(closeBtn);

  // Sort steps by step number
  const sortedSteps = Array.from(debugStepData.entries()).sort(
    ([a], [b]) => a - b
  );

  // Create sections for each step
  sortedSteps.forEach(([stepNum, stepData]) => {
    const section = document.createElement("div");
    section.style.cssText =
      "margin-bottom: 20px; border: 1px solid #444; border-radius: 8px; padding: 12px;";

    // Step header
    const header = document.createElement("div");
    header.style.cssText =
      "font-weight: bold; color: #ffc107; margin-bottom: 8px; font-size: 14px;";
    header.textContent = `Step ${stepNum}: ${stepData.stepName}`;
    if (stepData.functionName) {
      header.textContent += ` (${stepData.functionName})`;
    }
    header.textContent += ` - Removed ${stepData.elements.length} elements`;
    section.appendChild(header);

    // Reason
    if (stepData.reason) {
      const reasonDiv = document.createElement("div");
      reasonDiv.style.cssText =
        "color: #aaa; font-size: 12px; margin-bottom: 10px; font-style: italic;";
      reasonDiv.textContent = `Reason: ${stepData.reason}`;
      section.appendChild(reasonDiv);
    }

    // Elements list
    if (stepData.elements.length > 0) {
      const list = document.createElement("ul");
      list.style.cssText =
        "list-style: none; padding: 0; margin: 0; max-height: 150px; overflow-y: auto;";

      stepData.elements.forEach((el, index) => {
        const li = document.createElement("li");
        li.style.cssText =
          "margin-bottom: 4px; padding: 4px 6px; background: #333; border-radius: 4px; font-size: 12px; cursor: pointer; position: relative; transition: background-color 0.2s;";

        let elementInfo = "";
        const tagName = el.tagName || "unknown";
        const size = el.boundingRect
          ? `${Math.round(el.boundingRect.width)}x${Math.round(
              el.boundingRect.height
            )}`
          : "unknown";
        const role = el.role || "";
        const ariaLabel = el.ariaLabel || "";
        const text = el.text || "";
        const selector = el.selector || "unknown";

        // Build element info string
        elementInfo = `${index + 1}. ${tagName}`;

        if (size !== "unknown") {
          elementInfo += ` (${size})`;
        }

        if (role) {
          elementInfo += ` [role="${role}"]`;
        }

        if (selector && selector !== "unknown") {
          const displaySelector =
            selector.length > 40 ? selector.substring(0, 40) + "..." : selector;
          elementInfo += ` - ${displaySelector}`;
        }

        if (text) {
          elementInfo += ` - "${text.substring(0, 30)}${
            text.length > 30 ? "..." : ""
          }"`;
        }

        if (ariaLabel && ariaLabel !== text) {
          elementInfo += ` [aria-label="${ariaLabel.substring(0, 20)}${
            ariaLabel.length > 20 ? "..." : ""
          }"]`;
        }

        li.textContent = elementInfo;

        // Add hover highlighting functionality
        li.addEventListener("mouseenter", () => {
          li.style.backgroundColor = "#555";
          highlightElementOnPage(el);
        });

        li.addEventListener("mouseleave", () => {
          li.style.backgroundColor = "#333";
          clearHighlight();
        });

        // Add hover tooltip for specific removal reason if available
        if (
          stepData.removalReasons &&
          stepData.removalReasons.has(el.selector)
        ) {
          const specificReason = stepData.removalReasons.get(el.selector);

          // Add visual indicator that tooltip is available
          li.style.borderLeft = "3px solid #ffc107";
          li.title = "Hover for removal reason";

          // Create tooltip
          const tooltip = document.createElement("div");
          tooltip.style.cssText = `
            position: absolute;
            bottom: 100%;
            left: 0;
            background: #000;
            color: #fff;
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            max-width: 300px;
            white-space: normal;
            word-wrap: break-word;
            z-index: 1000000;
            opacity: 0;
            visibility: hidden;
            transition: opacity 0.2s, visibility 0.2s;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            border: 1px solid #444;
            pointer-events: none;
          `;

          // Set tooltip content
          tooltip.textContent = `Removal reason: ${specificReason}`;
          li.appendChild(tooltip);

          // Show tooltip on hover
          li.addEventListener("mouseenter", () => {
            tooltip.style.opacity = "1";
            tooltip.style.visibility = "visible";
          });

          li.addEventListener("mouseleave", () => {
            tooltip.style.opacity = "0";
            tooltip.style.visibility = "hidden";
          });
        }

        list.appendChild(li);
      });

      section.appendChild(list);
    }

    debugOverlay.appendChild(section);
  });

  // Add summary
  const totalRemoved = Array.from(debugStepData.values()).reduce(
    (sum, step) => sum + step.elements.length,
    0
  );
  const summary = document.createElement("div");
  summary.style.cssText =
    "margin-top: 15px; padding-top: 10px; border-top: 1px solid #444; color: #aaa; font-size: 12px; text-align: center;";
  summary.textContent = `Total: ${totalRemoved} elements removed across ${
    debugStepData.size
  } steps | ${new Date().toLocaleTimeString()}`;
  debugOverlay.appendChild(summary);
}

// Function to highlight an element on the page
function highlightElementOnPage(elementData) {
  if (!highlightOverlay) {
    console.warn("Highlight overlay not available");
    return;
  }

  // Clear any existing highlights
  clearHighlight();

  let targetElement = null;

  // Try to find the element using the selector
  if (elementData.selector && elementData.selector !== "unknown") {
    try {
      targetElement = document.querySelector(elementData.selector);
      if (!targetElement) {
        console.warn("Element not found with selector:", elementData.selector);
      }
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

  // If we still don't have a target element, try to find it by other means
  if (!targetElement) {
    console.warn("No target element found for highlighting:", elementData);
    return;
  }

  // Check if element has getBoundingClientRect
  if (!targetElement.getBoundingClientRect) {
    console.warn(
      "Element does not have getBoundingClientRect method:",
      targetElement
    );
    return;
  }

  try {
    // Always scroll the element into view (centered, smooth)
    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });

    // Wait a bit for scroll to complete, then get the rect
    setTimeout(() => {
      try {
        const rect = targetElement.getBoundingClientRect();

        // Debug logging
        console.log("Highlighting element:", {
          tagName: targetElement.tagName,
          selector: elementData.selector,
          rect: {
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
            area: rect.width * rect.height,
          },
          scrollY: window.scrollY,
          scrollX: window.scrollX,
        });

        // Check if element has valid dimensions
        if (rect.width <= 0 || rect.height <= 0) {
          console.warn("Element has zero or negative dimensions:", {
            width: rect.width,
            height: rect.height,
            element: targetElement,
          });
          return;
        }

        // Check if element is in viewport
        if (
          rect.bottom < 0 ||
          rect.top > window.innerHeight ||
          rect.right < 0 ||
          rect.left > window.innerWidth
        ) {
          console.warn("Element is outside viewport:", {
            rect,
            viewport: { width: window.innerWidth, height: window.innerHeight },
          });
        }

        // Create highlight box with improved positioning
        const highlightBox = document.createElement("div");
        const top = rect.top + window.scrollY;
        const left = rect.left + window.scrollX;

        highlightBox.style.cssText = `
          position: absolute;
          top: ${top}px;
          left: ${left}px;
          width: ${rect.width}px;
          height: ${rect.height}px;
          border: 3px solid #ff4444;
          background: rgba(255, 68, 68, 0.1);
          border-radius: 4px;
          pointer-events: none;
          z-index: 999997;
          box-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
          animation: pulse 1s infinite;
        `;

        // Add pulse animation if not already present
        if (!document.querySelector("#scope-pulse-animation")) {
          const style = document.createElement("style");
          style.id = "scope-pulse-animation";
          style.textContent = `
            @keyframes pulse {
              0% { opacity: 0.7; }
              50% { opacity: 1; }
              100% { opacity: 0.7; }
            }
          `;
          document.head.appendChild(style);
        }

        highlightOverlay.appendChild(highlightBox);

        // Add label with element info
        const label = document.createElement("div");
        const labelTop = Math.max(0, top - 30);

        label.style.cssText = `
          position: absolute;
          top: ${labelTop}px;
          left: ${left}px;
          background: #ff4444;
          color: white;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: bold;
          white-space: nowrap;
          pointer-events: none;
          z-index: 999997;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
        `;

        const tagName =
          elementData.tagName ||
          targetElement.tagName.toLowerCase() ||
          "unknown";
        const size = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
        const text = elementData.text || targetElement.innerText?.trim() || "";
        const displayText =
          text.length > 20 ? text.substring(0, 20) + "..." : text;

        label.textContent = `${tagName} (${size}) - ${displayText}`;
        label.title = `${tagName} (${size}) - ${text}`;

        highlightOverlay.appendChild(label);

        console.log("Highlight created successfully for:", tagName, size);
      } catch (error) {
        console.error("Error creating highlight:", error);
      }
    }, 100); // Small delay to ensure scroll completes
  } catch (error) {
    console.error("Error highlighting element:", error);
  }
}

// Function to clear highlight
function clearHighlight() {
  if (highlightOverlay) {
    highlightOverlay.innerHTML = "";
  }
}

// Function to clear debug data (useful for resetting between runs)
function clearDebugData() {
  debugStepData.clear();
  if (debugOverlay) {
    debugOverlay.remove();
    debugOverlay = null;
  }
  if (highlightOverlay) {
    highlightOverlay.remove();
    highlightOverlay = null;
  }
}

// Make debug functions available globally
window.clearDebugData = clearDebugData;
window.showFilterDebugOverlay = showFilterDebugOverlay;
window.debugStepData = debugStepData;

// Helper function to create rich element objects for debug overlay
function createRichElementObject(el) {
  if (el instanceof Element) {
    // Compute unique CSS path for the element
    const uniqueSelector = computeUniqueCssPath(el);
    const rect = el.getBoundingClientRect();
    const text = el.innerText?.trim() || "";
    const role = el.getAttribute("role") || null;
    const ariaLabel = el.getAttribute("aria-label") || null;

    return {
      selector: uniqueSelector,
      tagName: el.tagName.toLowerCase(),
      text,
      boundingRect: rect.toJSON(),
      role,
      ariaLabel,
      element: el, // Keep reference to original element
    };
  } else if (el && typeof el === "object") {
    // Already a rich object, just ensure it has all fields
    return {
      selector: el.selector || "unknown",
      tagName: el.tagName || el.type || "unknown",
      text: el.text || el.innerText || "",
      boundingRect: el.boundingRect || el.rect || null,
      role: el.role || null,
      ariaLabel: el.ariaLabel || null,
      element: el.element || null,
    };
  } else if (typeof el === "string") {
    // String - try to resolve it
    try {
      const domEl = document.querySelector(el);
      if (domEl) {
        return createRichElementObject(domEl);
      }
    } catch (error) {
      console.warn(`Could not resolve selector: ${el}`, error);
    }

    // Fallback for unresolved string
    return {
      selector: el,
      tagName: "unknown",
      text: "",
      boundingRect: null,
      role: null,
      ariaLabel: null,
      element: null,
    };
  }

  // Unknown type
  return {
    selector: "unknown",
    tagName: "unknown",
    text: "",
    boundingRect: null,
    role: null,
    ariaLabel: null,
    element: null,
  };
}

// Helper function to compute unique CSS path (copied from content script)
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
