/**
 * LLM service for AI-powered element analysis
 * Handles OpenAI API calls, batching, and fallback analysis
 */

import { LLM_CONFIG } from "@shared/constants.js";

/**
 * LLM service class for element analysis
 */
export class LLMService {
  constructor() {
    this.config = LLM_CONFIG;
    this.cache = new Map();
  }

  /**
   * Analyze elements using LLM
   * @param {Array} elements - Array of elements to analyze
   * @returns {Promise<Array>} Promise that resolves with analyzed elements
   */
  async analyzeElements(elements) {
    if (!this.config.openai.apiKey) {
      console.warn("No OpenAI API key configured, using fallback analysis");
      return this.fallbackAnalysis(elements);
    }

    try {
      const batches = this.createBatches(
        elements,
        this.config.performance.batchSize
      );
      const results = [];

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        console.log(
          `Analyzing batch ${i + 1}/${batches.length} with ${
            batch.length
          } elements`
        );

        try {
          const batchResults = await this.analyzeBatch(batch);
          results.push(...batchResults);

          // Delay between batches
          if (i < batches.length - 1) {
            await this.delay(this.config.performance.delayBetweenBatches);
          }
        } catch (error) {
          console.warn(`Error analyzing batch ${i + 1}:`, error);
          // Fallback for this batch
          const fallbackResults = this.fallbackAnalysis(batch);
          results.push(...fallbackResults);
        }
      }

      return results;
    } catch (error) {
      console.error("Error in LLM analysis:", error);
      return this.fallbackAnalysis(elements);
    }
  }

  /**
   * Analyze a batch of elements
   * @param {Array} elements - Array of elements to analyze
   * @returns {Promise<Array>} Promise that resolves with analyzed elements
   */
  async analyzeBatch(elements) {
    const prompts = elements.map((element) => this.createPrompt(element));
    const response = await this.callOpenAI(prompts);

    return elements.map((element, index) => {
      const analysis = this.parseResponse(response, index);
      return {
        ...element,
        elementType: analysis.elementType,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
      };
    });
  }

  /**
   * Create prompt for element analysis
   * @param {Element} element - DOM element
   * @returns {string} Analysis prompt
   */
  createPrompt(element) {
    const tag = element.tagName.toLowerCase();
    const text = element.innerText?.trim() || "";
    const role = element.getAttribute("role") || "";
    const classes = Array.from(element.classList).join(" ");
    const rect = element.getBoundingClientRect();

    return `Analyze this UI element and classify it:

Tag: ${tag}
Text: "${text}"
Role: ${role}
Classes: ${classes}
Size: ${rect.width}x${rect.height}
Position: (${rect.left}, ${rect.top})

Classify as one of: button, input, link, navigation, header, footer, text, image, form, container, or other.

Respond in JSON format:
{
  "elementType": "classification",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}`;
  }

  /**
   * Call OpenAI API
   * @param {Array} prompts - Array of prompts
   * @returns {Promise<Object>} Promise that resolves with API response
   */
  async callOpenAI(prompts) {
    const messages = prompts.map((prompt) => ({
      role: "user",
      content: prompt,
    }));

    const response = await fetch(this.config.openai.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: this.config.openai.model,
        messages: messages,
        max_tokens: this.config.openai.maxTokens,
        temperature: this.config.openai.temperature,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `OpenAI API error: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data;
  }

  /**
   * Parse OpenAI response
   * @param {Object} response - OpenAI API response
   * @param {number} index - Element index
   * @returns {Object} Parsed analysis
   */
  parseResponse(response, index) {
    try {
      const choice = response.choices?.[index];
      if (!choice) {
        return this.getDefaultAnalysis();
      }

      const content = choice.message?.content;
      if (!content) {
        return this.getDefaultAnalysis();
      }

      // Try to parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          elementType: parsed.elementType || "container",
          confidence: parsed.confidence || 0.5,
          reasoning: parsed.reasoning || "No reasoning provided",
        };
      }

      // Fallback: try to extract classification from text
      const elementType = this.extractElementTypeFromText(content);
      return {
        elementType: elementType,
        confidence: 0.3,
        reasoning: content,
      };
    } catch (error) {
      console.warn("Error parsing LLM response:", error);
      return this.getDefaultAnalysis();
    }
  }

  /**
   * Extract element type from text response
   * @param {string} text - Response text
   * @returns {string} Extracted element type
   */
  extractElementTypeFromText(text) {
    const lowerText = text.toLowerCase();

    if (lowerText.includes("button")) return "button";
    if (lowerText.includes("input")) return "input";
    if (lowerText.includes("link")) return "link";
    if (lowerText.includes("navigation")) return "navigation";
    if (lowerText.includes("header")) return "header";
    if (lowerText.includes("footer")) return "footer";
    if (lowerText.includes("text")) return "text";
    if (lowerText.includes("image")) return "image";
    if (lowerText.includes("form")) return "form";
    if (lowerText.includes("container")) return "container";

    return "other";
  }

  /**
   * Get default analysis when LLM fails
   * @returns {Object} Default analysis
   */
  getDefaultAnalysis() {
    return {
      elementType: "container",
      confidence: 0.1,
      reasoning: "LLM analysis failed, using default classification",
    };
  }

  /**
   * Fallback analysis when LLM is not available
   * @param {Array} elements - Array of elements
   * @returns {Array} Elements with fallback analysis
   */
  fallbackAnalysis(elements) {
    return elements.map((element) => {
      const analysis = this.ruleBasedAnalysis(element);
      return {
        ...element,
        elementType: analysis.elementType,
        confidence: analysis.confidence,
        reasoning: analysis.reasoning,
      };
    });
  }

  /**
   * Rule-based analysis as fallback
   * @param {Element} element - DOM element
   * @returns {Object} Analysis result
   */
  ruleBasedAnalysis(element) {
    const tag = element.tagName.toLowerCase();
    const role = element.getAttribute("role");
    const text = element.innerText?.trim() || "";
    const classes = Array.from(element.classList).join(" ").toLowerCase();

    let elementType = "container";
    let confidence = 0.5;
    let reasoning = "";

    // Button detection
    if (
      tag === "button" ||
      role === "button" ||
      classes.includes("btn") ||
      classes.includes("button")
    ) {
      elementType = "button";
      confidence = 0.9;
      reasoning = "Detected as button by tag, role, or class";
    }
    // Input detection
    else if (tag === "input" || tag === "textarea" || tag === "select") {
      elementType = "input";
      confidence = 0.9;
      reasoning = "Detected as input by tag";
    }
    // Link detection
    else if (tag === "a" || role === "link" || classes.includes("link")) {
      elementType = "link";
      confidence = 0.8;
      reasoning = "Detected as link by tag, role, or class";
    }
    // Navigation detection
    else if (
      tag === "nav" ||
      role === "navigation" ||
      classes.includes("nav")
    ) {
      elementType = "navigation";
      confidence = 0.8;
      reasoning = "Detected as navigation by tag, role, or class";
    }
    // Header detection
    else if (
      tag === "header" ||
      role === "banner" ||
      classes.includes("header")
    ) {
      elementType = "header";
      confidence = 0.8;
      reasoning = "Detected as header by tag, role, or class";
    }
    // Footer detection
    else if (
      tag === "footer" ||
      role === "contentinfo" ||
      classes.includes("footer")
    ) {
      elementType = "footer";
      confidence = 0.8;
      reasoning = "Detected as footer by tag, role, or class";
    }
    // Text detection
    else if (text.length > 0 && text.length < 200) {
      elementType = "text";
      confidence = 0.6;
      reasoning = "Detected as text content";
    }
    // Form detection
    else if (tag === "form" || classes.includes("form")) {
      elementType = "form";
      confidence = 0.7;
      reasoning = "Detected as form by tag or class";
    }

    return { elementType, confidence, reasoning };
  }

  /**
   * Create batches of elements
   * @param {Array} elements - Array of elements
   * @param {number} batchSize - Size of each batch
   * @returns {Array} Array of batches
   */
  createBatches(elements, batchSize) {
    const batches = [];
    for (let i = 0; i < elements.length; i += batchSize) {
      batches.push(elements.slice(i, i + batchSize));
    }
    return batches;
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
   * Clear LLM cache
   */
  clearCache() {
    this.cache.clear();
  }
}
