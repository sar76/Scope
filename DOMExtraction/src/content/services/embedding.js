let model = null;

/**
 * Load the Universal Sentence Encoder model (singleton, lazy-load)
 */
export async function loadUSEModel() {
  if (!model) {
    // Lazy-load tfjs and use only when needed
    const tf = await import("@tensorflow/tfjs");
    const use = await import("@tensorflow-models/universal-sentence-encoder");
    model = await use.load();
  }
  return model;
}

/**
 * Embed a string using Universal Sentence Encoder
 * @param {string} text
 * @returns {Promise<Float32Array>} Embedding vector
 */
export async function embedText(text) {
  const m = await loadUSEModel();
  const embeddings = await m.embed([text]);
  const arr = await embeddings.array();
  embeddings.dispose();
  return arr[0];
}

/**
 * Compute cosine similarity between two vectors
 * @param {Array|Float32Array} a
 * @param {Array|Float32Array} b
 * @returns {number} Cosine similarity
 */
export function cosineSimilarity(a, b) {
  let dot = 0.0,
    normA = 0.0,
    normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
