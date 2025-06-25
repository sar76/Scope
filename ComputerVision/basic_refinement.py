"""
Hybrid Refinement Module for Bounding Box Optimization

This module implements the hybrid refinement approach for improving GPT-4o bounding boxes
using computer vision techniques including edge detection, OCR, and border scanning.
"""

import cv2
import numpy as np
import logging
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
import sys

# Add the parent directory to sys.path to import config
sys.path.append(str(Path(__file__).parent.parent))

try:
    import pytesseract
    TESSERACT_AVAILABLE = True
except ImportError:
    TESSERACT_AVAILABLE = False
    logging.warning("pytesseract not available. OCR-based refinement will be disabled.")

logger = logging.getLogger(__name__)

class BoundingBoxRefiner:
    """
    Refines initial GPT-4o bounding boxes using edge detection and OCR techniques.
    """
    
    def __init__(self, enable_ocr: bool = True, edge_threshold: Tuple[int, int] = (50, 150)):
        """
        Initialize the refiner.
        
        Args:
            enable_ocr: Whether to enable OCR-based refinement
            edge_threshold: Canny edge detection thresholds (low, high)
        """
        self.enable_ocr = enable_ocr and TESSERACT_AVAILABLE
        self.edge_threshold = edge_threshold
        
        if not self.enable_ocr and enable_ocr:
            logger.warning("OCR refinement disabled due to missing pytesseract")
    
    def refine_bounding_boxes(self, image: np.ndarray, boxes: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Refine initial GPT-4o bounding boxes using edge detection and OCR.
        
        Args:
            image: BGR screenshot as a NumPy array
            boxes: List of dicts with keys 'x','y','width','height','element'
            
        Returns:
            List of refined box dicts (same format)
        """
        refined = []
        
        for i, box in enumerate(boxes):
            try:
                x, y, w, h = box['x'], box['y'], box['width'], box['height']
                
                # Ensure crop coordinates are within image bounds
                x = max(0, min(x, image.shape[1] - 1))
                y = max(0, min(y, image.shape[0] - 1))
                w = max(1, min(w, image.shape[1] - x))
                h = max(1, min(h, image.shape[0] - y))
                
                crop = image[y:y+h, x:x+w]
                
                if crop.size == 0:
                    logger.warning(f"Empty crop for box {i}, keeping original")
                    refined.append(box.copy())
                    continue
                
                # Apply refinement techniques
                new_coords = self._apply_edge_refinement(crop, x, y, w, h)
                
                # If edge refinement didn't work well, try OCR
                if new_coords is None and self.enable_ocr:
                    new_coords = self._apply_ocr_refinement(crop, x, y, w, h)
                
                # If still no good refinement, try border scanning
                if new_coords is None:
                    new_coords = self._apply_border_scanning(crop, x, y, w, h)
                
                # Validate refinement
                if new_coords is not None:
                    new_x, new_y, new_w, new_h = new_coords
                    
                    # Check if refinement is too aggressive (>50% reduction)
                    if new_w >= 0.5 * w and new_h >= 0.5 * h:
                        refined.append({
                            'element': box.get('element', ''),
                            'x': new_x,
                            'y': new_y,
                            'width': new_w,
                            'height': new_h
                        })
                    else:
                        logger.info(f"Refinement too aggressive for box {i}, keeping original")
                        refined.append(box.copy())
                else:
                    refined.append(box.copy())
                    
            except Exception as e:
                logger.warning(f"Error refining box {i}: {e}, keeping original")
                refined.append(box.copy())
        
        return refined
    
    def _apply_edge_refinement(self, crop: np.ndarray, orig_x: int, orig_y: int, orig_w: int, orig_h: int) -> Optional[Tuple[int, int, int, int]]:
        """
        Apply edge detection-based refinement.
        
        Args:
            crop: Cropped image region
            orig_x, orig_y, orig_w, orig_h: Original coordinates in global image space
            
        Returns:
            Refined coordinates (x, y, width, height) or None if no refinement
        """
        try:
            # Convert to grayscale and apply Gaussian blur
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            blur = cv2.GaussianBlur(gray, (5, 5), 0)
            
            # Apply Canny edge detection
            edges = cv2.Canny(blur, self.edge_threshold[0], self.edge_threshold[1])
            
            # Dilate to connect broken edges
            kernel = np.ones((3, 3), np.uint8)
            edges = cv2.dilate(edges, kernel, iterations=1)
            
            # Find contours
            contours, _ = cv2.findContours(edges, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            
            if contours:
                # Combine all contours and find bounding rectangle
                all_pts = np.vstack(contours).squeeze()
                if len(all_pts.shape) == 1:
                    all_pts = all_pts.reshape(1, -1)
                
                x0, y0 = np.min(all_pts, axis=0)
                x1, y1 = np.max(all_pts, axis=0)
                
                # Map back to original image coordinates
                new_x = orig_x + int(x0)
                new_y = orig_y + int(y0)
                new_w = int(x1 - x0)
                new_h = int(y1 - y0)
                
                # Ensure coordinates are valid
                if new_w > 0 and new_h > 0:
                    return new_x, new_y, new_w, new_h
            
            return None
            
        except Exception as e:
            logger.debug(f"Edge refinement failed: {e}")
            return None
    
    def _apply_ocr_refinement(self, crop: np.ndarray, orig_x: int, orig_y: int, orig_w: int, orig_h: int) -> Optional[Tuple[int, int, int, int]]:
        """
        Apply OCR-based refinement using Tesseract.
        
        Args:
            crop: Cropped image region
            orig_x, orig_y, orig_w, orig_h: Original coordinates in global image space
            
        Returns:
            Refined coordinates (x, y, width, height) or None if no refinement
        """
        if not self.enable_ocr:
            return None
            
        try:
            # Get OCR data
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
                
                # Map back to original image coordinates
                new_x = orig_x + x0
                new_y = orig_y + y0
                new_w = x1 - x0
                new_h = y1 - y0
                
                # Ensure coordinates are valid
                if new_w > 0 and new_h > 0:
                    return new_x, new_y, new_w, new_h
            
            return None
            
        except Exception as e:
            logger.debug(f"OCR refinement failed: {e}")
            return None
    
    def _apply_border_scanning(self, crop: np.ndarray, orig_x: int, orig_y: int, orig_w: int, orig_h: int) -> Optional[Tuple[int, int, int, int]]:
        """
        Apply border scanning refinement by detecting significant color/brightness changes.
        
        Args:
            crop: Cropped image region
            orig_x, orig_y, orig_w, orig_h: Original coordinates in global image space
            
        Returns:
            Refined coordinates (x, y, width, height) or None if no refinement
        """
        try:
            # Convert to grayscale for brightness analysis
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            
            # Define threshold for significant change
            threshold = 30
            
            # Scan from left edge
            left_edge = 0
            for col in range(1, gray.shape[1]):
                col_diff = np.mean(np.abs(gray[:, col] - gray[:, col-1]))
                if col_diff > threshold:
                    left_edge = col
                    break
            
            # Scan from right edge
            right_edge = gray.shape[1] - 1
            for col in range(gray.shape[1] - 2, -1, -1):
                col_diff = np.mean(np.abs(gray[:, col] - gray[:, col+1]))
                if col_diff > threshold:
                    right_edge = col
                    break
            
            # Scan from top edge
            top_edge = 0
            for row in range(1, gray.shape[0]):
                row_diff = np.mean(np.abs(gray[row, :] - gray[row-1, :]))
                if row_diff > threshold:
                    top_edge = row
                    break
            
            # Scan from bottom edge
            bottom_edge = gray.shape[0] - 1
            for row in range(gray.shape[0] - 2, -1, -1):
                row_diff = np.mean(np.abs(gray[row, :] - gray[row+1, :]))
                if row_diff > threshold:
                    bottom_edge = row
                    break
            
            # Calculate new dimensions
            new_w = right_edge - left_edge + 1
            new_h = bottom_edge - top_edge + 1
            
            # Only apply if we found meaningful edges
            if new_w > 0 and new_h > 0 and (left_edge > 0 or right_edge < gray.shape[1] - 1 or top_edge > 0 or bottom_edge < gray.shape[0] - 1):
                new_x = orig_x + left_edge
                new_y = orig_y + top_edge
                return new_x, new_y, new_w, new_h
            
            return None
            
        except Exception as e:
            logger.debug(f"Border scanning failed: {e}")
            return None
    
    def _apply_color_difference_fallback(self, crop: np.ndarray, orig_x: int, orig_y: int, orig_w: int, orig_h: int) -> Optional[Tuple[int, int, int, int]]:
        """
        Fallback method using color difference threshold between crop interior and exterior.
        
        Args:
            crop: Cropped image region
            orig_x, orig_y, orig_w, orig_h: Original coordinates in global image space
            
        Returns:
            Refined coordinates (x, y, width, height) or None if no refinement
        """
        try:
            # Calculate mean color of the crop
            mean_color = np.mean(crop, axis=(0, 1))
            
            # Create a slightly larger crop to sample exterior
            margin = 5
            extended_crop = crop.copy()
            
            # Calculate color difference along borders
            border_diff_threshold = 20
            
            # Check left border
            left_edge = 0
            for col in range(1, min(margin, crop.shape[1])):
                col_color = np.mean(crop[:, col], axis=0)
                if np.linalg.norm(col_color - mean_color) > border_diff_threshold:
                    left_edge = col
                    break
            
            # Similar logic for other borders...
            # (This is a simplified version - full implementation would check all borders)
            
            return None
            
        except Exception as e:
            logger.debug(f"Color difference fallback failed: {e}")
            return None


def refine_bounding_boxes(image: np.ndarray, boxes: List[Dict[str, Any]], enable_ocr: bool = True) -> List[Dict[str, Any]]:
    """
    Convenience function to refine bounding boxes.
    
    Args:
        image: BGR screenshot as a NumPy array
        boxes: List of dicts with keys 'x','y','width','height','element'
        enable_ocr: Whether to enable OCR-based refinement
        
    Returns:
        List of refined box dicts (same format)
    """
    refiner = BoundingBoxRefiner(enable_ocr=enable_ocr)
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
    
    refined_boxes = refine_bounding_boxes(img, initial_boxes)
    print("Refined boxes:", refined_boxes) 