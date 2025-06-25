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

    let filtered = elements;

    // Step 1: Visibility filtering
    filtered = this.visibilityFilter.filter(filtered);
    console.log(`After visibility filtering: ${filtered.length} elements`);

    // Step 2: Basic deduplication
    filtered = this.deduplicationFilter.applyLightDeduplication(filtered);
    console.log(`After deduplication: ${filtered.length} elements`);

    // Step 3: Spatial filtering
    filtered = this.spatialFilter.filterByViewportBounds(filtered);
    console.log(`After spatial filtering: ${filtered.length} elements`);

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

    const totalSteps = 25;
    let currentStep = 0;

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
      let elements = this.convertSelectorsToElements(selectors);
      console.log(`Found ${elements.length} elements from selectors`);
      let prev = elements.slice();

      // Step 2: Top-level filtering with fixpoint iteration
      updateProgress(
        2,
        "Step 1: Top-level filtering with fixpoint iteration..."
      );
      elements = this.applyTopLevelFiltering(elements);
      elements = this.ensureMinimumSurvivors(
        elements,
        prev,
        "Top-level filtering"
      );
      showFilterDebugOverlay(
        "Top-level Filtering",
        prev.filter((x) => !elements.includes(x)),
        "Not top-level",
        2,
        "Top-level filtering"
      );
      prev = elements.slice();
      console.log(`After top-level filtering: ${elements.length} elements`);

      // Step 3: Visibility filtering
      updateProgress(3, "Step 2: Comprehensive visibility analysis...");
      elements =
        this.visibilityFilter.applyComprehensiveVisibilityFiltering(elements);
      elements = this.ensureMinimumSurvivors(
        elements,
        prev,
        "Visibility filtering"
      );
      showFilterDebugOverlay(
        "Visibility Filtering",
        prev.filter((x) => !elements.includes(x)),
        "Not visible",
        3,
        "Visibility filtering"
      );
      prev = elements.slice();
      console.log(`After visibility filtering: ${elements.length} elements`);

      // Step 4: IoU-based deduplication
      updateProgress(4, "Step 3: IoU-based deduplication...");
      elements = this.deduplicationFilter.applyIoUDeduplication(
        elements,
        THRESHOLDS.IOU_DEDUPE
      );
      elements = this.ensureMinimumSurvivors(
        elements,
        prev,
        "IoU deduplication"
      );
      showFilterDebugOverlay(
        "IoU Deduplication",
        prev.filter((x) => !elements.includes(x)),
        "Deduplicated",
        4,
        "IoU deduplication"
      );
      prev = elements.slice();
      console.log(`After IoU deduplication: ${elements.length} elements`);

      // Step 5: Structural filtering
      updateProgress(5, "Step 4: Structural element filtering...");
      elements = this.filterStructuralElements(elements);
      elements = this.ensureMinimumSurvivors(
        elements,
        prev,
        "Structural filtering"
      );
      showFilterDebugOverlay(
        "Structural Filtering",
        prev.filter((x) => !elements.includes(x)),
        "Not structural/interactive",
        5,
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

      // Step 7: Semantic similarity filtering
      updateProgress(7, "Step 6: Semantic similarity analysis...");
      const beforeSemantic = elements.slice();
      elements = this.applySemanticSimilarityFiltering(elements);
      elements = this.ensureMinimumSurvivors(
        elements,
        beforeSemantic,
        "Semantic similarity filtering"
      );
      showFilterDebugOverlay(
        "Semantic Similarity Filtering",
        beforeSemantic.filter((x) => !elements.includes(x)),
        "Semantically similar",
        7,
        "Semantic similarity filtering"
      );
      prev = elements.slice();
      console.log(`After semantic filtering: ${elements.length} elements`);

      // Step 8: Functional similarity filtering
      updateProgress(8, "Step 7: Functional similarity analysis...");
      const beforeFunctional = elements.slice();
      elements = this.applyFunctionalSimilarityFiltering(elements);
      elements = this.ensureMinimumSurvivors(
        elements,
        beforeFunctional,
        "Functional similarity filtering"
      );
      showFilterDebugOverlay(
        "Functional Similarity Filtering",
        beforeFunctional.filter((x) => !elements.includes(x)),
        "Functionally similar",
        8,
        "Functional similarity filtering"
      );
      prev = elements.slice();
      console.log(`After functional filtering: ${elements.length} elements`);

      // Step 9: LLM-based analysis (batched)
      updateProgress(9, "Step 8: LLM-based element classification...");
      const beforeLLM = elements.slice();
      elements = await this.applyLLMAnalysis(elements, updateProgress, 10, 20);
      elements = this.ensureMinimumSurvivors(
        elements,
        beforeLLM,
        "LLM analysis"
      );
      showFilterDebugOverlay(
        "LLM Analysis",
        beforeLLM.filter((x) => !elements.includes(x)),
        "LLM filtered",
        9,
        "LLM analysis"
      );
      prev = elements.slice();
      console.log(`After LLM analysis: ${elements.length} elements`);

      // Step 10: Final quality filtering
      updateProgress(21, "Step 9: Final quality assessment...");
      const beforeFinal = elements.slice();
      elements = this.applyFinalQualityFiltering(elements);
      elements = this.ensureMinimumSurvivors(
        elements,
        beforeFinal,
        "Final quality filtering"
      );
      showFilterDebugOverlay(
        "Final Quality Filtering",
        beforeFinal.filter((x) => !elements.includes(x)),
        "Not fundamental UI",
        21,
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
      const beforeFinalDedup = elements.slice();
      elements = this.deduplicationFilter.applyFinalDeduplication(elements);
      showFilterDebugOverlay(
        "Final Deduplication",
        beforeFinalDedup.filter((x) => !elements.includes(x)),
        "Deduplicated",
        24,
        "Final deduplication"
      );
      prev = elements.slice();
      console.log(`After final deduplication: ${elements.length} elements`);

      // Step 14: Complete
      updateProgress(25, "Comprehensive filtering complete!");
      console.log(
        `Comprehensive filtering complete: ${elements.length} elements`
      );

      return elements;
    } catch (error) {
      console.error("Error during comprehensive filtering:", error);
      updateProgress(totalSteps, "Error during filtering");
      throw error;
    }
  }

  /**
   * Convert selectors to DOM elements with better error handling
   * @param {Array} selectors - Array of CSS selectors
   * @returns {Array} Array of DOM elements
   */
  convertSelectorsToElements(selectors) {
    const elements = [];
    const failedSelectors = [];

    console.log(`Converting ${selectors.length} selectors to elements...`);

    for (const selector of selectors) {
      try {
        const element = document.querySelector(selector);
        if (element) {
          elements.push(element);
        } else {
          failedSelectors.push(selector);
          console.warn(`Selector not found: ${selector}`);
        }
      } catch (error) {
        failedSelectors.push(selector);
        console.warn(`Invalid selector: ${selector}`, error);
      }
    }

    console.log(
      `Successfully converted ${elements.length}/${selectors.length} selectors`
    );
    if (failedSelectors.length > 0) {
      console.warn(`Failed selectors:`, failedSelectors);
      // Show debug overlay for failed selectors
      showFilterDebugOverlay(
        "Selector Conversion",
        failedSelectors.map((s) => ({ selector: s, tagName: "unknown" })),
        "Invalid or not found",
        null,
        "Selector conversion"
      );
    }

    return elements;
  }

  /**
   * Apply top-level filtering with fixpoint iteration
   * @param {Array} elements - Array of elements
   * @returns {Array} Filtered elements
   */
  applyTopLevelFiltering(elements) {
    let current = elements;
    let previous = null;
    let iterations = 0;
    const maxIterations = 5;

    while (current.length !== previous?.length && iterations < maxIterations) {
      previous = current;
      current = this.spatialFilter.filterTopLevelElements(current);
      iterations++;
    }

    return current;
  }

  /**
   * Filter structural elements - much less restrictive
   * @param {Array} elements - Array of elements
   * @returns {Array} Filtered elements
   */
  filterStructuralElements(elements) {
    const beforeCount = elements.length;
    const filtered = elements.filter((element) => {
      const tag = element.tagName.toLowerCase();
      const role = element.getAttribute("role");
      const className = element.className || "";
      const id = element.id || "";

      // Keep interactive elements
      if (this.isInteractiveElement(element)) {
        return true;
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
        return true;
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
        return true;
      }

      // Keep divs and spans that have UI-like attributes
      if (tag === "div" || tag === "span") {
        // Keep if it has data attributes (common in modern frameworks)
        if (element.hasAttribute("data-")) {
          return true;
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
          return true;
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
          return true;
        }
        // Keep if it has click handlers or event listeners
        if (element.onclick || element.getAttribute("onclick")) {
          return true;
        }
        // Keep if it has cursor pointer
        const style = window.getComputedStyle(element);
        if (style.cursor === "pointer") {
          return true;
        }
      }

      // Keep form elements
      if (["form", "fieldset", "legend", "optgroup", "option"].includes(tag)) {
        return true;
      }

      // Keep elements with text content (likely meaningful)
      if (element.innerText && element.innerText.trim().length > 0) {
        return true;
      }

      return false;
    });

    const afterCount = filtered.length;
    console.log(
      `Structural filtering: ${beforeCount} → ${afterCount} elements`
    );

    // Ensure we keep at least some elements
    if (afterCount === 0 && beforeCount > 0) {
      console.warn(
        "Structural filtering removed all elements, keeping first 3"
      );
      return elements.slice(0, Math.min(3, elements.length));
    }

    return filtered;
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
   * Apply semantic similarity filtering
   * @param {Array} elements - Array of elements
   * @returns {Array} Filtered elements
   */
  applySemanticSimilarityFiltering(elements) {
    const filtered = [];

    for (let i = 0; i < elements.length; i++) {
      let isDuplicate = false;

      for (let j = 0; j < filtered.length; j++) {
        const similarity = this.calculateSemanticSimilarity(
          elements[i],
          filtered[j]
        );
        if (similarity > THRESHOLDS.SEMANTIC_SIMILARITY) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        filtered.push(elements[i]);
      }
    }

    return filtered;
  }

  /**
   * Apply functional similarity filtering
   * @param {Array} elements - Array of elements
   * @returns {Array} Filtered elements
   */
  applyFunctionalSimilarityFiltering(elements) {
    const filtered = [];

    for (let i = 0; i < elements.length; i++) {
      let isDuplicate = false;

      for (let j = 0; j < filtered.length; j++) {
        const similarity = this.calculateFunctionalSimilarity(
          elements[i],
          filtered[j]
        );
        if (similarity > THRESHOLDS.FUNCTIONAL_SIMILARITY) {
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        filtered.push(elements[i]);
      }
    }

    return filtered;
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
   * Apply final quality filtering
   * @param {Array} elements - Array of elements
   * @returns {Array} Filtered elements
   */
  applyFinalQualityFiltering(elements) {
    return elements.filter((element) => {
      // Check if element is fundamental UI component
      return this.isFundamentalUIComponent(element);
    });
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
      const aArea = a.rect.width * a.rect.height;
      const bArea = b.rect.width * b.rect.height;
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
   * @returns {boolean} True if element is fundamental
   */
  isFundamentalUIComponent(element) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const text = element.innerText?.trim() || "";

    // Interactive elements are fundamental
    if (this.isInteractiveElement(element)) {
      return true;
    }

    // Elements with meaningful text are fundamental
    if (text.length > 0 && text.length < 100) {
      return true;
    }

    // Structural elements are fundamental
    if (["nav", "header", "footer", "main"].includes(tag)) {
      return true;
    }

    // Elements with meaningful roles are fundamental
    if (
      role &&
      ["navigation", "banner", "contentinfo", "main"].includes(role)
    ) {
      return true;
    }

    return false;
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

// Debug overlay for filtering steps
function showFilterDebugOverlay(
  stepName,
  removedElements,
  reason,
  stepNumber = null,
  functionName = null
) {
  if (!removedElements || removedElements.length === 0) return;

  // Create or reuse the debug overlay
  let overlay = document.getElementById("scope-filter-debug-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "scope-filter-debug-overlay";
    overlay.style.cssText = `
      position: fixed;
      top: 20px;
      left: 20px;
      width: 480px;
      max-height: 70vh;
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
    document.body.appendChild(overlay);
  }

  // Add a section for this step
  const section = document.createElement("div");
  section.style.marginBottom = "18px";
  section.style.borderBottom = "1px solid #444";
  section.style.paddingBottom = "12px";

  // Create header with step number and function name
  const header = document.createElement("div");
  header.style.cssText =
    "font-weight: bold; color: #ffc107; margin-bottom: 8px;";

  let headerText = stepName;
  if (stepNumber !== null) {
    headerText = `Step ${stepNumber}: ${headerText}`;
  }
  if (functionName) {
    headerText += ` (${functionName})`;
  }
  headerText += ` - Removed ${removedElements.length} elements`;

  header.textContent = headerText;
  section.appendChild(header);

  // Add reason description
  if (reason) {
    const reasonDiv = document.createElement("div");
    reasonDiv.style.cssText =
      "color: #aaa; font-size: 12px; margin-bottom: 8px; font-style: italic;";
    reasonDiv.textContent = `Reason: ${reason}`;
    section.appendChild(reasonDiv);
  }

  // Create list of removed elements with detailed info
  const list = document.createElement("ul");
  list.style.cssText =
    "list-style: none; padding: 0; margin: 0; max-height: 200px; overflow-y: auto;";

  removedElements.forEach((el, index) => {
    const li = document.createElement("li");
    li.style.cssText =
      "margin-bottom: 6px; border-bottom: 1px solid #333; padding-bottom: 4px;";

    let elementInfo = "";
    let selector = "";
    let tagName = "";
    let text = "";
    let size = "";

    // Debug: log what type of object we're dealing with
    console.log(`Debug element ${index}:`, el);
    console.log(`Debug element type:`, typeof el);
    console.log(`Debug element constructor:`, el?.constructor?.name);
    console.log(`Debug element instanceof Element:`, el instanceof Element);

    try {
      if (el instanceof Element) {
        // It's a real DOM element
        tagName = el.tagName.toLowerCase();
        selector = el.id
          ? `#${el.id}`
          : `${tagName}${
              el.className ? "." + el.className.split(" ").join(".") : ""
            }`;
        text = el.innerText?.trim().substring(0, 50) || "";
        const rect = el.getBoundingClientRect();
        size = `${Math.round(rect.width)}x${Math.round(rect.height)}`;
      } else if (el && typeof el === "object") {
        // It's a data object from collection
        tagName = el.tagName || el.type || "unknown";
        selector = el.selector || "unknown";
        text = el.text || el.innerText || "";
        if (el.boundingRect) {
          size = `${Math.round(el.boundingRect.width)}x${Math.round(
            el.boundingRect.height
          )}`;
        } else if (el.rect) {
          size = `${Math.round(el.rect.width)}x${Math.round(el.rect.height)}`;
        } else {
          size = "unknown";
        }
      } else if (typeof el === "string") {
        // It's a string - could be a URL or element string representation
        if (el.startsWith("http")) {
          // It's a URL
          tagName = "link";
          selector = el;
          text = el;
          size = "unknown";
        } else if (el.startsWith("[object ") && el.endsWith("Element]")) {
          // It's an element string representation like [object HTMLButtonElement]
          tagName = el
            .replace("[object ", "")
            .replace("Element]", "")
            .toLowerCase();
          selector = el;
          text = "";
          size = "unknown";
        } else {
          // It's just a selector string
          tagName = "selector";
          selector = el;
          text = "";
          size = "unknown";
        }
      } else {
        // Unknown type
        tagName = "unknown";
        selector = "unknown";
        text = "";
        size = "unknown";
      }
    } catch (error) {
      console.error(`Error processing element ${index}:`, error);
      selector = "error";
      tagName = "error";
      text = "";
      size = "error";
    }

    // Create detailed element info
    elementInfo = `${index + 1}. ${tagName} (${size})`;
    if (selector && selector !== "unknown") {
      // Truncate long selectors/URLs
      const displaySelector =
        selector.length > 60 ? selector.substring(0, 60) + "..." : selector;
      elementInfo += ` - ${displaySelector}`;
    }
    if (text) {
      elementInfo += ` - "${text}${text.length >= 50 ? "..." : ""}"`;
    }

    li.textContent = elementInfo;
    list.appendChild(li);
  });

  section.appendChild(list);
  overlay.appendChild(section);

  // Add close button if not present
  if (!document.getElementById("scope-filter-debug-close")) {
    const closeBtn = document.createElement("button");
    closeBtn.id = "scope-filter-debug-close";
    closeBtn.textContent = "Close Debug Overlay";
    closeBtn.style.cssText =
      "margin-top: 12px; background: #ffc107; color: #222; border: none; border-radius: 5px; padding: 6px 16px; font-size: 13px; cursor: pointer; float: right;";
    closeBtn.onclick = () => overlay.remove();
    overlay.appendChild(closeBtn);
  }

  // Add timestamp
  const timestamp = document.createElement("div");
  timestamp.style.cssText =
    "color: #666; font-size: 11px; margin-top: 8px; text-align: right;";
  timestamp.textContent = new Date().toLocaleTimeString();
  section.appendChild(timestamp);
}
