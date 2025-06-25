/**
 * Geometry utilities for calculating areas, intersections, and test points
 * Handles rectangle operations, IoU calculations, and point generation
 */

/**
 * Generate test points for visibility checking
 * @param {Object} rect - Bounding rectangle {x, y, width, height}
 * @param {number} numPoints - Number of test points to generate (default: 9)
 * @returns {Array} Array of test points {x, y}
 */
export function generateTestPoints(rect, numPoints = 9) {
  const points = [];
  const { x, y, width, height } = rect;

  if (numPoints === 9) {
    // 3x3 grid of points
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        points.push({
          x: x + (width * (col + 1)) / 4,
          y: y + (height * (row + 1)) / 4,
        });
      }
    }
  } else if (numPoints === 5) {
    // Center and four corners
    points.push(
      { x: x + width / 2, y: y + height / 2 }, // center
      { x: x + 2, y: y + 2 }, // top-left (offset by 2px)
      { x: x + width - 2, y: y + 2 }, // top-right
      { x: x + 2, y: y + height - 2 }, // bottom-left
      { x: x + width - 2, y: y + height - 2 } // bottom-right
    );
  } else {
    // Generate random points
    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: x + Math.random() * width,
        y: y + Math.random() * height,
      });
    }
  }

  return points;
}

/**
 * Calculate intersection over union (IoU) between two rectangles
 * @param {Object} rectA - First rectangle {x, y, width, height}
 * @param {Object} rectB - Second rectangle {x, y, width, height}
 * @returns {number} IoU value between 0 and 1
 */
export function calculateIoU(rectA, rectB) {
  const intersection = calculateIntersection(rectA, rectB);
  const union = calculateUnion(rectA, rectB);

  return union > 0 ? intersection / union : 0;
}

/**
 * Calculate intersection area between two rectangles
 * @param {Object} rectA - First rectangle {x, y, width, height}
 * @param {Object} rectB - Second rectangle {x, y, width, height}
 * @returns {number} Intersection area
 */
export function calculateIntersection(rectA, rectB) {
  const left = Math.max(rectA.x, rectB.x);
  const top = Math.max(rectA.y, rectB.y);
  const right = Math.min(rectA.x + rectA.width, rectB.x + rectB.width);
  const bottom = Math.min(rectA.y + rectA.height, rectB.y + rectB.height);

  if (left >= right || top >= bottom) {
    return 0;
  }

  return (right - left) * (bottom - top);
}

/**
 * Calculate union area of two rectangles
 * @param {Object} rectA - First rectangle {x, y, width, height}
 * @param {Object} rectB - Second rectangle {x, y, width, height}
 * @returns {number} Union area
 */
export function calculateUnion(rectA, rectB) {
  const areaA = rectA.width * rectA.height;
  const areaB = rectB.width * rectB.height;
  const intersection = calculateIntersection(rectA, rectB);

  return areaA + areaB - intersection;
}

/**
 * Calculate area of a rectangle
 * @param {Object} rect - Rectangle {x, y, width, height}
 * @returns {number} Rectangle area
 */
export function calculateArea(rect) {
  return rect.width * rect.height;
}

/**
 * Calculate containment ratio (how much of rectA is contained in rectB)
 * @param {Object} rectA - Inner rectangle {x, y, width, height}
 * @param {Object} rectB - Outer rectangle {x, y, width, height}
 * @returns {number} Containment ratio between 0 and 1
 */
export function calculateContainment(rectA, rectB) {
  const intersection = calculateIntersection(rectA, rectB);
  const areaA = calculateArea(rectA);

  return areaA > 0 ? intersection / areaA : 0;
}

/**
 * Check if two rectangles overlap
 * @param {Object} rectA - First rectangle {x, y, width, height}
 * @param {Object} rectB - Second rectangle {x, y, width, height}
 * @returns {boolean} True if rectangles overlap
 */
export function rectanglesOverlap(rectA, rectB) {
  return !(
    rectA.x + rectA.width <= rectB.x ||
    rectB.x + rectB.width <= rectA.x ||
    rectA.y + rectA.height <= rectB.y ||
    rectB.y + rectB.height <= rectA.y
  );
}

/**
 * Check if one rectangle is completely contained within another
 * @param {Object} inner - Inner rectangle {x, y, width, height}
 * @param {Object} outer - Outer rectangle {x, y, width, height}
 * @returns {boolean} True if inner is contained in outer
 */
export function isContained(inner, outer) {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

/**
 * Calculate distance between two points
 * @param {Object} pointA - First point {x, y}
 * @param {Object} pointB - Second point {x, y}
 * @returns {number} Euclidean distance
 */
export function calculateDistance(pointA, pointB) {
  const dx = pointA.x - pointB.x;
  const dy = pointA.y - pointB.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Calculate center point of a rectangle
 * @param {Object} rect - Rectangle {x, y, width, height}
 * @returns {Object} Center point {x, y}
 */
export function calculateCenter(rect) {
  return {
    x: rect.x + rect.width / 2,
    y: rect.y + rect.height / 2,
  };
}

/**
 * Expand rectangle by a given amount
 * @param {Object} rect - Rectangle {x, y, width, height}
 * @param {number} amount - Amount to expand by
 * @returns {Object} Expanded rectangle
 */
export function expandRectangle(rect, amount) {
  return {
    x: rect.x - amount,
    y: rect.y - amount,
    width: rect.width + 2 * amount,
    height: rect.height + 2 * amount,
  };
}

/**
 * Shrink rectangle by a given amount
 * @param {Object} rect - Rectangle {x, y, width, height}
 * @param {number} amount - Amount to shrink by
 * @returns {Object} Shrunk rectangle
 */
export function shrinkRectangle(rect, amount) {
  return {
    x: rect.x + amount,
    y: rect.y + amount,
    width: Math.max(0, rect.width - 2 * amount),
    height: Math.max(0, rect.height - 2 * amount),
  };
}
