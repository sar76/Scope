"""
Advanced Refinement Module for Bounding Box Optimization

This module implements advanced refinement techniques including:
1. Proportional distance normalization and margin clustering
2. Grid-line detection via Hough transform
3. Mask-based segmentation
4. Text-anchor + edge-anchor combination
"""

import cv2
import numpy as np
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import sys

# Add the parent directory to sys.path to import modules
sys.path.append(str(Path(__file__).parent.parent))

try:
    from sklearn.cluster import DBSCAN
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False
    logging.warning("sklearn not available. Margin clustering will be disabled.")

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logging.warning("pytesseract not available. OCR-based refinement will be disabled.")

logger = logging.getLogger(__name__)

class AdvancedBoundingBoxRefiner:
    """
    Advanced refiner that combines multiple sophisticated techniques for bounding box optimization.
    """
    
    def __init__(self, 
                 enable_margin_clustering: bool = True,
                 enable_hough_grid: bool = True,
                 enable_mask_segmentation: bool = False,  # Requires SAM model
                 enable_text_anchors: bool = True,
                 margin_eps: float = 0.01,
                 hough_threshold: int = 100):
        """
        Initialize the advanced refiner.
        
        Args:
            enable_margin_clustering: Whether to enable margin clustering
            enable_hough_grid: Whether to enable Hough transform grid detection
            enable_mask_segmentation: Whether to enable mask-based segmentation
            enable_text_anchors: Whether to enable text-anchor combination
            margin_eps: DBSCAN epsilon for margin clustering
            hough_threshold: Hough transform threshold
        """
        self.enable_margin_clustering = enable_margin_clustering and SKLEARN_AVAILABLE
        self.enable_hough_grid = enable_hough_grid
        self.enable_mask_segmentation = enable_mask_segmentation
        self.enable_text_anchors = enable_text_anchors and TESSERACT_AVAILABLE
        self.margin_eps = margin_eps
        self.hough_threshold = hough_threshold
        
        if not self.enable_margin_clustering and enable_margin_clustering:
            logger.warning("Margin clustering disabled due to missing sklearn")
        if not self.enable_text_anchors and enable_text_anchors:
            logger.warning("Text anchors disabled due to missing pytesseract")
    
    def refine_bounding_boxes(self, image: np.ndarray, boxes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Apply advanced refinement techniques to bounding boxes.
        
        Args:
            image: BGR screenshot as a NumPy array
            boxes: List of dicts with keys 'x','y','width','height','element'
            
        Returns:
            List of refined box dicts (same format)
        """
        if not boxes:
            return boxes
        
        refined_boxes = boxes.copy()
        
        # 1. Margin clustering (normalize and snap to common margins)
        if self.enable_margin_clustering:
            logger.info("Applying margin clustering...")
            refined_boxes = self._apply_margin_clustering(refined_boxes, image.shape[1], image.shape[0])
        
        # 2. Hough transform grid detection
        if self.enable_hough_grid:
            logger.info("Applying Hough grid detection...")
            refined_boxes = self._apply_hough_grid_snapping(refined_boxes, image)
        
        # 3. Text-anchor + edge-anchor combination
        if self.enable_text_anchors:
            logger.info("Applying text-anchor combination...")
            refined_boxes = self._apply_text_anchor_combination(refined_boxes, image)
        
        # 4. Mask-based segmentation (if enabled and SAM available)
        if self.enable_mask_segmentation:
            logger.info("Applying mask-based segmentation...")
            refined_boxes = self._apply_mask_segmentation(refined_boxes, image)
        
        # 5. Final validation and cleanup
        refined_boxes = self._validate_and_cleanup(refined_boxes, image.shape[1], image.shape[0])
        
        return refined_boxes
    
    def _apply_margin_clustering(self, boxes: List[Dict[str, Any]], W: int, H: int) -> List[Dict[str, Any]]:
        """
        Apply margin clustering to snap boxes to common grid lines.
        
        Args:
            boxes: List of bounding boxes
            W: Image width
            H: Image height
            
        Returns:
            List of refined boxes
        """
        if not SKLEARN_AVAILABLE or not boxes:
            return boxes
        
        try:
            # Build normalized edge lists
            ys = np.array([b['y']/H for b in boxes]).reshape(-1, 1)
            xs = np.array([b['x']/W for b in boxes]).reshape(-1, 1)
            
            # Cluster rows (y-coordinates)
            row_clust = DBSCAN(eps=self.margin_eps, min_samples=1).fit(ys)
            row_centers = {}
            for label in set(row_clust.labels_):
                if label != -1:  # Skip noise points
                    row_centers[label] = ys[row_clust.labels_ == label].mean()
            
            # Cluster columns (x-coordinates)
            col_clust = DBSCAN(eps=self.margin_eps, min_samples=1).fit(xs)
            col_centers = {}
            for label in set(col_clust.labels_):
                if label != -1:  # Skip noise points
                    col_centers[label] = xs[col_clust.labels_ == label].mean()
            
            # Snap boxes to nearest cluster centers
            refined = []
            for i, b in enumerate(boxes):
                y_n = b['y'] / H
                x_n = b['x'] / W
                
                # Snap to nearest row center
                label_row = row_clust.labels_[i]
                if label_row in row_centers:
                    y_snap = row_centers[label_row] * H
                else:
                    y_snap = b['y']
                
                # Snap to nearest column center
                label_col = col_clust.labels_[i]
                if label_col in col_centers:
                    x_snap = col_centers[label_col] * W
                else:
                    x_snap = b['x']
                
                refined.append({
                    **b,
                    'x': int(round(x_snap)),
                    'y': int(round(y_snap)),
                    'width': b['width'],
                    'height': b['height']
                })
            
            return refined
            
        except Exception as e:
            logger.warning(f"Margin clustering failed: {e}")
            return boxes
    
    def _apply_hough_grid_snapping(self, boxes: List[Dict[str, Any]], image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Apply Hough transform to detect grid lines and snap boxes to them.
        
        Args:
            boxes: List of bounding boxes
            image: Input image
            
        Returns:
            List of refined boxes
        """
        try:
            # Convert to grayscale
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            
            # Apply Canny edge detection
            edges = cv2.Canny(gray, 50, 150, apertureSize=3)
            
            # Apply Hough transform to detect lines
            lines = cv2.HoughLines(edges, 1, np.pi/180, self.hough_threshold)
            
            if lines is None:
                return boxes
            
            # Separate horizontal and vertical lines
            horizontal_lines = []
            vertical_lines = []
            
            for rho, theta in lines[:, 0]:
                if theta < np.pi/4 or theta > 3*np.pi/4:
                    # Vertical line
                    vertical_lines.append(rho)
                else:
                    # Horizontal line
                    horizontal_lines.append(rho)
            
            # Snap boxes to nearest lines
            refined = []
            for box in boxes:
                x, y, w, h = box['x'], box['y'], box['width'], box['height']
                
                # Snap top and bottom to horizontal lines
                top_snap = self._snap_to_nearest_line(y, horizontal_lines, tolerance=20)
                bottom_snap = self._snap_to_nearest_line(y + h, horizontal_lines, tolerance=20)
                
                # Snap left and right to vertical lines
                left_snap = self._snap_to_nearest_line(x, vertical_lines, tolerance=20)
                right_snap = self._snap_to_nearest_line(x + w, vertical_lines, tolerance=20)
                
                # Update box coordinates
                new_x = left_snap
                new_y = top_snap
                new_w = right_snap - left_snap
                new_h = bottom_snap - top_snap
                
                # Ensure positive dimensions
                if new_w > 0 and new_h > 0:
                    refined.append({
                        **box,
                        'x': new_x,
                        'y': new_y,
                        'width': new_w,
                        'height': new_h
                    })
                else:
                    refined.append(box)
            
            return refined
            
        except Exception as e:
            logger.warning(f"Hough grid snapping failed: {e}")
            return boxes
    
    def _snap_to_nearest_line(self, coord: int, lines: List[float], tolerance: int = 20) -> int:
        """
        Snap a coordinate to the nearest line within tolerance.
        
        Args:
            coord: Coordinate to snap
            lines: List of line positions
            tolerance: Maximum distance for snapping
            
        Returns:
            Snapped coordinate
        """
        if not lines:
            return coord
        
        min_dist = float('inf')
        best_line = coord
        
        for line in lines:
            dist = abs(coord - line)
            if dist < min_dist and dist <= tolerance:
                min_dist = dist
                best_line = int(line)
        
        return best_line
    
    def _apply_text_anchor_combination(self, boxes: List[Dict[str, Any]], image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Combine text-anchor and edge-anchor approaches.
        
        Args:
            boxes: List of bounding boxes
            image: Input image
            
        Returns:
            List of refined boxes
        """
        if not TESSERACT_AVAILABLE:
            return boxes
        
        try:
            refined = []
            for box in boxes:
                x, y, w, h = box['x'], box['y'], box['width'], box['height']
                
                # Ensure crop coordinates are within bounds
                x = max(0, min(x, image.shape[1] - 1))
                y = max(0, min(y, image.shape[0] - 1))
                w = max(1, min(w, image.shape[1] - x))
                h = max(1, min(h, image.shape[0] - y))
                
                crop = image[y:y+h, x:x+w]
                
                if crop.size == 0:
                    refined.append(box)
                    continue
                
                # Get text bounds
                text_bounds = self._get_text_bounds(crop)
                
                if text_bounds:
                    tx, ty, tw, th = text_bounds
                    
                    # Check if text spans significant portion of the box
                    text_width_ratio = tw / w
                    text_height_ratio = th / h
                    
                    # If text spans >80% of width, trust text bounds for left/right
                    if text_width_ratio > 0.8:
                        new_x = x + tx
                        new_w = tw
                    else:
                        new_x = x
                        new_w = w
                    
                    # If text spans >80% of height, trust text bounds for top/bottom
                    if text_height_ratio > 0.8:
                        new_y = y + ty
                        new_h = th
                    else:
                        new_y = y
                        new_h = h
                    
                    refined.append({
                        **box,
                        'x': new_x,
                        'y': new_y,
                        'width': new_w,
                        'height': new_h
                    })
                else:
                    refined.append(box)
            
            return refined
            
        except Exception as e:
            logger.warning(f"Text anchor combination failed: {e}")
            return boxes
    
    def _get_text_bounds(self, crop: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        """
        Get text bounding bounds from a crop using OCR.
        
        Args:
            crop: Cropped image region
            
        Returns:
            Text bounds (x, y, width, height) or None
        """
        try:
            data = pytesseract.image_to_data(crop, output_type=pytesseract.Output.DICT)
            
            if not data['text']:
                return None
            
            # Extract text bounding boxes
            text_boxes = []
            for i, txt in enumerate(data['text']):
                if txt.strip():  # Only consider non-empty text
                    left = data['left'][i]
                    top = data['top'][i]
                    width = data['width'][i]
                    height = data['height'][i]
                    text_boxes.append((left, top, width, height))
            
            if text_boxes:
                # Find the bounding box of all text
                xs = [box[0] for box in text_boxes]
                ys = [box[1] for box in text_boxes]
                ws = [box[2] for box in text_boxes]
                hs = [box[3] for box in text_boxes]
                
                x0 = min(xs)
                y0 = min(ys)
                x1 = max(xs[i] + ws[i] for i in range(len(xs)))
                y1 = max(ys[i] + hs[i] for i in range(len(ys)))
                
                return x0, y0, x1 - x0, y1 - y0
            
            return None
            
        except Exception as e:
            logger.debug(f"Text bounds extraction failed: {e}")
            return None
    
    def _apply_mask_segmentation(self, boxes: List[Dict[str, Any]], image: np.ndarray) -> List[Dict[str, Any]]:
        """
        Apply mask-based segmentation (placeholder for SAM integration).
        
        Args:
            boxes: List of bounding boxes
            image: Input image
            
        Returns:
            List of refined boxes
        """
        # This is a placeholder for SAM (Segment Anything Model) integration
        # For now, return boxes unchanged
        logger.info("Mask segmentation not implemented (requires SAM model)")
        return boxes
    
    def _validate_and_cleanup(self, boxes: List[Dict[str, Any]], W: int, H: int) -> List[Dict[str, Any]]:
        """
        Validate and cleanup refined boxes.
        
        Args:
            boxes: List of bounding boxes
            W: Image width
            H: Image height
            
        Returns:
            List of validated boxes
        """
        validated = []
        
        for box in boxes:
            x = max(0, min(box['x'], W - 1))
            y = max(0, min(box['y'], H - 1))
            w = max(1, min(box['width'], W - x))
            h = max(1, min(box['height'], H - y))
            
            # Check if refinement is too aggressive (>50% reduction)
            original_area = box.get('original_width', w) * box.get('original_height', h)
            new_area = w * h
            
            if original_area > 0 and new_area >= 0.5 * original_area:
                validated.append({
                    **box,
                    'x': x,
                    'y': y,
                    'width': w,
                    'height': h
                })
            else:
                # Keep original if refinement too aggressive
                validated.append(box)
        
        return validated


def snap_to_margins(boxes: List[Dict[str, Any]], W: int, H: int, eps: float = 0.01) -> List[Dict[str, Any]]:
    """
    Convenience function for margin clustering.
    
    Args:
        boxes: List of bounding boxes
        W: Image width
        H: Image height
        eps: DBSCAN epsilon
        
    Returns:
        List of refined boxes
    """
    refiner = AdvancedBoundingBoxRefiner(enable_margin_clustering=True, margin_eps=eps)
    return refiner._apply_margin_clustering(boxes, W, H)


def advanced_refine_bounding_boxes(image: np.ndarray, 
                                 boxes: List[Dict[str, Any]], 
                                 enable_margin_clustering: bool = True,
                                 enable_hough_grid: bool = True,
                                 enable_text_anchors: bool = True) -> List[Dict[str, Any]]:
    """
    Convenience function for advanced refinement.
    
    Args:
        image: BGR screenshot as a NumPy array
        boxes: List of dicts with keys 'x','y','width','height','element'
        enable_margin_clustering: Whether to enable margin clustering
        enable_hough_grid: Whether to enable Hough grid detection
        enable_text_anchors: Whether to enable text anchors
        
    Returns:
        List of refined box dicts (same format)
    """
    refiner = AdvancedBoundingBoxRefiner(
        enable_margin_clustering=enable_margin_clustering,
        enable_hough_grid=enable_hough_grid,
        enable_text_anchors=enable_text_anchors
    )
    return refiner.refine_bounding_boxes(image, boxes)


# Example usage and testing
if __name__ == "__main__":
    import cv2
    
    # Example usage
    img = cv2.imread("screenshot.png")
    initial_boxes = [
        {'element': 'Submit', 'x': 120, 'y': 450, 'width': 200, 'height': 48},
        {'element': 'Search', 'x': 50, 'y': 100, 'width': 300, 'height': 40},
    ]
    
    refined_boxes = advanced_refine_bounding_boxes(img, initial_boxes)
    print("Advanced refined boxes:", refined_boxes) 